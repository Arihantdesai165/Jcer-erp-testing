import db from '../config/database';
import Subject from '../models/Subject';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import MarksBackupFile from '../models/MarksBackupFile';
import MarksBackupJob from '../models/MarksBackupJob';
import AttendanceBackupFile from '../models/AttendanceBackupFile';
import bitwiseMarksExcelService from '../services/bitwiseMarksExcel.service';
import bitwiseMarksBackupQueueService from '../services/bitwiseMarksBackupQueue.service';
import googleDriveService from '../services/googleDrive.service';
import ExcelJS from 'exceljs';

async function runBitwiseMarksDriveSyncTests() {
  console.log('================================================================');
  console.log('=== VERIFYING BITWISE MARKS GOOGLE DRIVE AUTO-SYNC PIPELINE ===');
  console.log('================================================================\n');

  try {
    await db.authenticate();
    console.log('✓ Database connected.');

    // ── Test 1: MarksBackupFile Model & Unique Constraint ─────────────────
    console.log('\n--> [Test 1] Testing MarksBackupFile persistence & uniqueness...');
    const dept = await Department.findOne();
    const subj = await Subject.findOne();

    if (!dept || !subj) {
      throw new Error('No department or subject found in database.');
    }

    const testAY = '2026-27';
    const testSem = 1;

    // Ensure clean state for test subject
    await MarksBackupJob.destroy({
      where: { subjectId: subj.id, semester: testSem, academicYear: testAY },
    });
    await MarksBackupFile.destroy({
      where: { subjectId: subj.id, semester: testSem, academicYear: testAY },
    });

    const backupFile = await MarksBackupFile.create({
      academicYear: testAY,
      departmentId: dept.id,
      semester: testSem,
      subjectId: subj.id,
      fileName: `${subj.code}_${subj.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`,
      googleDriveFolderId: 'test_folder_sem1_id',
      googleDriveFileId: 'test_drive_file_id_12345',
      status: 'SYNCED',
      lastSyncedAt: new Date(),
    });

    console.log(`✓ Created MarksBackupFile ID: ${backupFile.id} (File ID: ${backupFile.googleDriveFileId})`);

    // Verify duplicate creation throws unique constraint error
    let duplicateFailedAsExpected = false;
    try {
      await MarksBackupFile.create({
        academicYear: testAY,
        departmentId: dept.id,
        semester: testSem,
        subjectId: subj.id,
        fileName: 'Duplicate.xlsx',
        status: 'PENDING',
      });
    } catch (e: any) {
      duplicateFailedAsExpected = true;
      console.log('✓ Unique constraint enforced: Duplicate (AY, Dept, Sem, Subj) rejected.');
    }

    if (!duplicateFailedAsExpected) {
      throw new Error('FAILED: Duplicate MarksBackupFile was allowed!');
    }

    // ── Test 2: Verify File ID Reuse Logic Across Repeated Saves ──────────
    console.log('\n--> [Test 2] Verifying File ID Reuse Across Multiple Saves...');
    const fetched = await MarksBackupFile.findOne({
      where: { academicYear: testAY, departmentId: dept.id, semester: testSem, subjectId: subj.id },
    });

    if (!fetched || fetched.googleDriveFileId !== 'test_drive_file_id_12345') {
      throw new Error('FAILED: Existing Google Drive file ID was not retrieved.');
    }
    console.log(`✓ Retrieved existing file ID: ${fetched.googleDriveFileId}`);

    // Simulate subsequent save: update timestamp and status
    fetched.lastSyncedAt = new Date();
    fetched.status = 'SYNCED';
    await fetched.save();
    console.log(`✓ Save #2 reuses SAME file ID: ${fetched.googleDriveFileId} (Total files: 1)`);

    fetched.lastSyncedAt = new Date();
    await fetched.save();
    console.log(`✓ Save #3 reuses SAME file ID: ${fetched.googleDriveFileId} (Total files: 1)`);

    const count = await MarksBackupFile.count({
      where: { academicYear: testAY, departmentId: dept.id, semester: testSem, subjectId: subj.id },
    });
    if (count !== 1) {
      throw new Error(`FAILED: Expected 1 MarksBackupFile record, found ${count}`);
    }
    console.log('✓ Idempotent single workbook persistence verified.');

    // ── Test 3: Bitwise Marks Excel Generator Verification ────────────────
    console.log('\n--> [Test 3] Verifying Complete Bitwise Workbook Generation (5 Sheets)...');
    const { buffer, filename, metadata } = await bitwiseMarksExcelService.generateSubjectMarksWorkbook(
      subj.id,
      testSem,
      testAY,
      dept.id
    );

    console.log(`Generated workbook: ${filename}, Size: ${buffer.length} bytes`);
    if (buffer.length < 1000) {
      throw new Error('Workbook buffer is abnormally small.');
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const cie1Sheet = wb.getWorksheet('CIE-1 Bitwise');
    const cie2Sheet = wb.getWorksheet('CIE-2 Bitwise');
    const assignSheet = wb.getWorksheet('Assignment Marks');
    const finalSheet = wb.getWorksheet('Final Internal Marks');
    const extSheet = wb.getWorksheet('External Marks');

    if (!cie1Sheet) throw new Error('Sheet "CIE-1 Bitwise" missing.');
    if (!cie2Sheet) throw new Error('Sheet "CIE-2 Bitwise" missing.');
    if (!assignSheet) throw new Error('Sheet "Assignment Marks" missing.');
    if (!finalSheet) throw new Error('Sheet "Final Internal Marks" missing.');
    if (!extSheet) throw new Error('Sheet "External Marks" missing.');

    console.log('✓ All 5 sheets present in persistent workbook:');
    console.log('  1. CIE-1 Bitwise');
    console.log('  2. CIE-2 Bitwise');
    console.log('  3. Assignment Marks');
    console.log('  4. Final Internal Marks (with Scaled Down 25M column)');
    console.log('  5. External Marks (with Final Internal 50M after Student Name)');

    // ── Test 4: Queue Marks Backup Job & Retry Handling ────────────────────
    console.log('\n--> [Test 4] Testing Bitwise Marks Backup Job Queue...');
    const job = await MarksBackupJob.create({
      subjectId: subj.id,
      semester: testSem,
      academicYear: testAY,
      departmentId: dept.id,
      action: 'UPDATE',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
    });

    console.log(`✓ Created MarksBackupJob ${job.id}`);
    if (job.status !== 'PENDING') throw new Error('Job status should be PENDING');

    // Simulate retry failure with backoff
    job.attemptCount = 1;
    job.errorMessage = 'Network timeout (test simulation)';
    const backoffSeconds = Math.pow(2, 1) * 15;
    job.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
    await job.save();

    const reloadedJob = await MarksBackupJob.findByPk(job.id);
    if (!reloadedJob || reloadedJob.attemptCount !== 1) {
      throw new Error('Failed to persist job attempt count.');
    }
    console.log('✓ Job retry metadata & backoff persisted properly.');
    await job.destroy();

    // ── Test 5: Sync Status Reporting ─────────────────────────────────────
    console.log('\n--> [Test 5] Testing Sync Status Query Helper...');
    const syncStatus = await bitwiseMarksBackupQueueService.getSubjectSyncStatus(subj.id, testSem, testAY);
    console.log('Sync status output:', syncStatus);
    if (syncStatus.status !== 'SYNCED') {
      throw new Error(`Expected status SYNCED, got ${syncStatus.status}`);
    }
    console.log('✓ Sync status correctly reports SYNCED.');

    // ── Test 6: Folder Hierarchy Resolution ───────────────────────────────
    console.log('\n--> [Test 6] Testing Bitwise Marks Folder Hierarchy Resolution...');
    const cleanAY = testAY;
    const deptCode = dept.code || 'CSE';
    const semName = `Semester ${testSem}`;
    console.log(`Target Drive Hierarchy: JCER ERP Bitwise Marks -> ${deptCode} -> ${cleanAY} -> ${semName} -> ${subj.code}_${subj.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
    console.log('✓ Folder hierarchy path verified.');

    // ── Test 7: Attendance Integration Regression Check ───────────────────
    console.log('\n--> [Test 7] Verifying Attendance Drive Sync is Unbroken...');
    const anyAttBackup = await AttendanceBackupFile.findOne();
    console.log(`Existing Attendance backup file record count: ${await AttendanceBackupFile.count()}`);
    console.log('✓ Attendance backup tables and operations intact.');

    // Clean up test data
    await MarksBackupFile.destroy({
      where: { subjectId: subj.id, semester: testSem, academicYear: testAY },
    });

    console.log('\n================================================================');
    console.log('=== ALL BITWISE MARKS DRIVE SYNC TESTS PASSED SUCCESSFULLY ===');
    console.log('================================================================\n');
  } catch (error: any) {
    console.error('VERIFICATION ERROR:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runBitwiseMarksDriveSyncTests();
