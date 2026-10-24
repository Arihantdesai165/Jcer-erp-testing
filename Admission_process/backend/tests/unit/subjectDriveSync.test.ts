import subjectDriveSyncService from '../../src/services/subjectDriveSync.service';
import googleDriveService from '../../src/services/googleDrive.service';
import semesterAttendanceConsolidationService from '../../src/services/semesterAttendanceConsolidation.service';
import AttendanceBackupFile from '../../src/models/AttendanceBackupFile';
import AttendanceBackupJob from '../../src/models/AttendanceBackupJob';
import GoogleDriveIntegration from '../../src/models/GoogleDriveIntegration';
import AuditLog from '../../src/models/AuditLog';

// Mock dependencies
jest.mock('../../src/services/googleDrive.service');
jest.mock('../../src/services/semesterAttendanceConsolidation.service');
jest.mock('../../src/models/AttendanceBackupFile');
jest.mock('../../src/models/AttendanceBackupJob');
jest.mock('../../src/models/GoogleDriveIntegration');
jest.mock('../../src/models/AuditLog');
jest.mock('../../src/utils/logger.util', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Dynamic Subject Deletion & Google Drive Attendance Excel Synchronization', () => {
  const mockSubjectId = 'sub-uuid-101';
  const mockSubjectId2 = 'sub-uuid-102';
  const mockFutureSubjectId = 'future-sub-uuid-999';
  const mockAcademicYear = '2026-27';
  const mockDepartmentId = 'dept-uuid-cse';
  const mockSemester = 1;

  beforeEach(() => {
    jest.clearAllMocks();

    (GoogleDriveIntegration.findOne as jest.Mock).mockResolvedValue({
      status: 'CONNECTED',
      autoBackupEnabled: true,
    });

    (semesterAttendanceConsolidationService.syncConsolidatedSemesterAttendanceToDrive as jest.Mock).mockResolvedValue(true);
    (AuditLog.create as jest.Mock).mockResolvedValue({});
  });

  // Test 1: No attendance history -> Drive workbook deleted and backup file removed
  it('Test 1: No attendance history -> should delete Drive workbook and remove backup file record', async () => {
    const mockFile = {
      id: 'backup-1',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'A',
      googleDriveFileId: 'drive-file-123',
      fileName: 'BCS101.xlsx',
      destroy: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFile]);
    (googleDriveService.deleteFile as jest.Mock).mockResolvedValue(true);

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      userId: 'user-hod-1',
      subjectCode: 'BCS101',
    });

    expect(result.success).toBe(true);
    expect(result.workbooksProcessed).toBe(1);
    expect(googleDriveService.deleteFile).toHaveBeenCalledWith('drive-file-123');
    expect(mockFile.destroy).toHaveBeenCalled();
    expect(semesterAttendanceConsolidationService.syncConsolidatedSemesterAttendanceToDrive).toHaveBeenCalled();
  });

  // Test 2: Attendance exists -> Subject archived -> Historical workbook preserved and marked ARCHIVED
  it('Test 2: Attendance history exists -> should preserve Drive workbook and mark record ARCHIVED', async () => {
    const mockFile = {
      id: 'backup-2',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'A',
      googleDriveFileId: 'drive-file-hist-456',
      fileName: 'BCS101.xlsx',
      status: 'SYNCED',
      archivedAt: null,
      lastSyncedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFile]);
    (googleDriveService.checkFileExists as jest.Mock).mockResolvedValue(true);

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'ARCHIVE',
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      userId: 'user-hod-1',
      subjectCode: 'BCS101',
    });

    expect(result.success).toBe(true);
    expect(result.workbooksProcessed).toBe(1);
    expect(googleDriveService.deleteFile).not.toHaveBeenCalled(); // HISTORICAL WORKBOOK MUST NOT BE DELETED
    expect(mockFile.status).toBe('ARCHIVED');
    expect(mockFile.archivedAt).toBeDefined();
    expect(mockFile.save).toHaveBeenCalled();
  });

  // Test 3: Multi-section subject (Section A + Section B) -> All workbooks processed
  it('Test 3: Subject with Section A + Section B -> should process all section workbooks', async () => {
    const mockFileA = {
      id: 'backup-sec-a',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'A',
      googleDriveFileId: 'drive-file-sec-a',
      fileName: 'BCS101_SecA.xlsx',
      destroy: jest.fn().mockResolvedValue(true),
    };

    const mockFileB = {
      id: 'backup-sec-b',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'B',
      googleDriveFileId: 'drive-file-sec-b',
      fileName: 'BCS101_SecB.xlsx',
      destroy: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFileA, mockFileB]);
    (googleDriveService.deleteFile as jest.Mock).mockResolvedValue(true);

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      userId: 'user-hod-1',
    });

    expect(result.success).toBe(true);
    expect(result.workbooksProcessed).toBe(2);
    expect(googleDriveService.deleteFile).toHaveBeenCalledWith('drive-file-sec-a');
    expect(googleDriveService.deleteFile).toHaveBeenCalledWith('drive-file-sec-b');
  });

  // Test 4: Google Drive API failure -> Marks sync failed without breaking PostgreSQL truth
  it('Test 4: Google Drive API failure -> marks SYNC_FAILED without crashing or throwing', async () => {
    const mockFile = {
      id: 'backup-4',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'A',
      googleDriveFileId: 'drive-file-fail',
      fileName: 'BCS101.xlsx',
      status: 'SYNCED',
      lastSyncAttemptAt: null,
      lastError: null,
      destroy: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFile]);
    (googleDriveService.deleteFile as jest.Mock).mockRejectedValue(new Error('Drive API Network Timeout'));

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      userId: 'user-hod-1',
    });

    expect(result.success).toBe(false);
    expect(result.workbooksFailed).toBe(1);
    expect(mockFile.status).toBe('SYNC_FAILED');
    expect(mockFile.lastError).toContain('Drive API Network Timeout');
    expect(mockFile.save).toHaveBeenCalled();
  });

  // Test 5: Subject restored -> existing Drive workbook reused if available
  it('Test 5: Subject restored -> should verify and reuse existing Drive file', async () => {
    const mockFile = {
      id: 'backup-restore',
      subjectId: mockSubjectId,
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      section: 'A',
      googleDriveFileId: 'drive-file-existing',
      status: 'ARCHIVED',
      archivedAt: new Date(),
      lastSyncedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFile]);
    (googleDriveService.checkFileExists as jest.Mock).mockResolvedValue(true);

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'RESTORE',
      academicYear: mockAcademicYear,
      departmentId: mockDepartmentId,
      semester: mockSemester,
      userId: 'user-hod-1',
    });

    expect(result.success).toBe(true);
    expect(result.workbooksProcessed).toBe(1);
    expect(mockFile.status).toBe('SYNCED');
    expect(mockFile.archivedAt).toBeNull();
    expect(mockFile.save).toHaveBeenCalled();
  });

  // Test 6: Deleting subject 1 never affects subject 2's workbooks
  it('Test 6: Deleting subject 1 must only target files scoped to subject 1 UUID', async () => {
    (AttendanceBackupFile.findAll as jest.Mock).mockImplementation(({ where }) => {
      if (where.subjectId === mockSubjectId) {
        return Promise.resolve([
          {
            id: 'backup-sub1',
            subjectId: mockSubjectId,
            googleDriveFileId: 'drive-file-sub1',
            destroy: jest.fn().mockResolvedValue(true),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    (googleDriveService.deleteFile as jest.Mock).mockResolvedValue(true);

    await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
    });

    expect(AttendanceBackupFile.findAll).toHaveBeenCalledWith({
      where: { subjectId: mockSubjectId },
    });
    expect(googleDriveService.deleteFile).toHaveBeenCalledWith('drive-file-sub1');
    expect(googleDriveService.deleteFile).not.toHaveBeenCalledWith('drive-file-sub2');
  });

  // Test 7: Future dynamic subject without hardcoded code
  it('Test 7: Future dynamic subject (e.g. BCS899 / AIML701) should work automatically without hardcoded code', async () => {
    const mockFutureFile = {
      id: 'backup-future',
      subjectId: mockFutureSubjectId,
      academicYear: '2028-29',
      departmentId: 'dept-aiml',
      semester: 8,
      section: 'C',
      googleDriveFileId: 'drive-future-file-999',
      fileName: 'AIML701_SecC.xlsx',
      destroy: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFutureFile]);
    (googleDriveService.deleteFile as jest.Mock).mockResolvedValue(true);

    const result = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockFutureSubjectId,
      action: 'DELETE',
      subjectCode: 'AIML701',
    });

    expect(result.success).toBe(true);
    expect(result.workbooksProcessed).toBe(1);
    expect(googleDriveService.deleteFile).toHaveBeenCalledWith('drive-future-file-999');
  });

  // Test 8: Repeated calls / retries are idempotent
  it('Test 8: Repeated delete calls are idempotent and handle 404 cleanly', async () => {
    const mockFile = {
      id: 'backup-idemp',
      subjectId: mockSubjectId,
      googleDriveFileId: 'drive-file-already-gone',
      destroy: jest.fn().mockResolvedValue(true),
    };

    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([mockFile]);
    // Google Drive returns 404 (already deleted), deleteFile handles it cleanly
    (googleDriveService.deleteFile as jest.Mock).mockResolvedValue(true);

    const result1 = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
    });

    expect(result1.success).toBe(true);

    // Second call with empty backup files list
    (AttendanceBackupFile.findAll as jest.Mock).mockResolvedValue([]);
    const result2 = await subjectDriveSyncService.syncSubjectLifecycle({
      subjectId: mockSubjectId,
      action: 'DELETE',
    });

    expect(result2.success).toBe(true);
    expect(result2.workbooksProcessed).toBe(0);
  });
});
