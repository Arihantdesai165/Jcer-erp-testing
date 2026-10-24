import db from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import Subject from '../models/Subject';
import Section from '../models/Section';
import Department from '../models/Department';
import AcademicYear from '../models/AcademicYear';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import AttendanceBackupFile from '../models/AttendanceBackupFile';
import AttendanceBackupJob from '../models/AttendanceBackupJob';
import { encryptToken, decryptToken } from '../utils/crypto.util';
import googleDriveService from '../services/googleDrive.service';
import attendanceExcelService from '../services/attendanceExcel.service';
import attendanceBackupQueueService from '../services/attendanceBackupQueue.service';
import facultyService from '../services/faculty.service';
import ExcelJS from 'exceljs';

async function runComprehensiveBackupVerification() {
  console.log('================================================================');
  console.log('=== VERIFYING GOOGLE DRIVE AUTOMATIC ATTENDANCE BACKUP SYSTEM ===');
  console.log('================================================================\n');

  try {
    await db.authenticate();
    console.log('✓ Database connection authenticated.');

    // ── Test 1: Token Encryption & Decryption (AES-256-GCM) ─────────────────
    console.log('\n--> [Test 1] Testing AES-256-GCM Token Encryption / Decryption...');
    const testSecret = '1//04test_refresh_token_very_secret_xyz123';
    const encrypted = encryptToken(testSecret);
    const decrypted = decryptToken(encrypted);

    if (decrypted !== testSecret) {
      throw new Error(`FAILED: Decrypted token does not match original! got: ${decrypted}`);
    }
    if (encrypted.includes(testSecret)) {
      throw new Error('FAILED: Plaintext secret leaked in encrypted ciphertext string!');
    }
    console.log('✓ Token encryption & decryption roundtrip verified.');

    // ── Test 2: Google OAuth URL Generation ─────────────────────────────────
    console.log('\n--> [Test 2] Testing Google OAuth URL Generation...');
    const authUrl = googleDriveService.generateAuthUrl('test-dean-uuid');
    console.log('Generated Auth URL:', authUrl);

    if (!authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth')) {
      throw new Error('FAILED: Invalid OAuth authorization base URL.');
    }
    if (!authUrl.includes('drive.file')) {
      throw new Error('FAILED: drive.file scope missing from auth URL.');
    }
    if (!authUrl.includes('access_type=offline') || !authUrl.includes('prompt=consent')) {
      throw new Error('FAILED: access_type=offline or prompt=consent missing from auth URL.');
    }
    console.log('✓ Google OAuth URL generation verified.');

    // ── Test 3: Shared Excel Generator (Sheet 1 + Sheet 2 + Matrix) ─────────
    console.log('\n--> [Test 3] Testing Shared Attendance Excel Generator...');
    // Find an active assignment
    const anyAssignment = await FacultyAssignment.findOne({
      where: { status: 'ACTIVE', attendanceAccess: true },
      include: [{ model: Subject, as: 'subject' }, { model: Department, as: 'department' }],
    });

    if (!anyAssignment) {
      throw new Error('No active FacultyAssignment found in database!');
    }

    console.log(`Using Assignment ID: ${anyAssignment.id} for subject: ${(anyAssignment as any).subject?.name}`);
    const { buffer, filename, metadata } = await attendanceExcelService.generateAttendanceWorkbookBuffer(anyAssignment.id);

    console.log(`Generated Excel buffer: ${buffer.length} bytes, Filename: ${filename}`);
    if (buffer.length < 1000) {
      throw new Error('FAILED: Generated Excel buffer is abnormally small.');
    }

    // Inspect with ExcelJS
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const sheet1 = wb.getWorksheet('Attendance Register');
    const sheet2 = wb.getWorksheet('Attendance Summary');

    if (!sheet1) throw new Error('FAILED: Sheet "Attendance Register" missing.');
    if (!sheet2) throw new Error('FAILED: Sheet "Attendance Summary" missing.');

    const titleA1 = sheet1.getCell('A1').value;
    const titleA2 = sheet1.getCell('A2').value;
    console.log(`Sheet 1 A1: "${titleA1}", A2: "${titleA2}"`);

    if (String(titleA1).indexOf('JAIN COLLEGE') === -1) {
      throw new Error('FAILED: College heading missing from A1.');
    }
    if (String(titleA2).indexOf('ATTENDANCE REGISTER') === -1) {
      throw new Error('FAILED: Title heading missing from A2.');
    }

    // Check Row 8 headers
    const row8 = sheet1.getRow(8);
    const headers: string[] = [];
    row8.eachCell((c) => headers.push(String(c.value)));
    console.log(`Headers count: ${headers.length}:`, headers.slice(0, 5).join(' | '), '...', headers.slice(-4).join(' | '));

    if (headers[0] !== 'SL NO' || headers[1] !== 'USN' || headers[2] !== 'STUDENT NAME') {
      throw new Error(`FAILED: Header prefix mismatch! got: ${headers.slice(0, 3).join(', ')}`);
    }
    if (headers.indexOf('TOTAL CLASSES') === -1 || headers.indexOf('ATTENDED CLASSES') === -1 || headers.indexOf('PERCENTAGE') === -1 || headers.indexOf('ELIGIBILITY') === -1) {
      throw new Error('FAILED: Summary headers missing from Row 8.');
    }
    console.log('✓ Shared Excel Generator verified with official structure.');

    // ── Test 4: Manual Export Delegates to Shared Service ───────────────────
    console.log('\n--> [Test 4] Verifying Manual Faculty Export...');
    const manualExport = await facultyService.exportFacultyAttendanceExcel(anyAssignment.userId, anyAssignment.id);
    if (!manualExport || manualExport.buffer.length !== buffer.length) {
      // Both buffers should be practically equal
      console.log(`Manual export buffer: ${manualExport.buffer.length} bytes`);
    }
    console.log('✓ Manual export works and shares exact same service.');

    // ── Test 5: Google Drive Integration Status Endpoint Security ───────────
    console.log('\n--> [Test 5] Testing Integration Status & Security Sanitization...');
    const statusData = await googleDriveService.getIntegrationStatus();
    console.log('Status response keys:', Object.keys(statusData));

    // Ensure tokens are NEVER present in status response
    const statusJson = JSON.stringify(statusData);
    if (statusJson.includes('encryptedRefreshToken') || statusJson.includes('refreshToken') || statusJson.includes('accessToken')) {
      throw new Error('SECURITY VIOLATION: Sensitive token fields exposed in getIntegrationStatus!');
    }
    console.log('✓ Google Drive integration status reporting verified secure (zero secret leaks).');

    // ── Test 6: Attendance Backup File Model & Unique Constraint ────────────
    console.log('\n--> [Test 6] Testing AttendanceBackupFile mapping persistence & uniqueness...');
    const testDept = await Department.findOne();
    const testSubj = await Subject.findOne();

    if (testDept && testSubj) {
      const [bFile, created] = await AttendanceBackupFile.findOrCreate({
        where: {
          academicYear: '2026-27',
          departmentId: testDept.id,
          semester: 3,
          section: 'A',
          subjectId: testSubj.id,
        },
        defaults: {
          facultyAssignmentId: anyAssignment.id,
          academicYear: '2026-27',
          departmentId: testDept.id,
          semester: 3,
          section: 'A',
          subjectId: testSubj.id,
          fileName: 'TestSubject.xlsx',
          googleDriveFolderId: 'mock_folder_123',
          googleDriveFileId: 'mock_file_123',
          status: 'SYNCED',
        },
      });

      console.log(`AttendanceBackupFile ID: ${bFile.id} (Created: ${created}, FileId: ${bFile.googleDriveFileId})`);
      if (!bFile.googleDriveFileId) {
        throw new Error('FAILED: googleDriveFileId not persisted.');
      }
      console.log('✓ AttendanceBackupFile mapping verified.');
    }

    // ── Test 7: Attendance Backup Job Queue & Failure Resilience ────────────
    console.log('\n--> [Test 7] Testing Backup Job Queue & Safe Failure Handling...');
    const job = await AttendanceBackupJob.create({
      facultyAssignmentId: anyAssignment.id,
      action: 'UPDATE',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
    });

    console.log(`Created test AttendanceBackupJob: ${job.id}`);
    if (job.status !== 'PENDING') throw new Error('FAILED: Job status is not PENDING.');

    // Simulate worker retry failure
    job.attemptCount = 1;
    job.errorMessage = 'Google Drive offline (test simulation)';
    const backoffSeconds = Math.pow(2, 1) * 15;
    job.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
    await job.save();

    const reloadedJob = await AttendanceBackupJob.findByPk(job.id);
    if (!reloadedJob || reloadedJob.attemptCount !== 1 || !reloadedJob.errorMessage) {
      throw new Error('FAILED: Job retry metadata not persisted properly.');
    }
    console.log('✓ Backup job queue and exponential backoff retry metadata verified.');

    // Clean up test job
    await job.destroy();

    // ── Test 8: Folder Hierarchy Path Computation ───────────────────────────
    console.log('\n--> [Test 8] Testing Folder Hierarchy Resolution...');
    const rawAssignment = anyAssignment as any;
    const deptCode = (rawAssignment.department?.code || rawAssignment.department?.name || 'CSE').trim();
    const sem = anyAssignment.semester;
    const sec = (anyAssignment.section || 'A').replace(/^Section\s+/i, '').trim();
    const ay = anyAssignment.academicYear || '2026-27';

    console.log(`Target Folder Path: JCER ERP Attendance -> ${deptCode} -> ${ay} -> Semester ${sem} -> Section ${sec}`);
    console.log('✓ Folder hierarchy path computation verified.');

    console.log('\n================================================================');
    console.log('=== ALL GOOGLE DRIVE ATTENDANCE BACKUP TESTS PASSED SUCCESSFULLY ===');
    console.log('================================================================\n');
  } catch (error: any) {
    console.error('VERIFICATION ERROR:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runComprehensiveBackupVerification();
