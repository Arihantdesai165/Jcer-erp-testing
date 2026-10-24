import AttendanceBackupFile from '../models/AttendanceBackupFile';
import AttendanceBackupJob from '../models/AttendanceBackupJob';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import googleDriveService from './googleDrive.service';
import semesterAttendanceConsolidationService from './semesterAttendanceConsolidation.service';
import attendanceBackupQueueService from './attendanceBackupQueue.service';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger.util';

export interface SubjectDriveSyncPayload {
  subjectId: string;
  action: 'ARCHIVE' | 'DELETE' | 'RESTORE';
  academicYear?: string;
  departmentId?: string;
  semester?: number;
  userId?: string;
  userRole?: string;
  subjectCode?: string;
  subjectName?: string;
}

export interface SubjectDriveSyncResult {
  success: boolean;
  action: 'ARCHIVE' | 'DELETE' | 'RESTORE';
  subjectId: string;
  workbooksProcessed: number;
  workbooksFailed: number;
  errors: string[];
}

export const subjectDriveSyncService = {
  /**
   * Dynamically synchronizes Google Drive attendance backups with Subject lifecycle operations.
   * Completely dynamic for every subject without any hardcoded subject codes.
   */
  async syncSubjectLifecycle(payload: SubjectDriveSyncPayload): Promise<SubjectDriveSyncResult> {
    const { subjectId, action, academicYear, departmentId, semester, userId, userRole, subjectCode, subjectName } = payload;
    const errors: string[] = [];
    let workbooksProcessed = 0;
    let workbooksFailed = 0;

    logger.info(`[Subject Drive Sync] Starting dynamic ${action} synchronization for subject ${subjectId} (${subjectCode || 'N/A'})...`);

    try {
      // 1. Check if Google Drive Integration is connected
      const integration = await GoogleDriveIntegration.findOne({
        where: { status: 'CONNECTED' },
      });

      const isDriveConnected = Boolean(integration && integration.autoBackupEnabled);

      // 2. Authoritatively locate all AttendanceBackupFile records across ALL sections for this subject
      const backupFiles = await AttendanceBackupFile.findAll({
        where: { subjectId },
      });

      logger.info(`[Subject Drive Sync] Found ${backupFiles.length} backup file records for subject ${subjectId}.`);

      // Keep track of unique cohorts to update consolidated semester registers
      const cohortKeys = new Set<string>();
      if (academicYear && departmentId && semester) {
        cohortKeys.add(`${academicYear}|${departmentId}|${semester}`);
      }

      for (const file of backupFiles) {
        cohortKeys.add(`${file.academicYear}|${file.departmentId}|${file.semester}`);
      }

      // 3. Process each workbook based on requested lifecycle action
      if (action === 'DELETE') {
        // CASE A: No attendance history exists -> Delete unused Drive workbook(s)
        for (const file of backupFiles) {
          try {
            if (isDriveConnected && file.googleDriveFileId) {
              await googleDriveService.deleteFile(file.googleDriveFileId);
              logger.info(`[Subject Drive Sync] Successfully deleted Drive workbook ${file.googleDriveFileId} (${file.fileName}) for section ${file.section}`);
            }

            // Remove the backup file record from DB
            await file.destroy();
            workbooksProcessed++;
          } catch (fileErr: any) {
            workbooksFailed++;
            const errMsg = `Failed to delete Drive file ${file.googleDriveFileId}: ${fileErr.message}`;
            errors.push(errMsg);
            logger.error(`[Subject Drive Sync] ${errMsg}`);

            // Mark sync failed in DB without rolling back PostgreSQL subject deletion
            file.status = 'SYNC_FAILED';
            file.lastSyncAttemptAt = new Date();
            file.lastError = fileErr.message;
            await file.save().catch(() => {});
          }
        }

        // Cancel any pending backup jobs for this subject
        try {
          await AttendanceBackupJob.destroy({
            where: {
              backupFileId: backupFiles.map((b) => b.id),
            },
          });
        } catch {
          // Ignore
        }

        // Audit log Drive deletion
        if (userId) {
          await AuditLog.create({
            userId,
            action: errors.length === 0 ? 'SUBJECT_DRIVE_DELETED' : 'SUBJECT_DRIVE_SYNC_FAILED',
            details: JSON.stringify({
              subjectId,
              subjectCode,
              subjectName,
              action: 'DELETE',
              workbooksProcessed,
              workbooksFailed,
              errors,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      } else if (action === 'ARCHIVE') {
        // CASE B: Historical attendance exists -> Preserve historical workbook & mark ARCHIVED
        for (const file of backupFiles) {
          try {
            if (isDriveConnected && file.googleDriveFileId) {
              // Verify file still exists in Google Drive
              await googleDriveService.checkFileExists(file.googleDriveFileId);
            }

            file.status = 'ARCHIVED';
            file.archivedAt = new Date();
            file.lastSyncedAt = new Date();
            file.lastError = null;
            await file.save();
            workbooksProcessed++;
            logger.info(`[Subject Drive Sync] Archived backup record ${file.id} (${file.fileName}) for section ${file.section}`);
          } catch (fileErr: any) {
            workbooksFailed++;
            const errMsg = `Failed to archive backup record ${file.id}: ${fileErr.message}`;
            errors.push(errMsg);
            logger.error(`[Subject Drive Sync] ${errMsg}`);
          }
        }

        // Audit log Drive archival
        if (userId) {
          await AuditLog.create({
            userId,
            action: errors.length === 0 ? 'SUBJECT_DRIVE_ARCHIVED' : 'SUBJECT_DRIVE_SYNC_FAILED',
            details: JSON.stringify({
              subjectId,
              subjectCode,
              subjectName,
              action: 'ARCHIVE',
              workbooksProcessed,
              workbooksFailed,
              errors,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      } else if (action === 'RESTORE') {
        // Subject restored: reconnect to existing Drive workbooks or trigger backup creation
        for (const file of backupFiles) {
          try {
            let fileExists = false;
            if (isDriveConnected && file.googleDriveFileId) {
              fileExists = await googleDriveService.checkFileExists(file.googleDriveFileId);
            }

            if (fileExists) {
              file.status = 'SYNCED';
              file.archivedAt = null;
              file.lastSyncedAt = new Date();
              file.lastError = null;
              await file.save();
              workbooksProcessed++;
            } else {
              file.status = 'PENDING';
              file.archivedAt = null;
              await file.save();
              if (file.facultyAssignmentId) {
                await attendanceBackupQueueService.queueAttendanceBackup(file.facultyAssignmentId, undefined, 'UPDATE');
              }
              workbooksProcessed++;
            }
          } catch (fileErr: any) {
            workbooksFailed++;
            errors.push(fileErr.message);
          }
        }
      }

      // 4. Regenerate consolidated semester registers for all affected cohorts
      if (isDriveConnected) {
        for (const cohort of cohortKeys) {
          const [ay, deptId, semStr] = cohort.split('|');
          const sem = parseInt(semStr, 10);
          if (ay && deptId && !isNaN(sem)) {
            semesterAttendanceConsolidationService
              .syncConsolidatedSemesterAttendanceToDrive({
                academicYear: ay,
                departmentId: deptId,
                semester: sem,
              })
              .catch((consolidatedErr: any) => {
                logger.warn(`[Subject Drive Sync] Consolidated sync notice for ${cohort}:`, consolidatedErr.message);
              });
          }
        }
      }

      return {
        success: errors.length === 0,
        action,
        subjectId,
        workbooksProcessed,
        workbooksFailed,
        errors,
      };
    } catch (err: any) {
      logger.error(`[Subject Drive Sync] Critical error syncing subject ${subjectId}:`, err);
      return {
        success: false,
        action,
        subjectId,
        workbooksProcessed,
        workbooksFailed,
        errors: [err.message || 'Unknown subject drive synchronization failure'],
      };
    }
  },
};

export default subjectDriveSyncService;
