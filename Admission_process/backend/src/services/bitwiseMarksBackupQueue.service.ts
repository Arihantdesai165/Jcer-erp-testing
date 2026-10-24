import MarksBackupJob from '../models/MarksBackupJob';
import MarksBackupFile from '../models/MarksBackupFile';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import bitwiseMarksExcelService from './bitwiseMarksExcel.service';
import googleDriveService from './googleDrive.service';
import logger from '../utils/logger.util';
import { Op } from 'sequelize';

let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

export const bitwiseMarksBackupQueueService = {
  /**
   * Enqueues an asynchronous Bitwise Marks backup job after successful PostgreSQL transaction
   */
  async queueMarksBackup(
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    action: 'CREATE' | 'UPDATE' | 'SYNC' = 'UPDATE'
  ): Promise<MarksBackupJob | null> {
    try {
      // 1. Check if Google Drive is connected & auto backup is enabled
      const integration = await GoogleDriveIntegration.findOne({
        where: { status: 'CONNECTED' },
      });

      if (!integration || !integration.autoBackupEnabled) {
        logger.info(
          `Google Drive auto-backup skipped for subject ${subjectId} (Integration not active or disabled).`
        );
        return null;
      }

      // 2. Create pending job record
      const job = await MarksBackupJob.create({
        subjectId,
        semester,
        academicYear,
        departmentId,
        action,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: new Date(),
      });

      logger.info(
        `Created MarksBackupJob ${job.id} for subject ${subjectId}, Sem ${semester} (${action}).`
      );

      // Trigger background processing asynchronously (non-blocking)
      setImmediate(() => {
        this.processPendingJobs().catch((err) => {
          logger.error('BACKGROUND_MARKS_BACKUP_PROCESSOR_ERROR:', err);
        });
      });

      return job;
    } catch (err: any) {
      // Failure to create backup job must NEVER affect marks saving in PostgreSQL
      logger.error('FAILED_TO_QUEUE_MARKS_BACKUP_JOB:', err.message);
      return null;
    }
  },

  /**
   * Processes all pending and retryable marks backup jobs
   */
  async processPendingJobs(): Promise<void> {
    if (isWorkerRunning) {
      return;
    }

    isWorkerRunning = true;

    try {
      const integration = await GoogleDriveIntegration.findOne({
        where: { status: 'CONNECTED' },
      });

      if (!integration || !integration.autoBackupEnabled) {
        return;
      }

      const now = new Date();
      const pendingJobs = await MarksBackupJob.findAll({
        where: {
          status: { [Op.in]: ['PENDING', 'FAILED'] },
          attemptCount: { [Op.lt]: 5 },
          [Op.or]: [{ nextAttemptAt: { [Op.lte]: now } }, { nextAttemptAt: null }],
        },
        order: [['createdAt', 'ASC']],
        limit: 10,
      });

      for (const job of pendingJobs) {
        await this.processSingleJob(job);
      }
    } catch (err: any) {
      logger.error('PROCESS_PENDING_MARKS_BACKUP_JOBS_ERROR:', err);
    } finally {
      isWorkerRunning = false;
    }
  },

  /**
   * Processes an individual marks backup job
   */
  async processSingleJob(job: MarksBackupJob): Promise<void> {
    job.status = 'PROCESSING';
    job.attemptCount += 1;
    job.lastAttemptAt = new Date();
    await job.save();

    try {
      logger.info(`[Marks Backup Worker] Processing job ${job.id} (Attempt ${job.attemptCount}/5)...`);

      // 1. Check existing MarksBackupFile
      let backupFile = await MarksBackupFile.findOne({
        where: {
          academicYear: job.academicYear,
          departmentId: job.departmentId,
          semester: job.semester,
          subjectId: job.subjectId,
        },
      });

      // 2. Generate Excel workbook from PostgreSQL source of truth
      const { buffer, filename, metadata } = await bitwiseMarksExcelService.generateSubjectMarksWorkbook(
        job.subjectId,
        job.semester,
        job.academicYear,
        job.departmentId
      );

      // 3. Ensure target folder hierarchy on Google Drive:
      // JCER ERP Bitwise Marks -> [Dept] -> [AY] -> Semester [N]
      // (Structure matches Attendance: Department precedes Academic Year)
      const targetFolderId = await googleDriveService.ensureMarksSemesterFolderHierarchy(
        metadata.academicYear,
        metadata.departmentCode || 'CSE',
        job.semester
      );

      // 4. Upload / Update workbook on Google Drive (ONE persistent workbook reused via fileId)
      const googleDriveFileId = await googleDriveService.uploadOrUpdateAttendanceWorkbook(
        targetFolderId,
        filename,
        buffer,
        backupFile?.googleDriveFileId || null
      );

      // 5. Update or create backup file registry
      if (backupFile) {
        backupFile.googleDriveFolderId = targetFolderId;
        backupFile.googleDriveFileId = googleDriveFileId;
        backupFile.fileName = filename;
        backupFile.status = 'SYNCED';
        backupFile.lastSyncedAt = new Date();
        backupFile.lastError = null;
        await backupFile.save();
      } else {
        backupFile = await MarksBackupFile.create({
          academicYear: job.academicYear,
          departmentId: job.departmentId,
          semester: job.semester,
          subjectId: job.subjectId,
          googleDriveFolderId: targetFolderId,
          googleDriveFileId,
          fileName: filename,
          status: 'SYNCED',
          lastSyncedAt: new Date(),
        });
      }

      // 6. Update job status to SUCCESS
      job.backupFileId = backupFile.id;
      job.status = 'SUCCESS';
      job.completedAt = new Date();
      job.errorMessage = null;
      await job.save();

      // Update Integration lastSyncAt
      await GoogleDriveIntegration.update(
        { lastSyncAt: new Date(), lastError: null },
        { where: { status: 'CONNECTED' } }
      );

      logger.info(
        `✓ [Marks Backup Worker] Job ${job.id} completed successfully. File: ${filename} (Drive ID: ${googleDriveFileId})`
      );
    } catch (err: any) {
      logger.error(`❌ [Marks Backup Worker] Job ${job.id} failed:`, err.message);

      job.errorMessage = err.message || 'Unknown Google Drive upload error';
      if (job.attemptCount >= job.maxAttempts) {
        job.status = 'FAILED';
      } else {
        job.status = 'PENDING';
        // Exponential backoff: 15s, 30s, 60s, 120s
        const backoffSeconds = Math.pow(2, job.attemptCount) * 15;
        job.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
      }
      await job.save();
    }
  },

  /**
   * Initializes periodic background worker
   */
  startBackgroundWorker(): void {
    if (workerInterval) return;

    logger.info('Starting Google Drive Bitwise Marks Backup background worker (interval: 45s)...');

    // Reconcile department folders and auto-migrate any legacy inverted hierarchy on startup
    googleDriveService.reconcileMarksHierarchy().catch((err: any) => {
      logger.warn('INITIAL_BITWISE_MARKS_HIERARCHY_RECONCILE_NOTICE:', err.message);
    });

    workerInterval = setInterval(() => {
      this.processPendingJobs().catch((err) => {
        logger.error('CRON_MARKS_BACKUP_PROCESSOR_ERROR:', err);
      });
    }, 45000);
  },

  /**
   * Stops background worker
   */
  stopBackgroundWorker(): void {
    if (workerInterval) {
      clearInterval(workerInterval);
      workerInterval = null;
    }
  },

  /**
   * Returns current sync status for a subject & semester
   */
  async getSubjectSyncStatus(
    subjectId: string,
    semester: number,
    academicYear: string
  ): Promise<{
    status: 'NOT_CONFIGURED' | 'SYNCED' | 'PENDING' | 'ERROR';
    lastSyncedAt: Date | null;
    fileName: string | null;
    googleDriveFileId: string | null;
    lastError: string | null;
  }> {
    let cleanAY = (academicYear || '2026-27').trim().replace(/\u2013|\u2014/g, '-');
    const ayMatch = cleanAY.match(/^(\d{4})-\d{2}(\d{2})$/);
    if (ayMatch) {
      cleanAY = `${ayMatch[1]}-${ayMatch[2]}`;
    }

    const backupFile = await MarksBackupFile.findOne({
      where: {
        academicYear: { [Op.in]: [cleanAY, academicYear] },
        semester,
        subjectId,
      },
    });

    const activeJob = await MarksBackupJob.findOne({
      where: {
        academicYear: { [Op.in]: [cleanAY, academicYear] },
        semester,
        subjectId,
      },
      order: [['updatedAt', 'DESC']],
    });

    if (activeJob) {
      if (activeJob.status === 'FAILED') {
        return {
          status: 'ERROR',
          lastSyncedAt: backupFile?.lastSyncedAt || null,
          fileName: backupFile?.fileName || null,
          googleDriveFileId: backupFile?.googleDriveFileId || null,
          lastError: activeJob.errorMessage || backupFile?.lastError || 'Drive sync failed',
        };
      }
      if (activeJob.status === 'PENDING' || activeJob.status === 'PROCESSING') {
        return {
          status: 'PENDING',
          lastSyncedAt: backupFile?.lastSyncedAt || null,
          fileName: backupFile?.fileName || null,
          googleDriveFileId: backupFile?.googleDriveFileId || null,
          lastError: null,
        };
      }
    }

    if (!backupFile) {
      return {
        status: 'NOT_CONFIGURED',
        lastSyncedAt: null,
        fileName: null,
        googleDriveFileId: null,
        lastError: null,
      };
    }

    return {
      status: backupFile.status === 'SYNCED' ? 'SYNCED' : backupFile.status === 'ERROR' ? 'ERROR' : 'PENDING',
      lastSyncedAt: backupFile.lastSyncedAt,
      fileName: backupFile.fileName,
      googleDriveFileId: backupFile.googleDriveFileId,
      lastError: backupFile.lastError,
    };
  },
};

export default bitwiseMarksBackupQueueService;
