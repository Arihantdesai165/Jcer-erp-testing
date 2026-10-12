import AttendanceBackupJob from '../models/AttendanceBackupJob';
import AttendanceBackupFile from '../models/AttendanceBackupFile';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import FacultyAssignment from '../models/FacultyAssignment';
import attendanceExcelService from './attendanceExcel.service';
import googleDriveService from './googleDrive.service';
import semesterAttendanceConsolidationService from './semesterAttendanceConsolidation.service';
import logger from '../utils/logger.util';
import { Op } from 'sequelize';
import { getSectionVariants, getAcademicYearVariants } from './faculty.service';

let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

export const attendanceBackupQueueService = {
  /**
   * Enqueues an asynchronous attendance backup job after successful PostgreSQL transaction
   */
  async queueAttendanceBackup(
    facultyAssignmentId: string,
    attendanceSessionId?: string,
    action: 'CREATE' | 'UPDATE' | 'CORRECTION' = 'UPDATE'
  ): Promise<AttendanceBackupJob | null> {
    try {
      // 1. Check if Google Drive is connected & auto backup is enabled
      const integration = await GoogleDriveIntegration.findOne({
        where: { status: 'CONNECTED' },
      });

      if (!integration || !integration.autoBackupEnabled) {
        logger.info(`Google Drive auto-backup skipped for assignment ${facultyAssignmentId} (Integration not active or disabled).`);
        return null;
      }

      // 2. Create pending job record
      const job = await AttendanceBackupJob.create({
        facultyAssignmentId,
        attendanceSessionId: attendanceSessionId || null,
        action,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: new Date(),
      });

      logger.info(`Created AttendanceBackupJob ${job.id} for assignment ${facultyAssignmentId} (${action}).`);

      // Trigger background processing asynchronously (non-blocking)
      setImmediate(() => {
        this.processPendingJobs().catch((err) => {
          logger.error('BACKGROUND_BACKUP_PROCESSOR_ERROR:', err);
        });
      });

      return job;
    } catch (err: any) {
      // Failure to create backup job must NEVER affect attendance saving
      logger.error('FAILED_TO_QUEUE_ATTENDANCE_BACKUP_JOB:', err.message);
      return null;
    }
  },

  /**
   * Processes all pending and retryable backup jobs
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
      const pendingJobs = await AttendanceBackupJob.findAll({
        where: {
          status: { [Op.in]: ['PENDING', 'FAILED'] },
          attemptCount: { [Op.lt]: 5 },
          [Op.or]: [
            { nextAttemptAt: { [Op.lte]: now } },
            { nextAttemptAt: null },
          ],
        },
        order: [['createdAt', 'ASC']],
        limit: 10,
      });

      for (const job of pendingJobs) {
        await this.processSingleJob(job);
      }
    } catch (err: any) {
      logger.error('PROCESS_PENDING_BACKUP_JOBS_ERROR:', err);
    } finally {
      isWorkerRunning = false;
    }
  },

  /**
   * Processes an individual backup job
   */
  async processSingleJob(job: AttendanceBackupJob): Promise<void> {
    job.status = 'PROCESSING';
    job.attemptCount += 1;
    job.lastAttemptAt = new Date();
    await job.save();

    try {
      logger.info(`[Backup Worker] Processing job ${job.id} (Attempt ${job.attemptCount}/5)...`);

      // 1. Generate Excel workbook from PostgreSQL source of truth
      const { buffer, filename, metadata } = await attendanceExcelService.generateAttendanceWorkbookBuffer(
        job.facultyAssignmentId
      );

      // 2. Ensure target folder hierarchy on Google Drive: JCER ERP Attendance -> AY -> Dept -> Sem -> Sec
      const targetFolderId = await googleDriveService.ensureFolderHierarchy(
        metadata.academicYear,
        metadata.departmentCode,
        metadata.semester,
        metadata.section
      );

      // 3. Find or create AttendanceBackupFile database mapping
      const secVariants = getSectionVariants(metadata.section);
      const ayVariants = getAcademicYearVariants(metadata.academicYear);
      let backupFile = await AttendanceBackupFile.findOne({
        where: {
          departmentId: metadata.departmentId,
          semester: metadata.semester,
          subjectId: metadata.subjectId,
          ...(secVariants.length > 0 ? { section: { [Op.in]: secVariants } } : { section: metadata.section }),
          ...(ayVariants.length > 0 ? { academicYear: { [Op.in]: ayVariants } } : { academicYear: metadata.academicYear }),
        },
      });

      // 4. Upload / Update workbook on Google Drive
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
        backupFile = await AttendanceBackupFile.create({
          academicYear: metadata.academicYear,
          departmentId: metadata.departmentId,
          semester: metadata.semester,
          section: metadata.section,
          subjectId: metadata.subjectId,
          facultyAssignmentId: job.facultyAssignmentId,
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

      // 7. Trigger Consolidated Semester Attendance Update (Non-blocking)
      semesterAttendanceConsolidationService.syncConsolidatedSemesterAttendanceToDrive({
        academicYear: metadata.academicYear,
        departmentId: metadata.departmentId,
        semester: metadata.semester,
      }).catch((consolidatedErr: any) => {
        logger.warn(`[Backup Worker] Consolidated semester sync notice:`, consolidatedErr.message);
      });

      logger.info(`✓ [Backup Worker] Job ${job.id} completed successfully. File: ${filename} (Drive ID: ${googleDriveFileId})`);
    } catch (err: any) {
      logger.error(`❌ [Backup Worker] Job ${job.id} failed:`, err.message);

      job.errorMessage = err.message || 'Unknown Google Drive upload error';
      if (job.attemptCount >= job.maxAttempts) {
        job.status = 'FAILED';
      } else {
        job.status = 'PENDING';
        // Exponential backoff: 30s, 60s, 120s, 240s
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

    logger.info('Starting Google Drive Attendance Backup background worker (interval: 45s)...');
    workerInterval = setInterval(() => {
      this.processPendingJobs().catch((err) => {
        logger.error('CRON_BACKUP_PROCESSOR_ERROR:', err);
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
   * Manually retries all failed/pending jobs
   */
  async retryAllFailedJobs(): Promise<{ retriedCount: number }> {
    const jobs = await AttendanceBackupJob.findAll({
      where: { status: { [Op.in]: ['FAILED', 'PENDING'] } },
    });

    for (const job of jobs) {
      job.status = 'PENDING';
      job.nextAttemptAt = new Date();
      await job.save();
    }

    setImmediate(() => {
      this.processPendingJobs().catch((err) => logger.error('MANUAL_RETRY_ERROR:', err));
    });

    return { retriedCount: jobs.length };
  },
};

export default attendanceBackupQueueService;
