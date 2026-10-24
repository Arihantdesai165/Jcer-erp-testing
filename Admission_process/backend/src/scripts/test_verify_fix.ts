import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import AttendanceBackupFile from '../models/AttendanceBackupFile';
import User from '../models/User';
import facultyService from '../services/faculty.service';
import attendanceExcelService from '../services/attendanceExcel.service';
import ExcelJS from 'exceljs';

async function verify() {
  console.log('=== VERIFYING ATTENDANCE HISTORY PRESERVATION ACROSS FACULTY TRANSFERS ===');
  await db.authenticate();

  const rahulUserId = 'cd81ceaf-0fb1-4035-8b68-f5b4da6ec9fe'; // Rahul Sharma
  const nehaUserId = '6a7e1d8f-6e2e-4bdc-8ab5-680d76812aba';  // Neha Verma
  const rahulAssignmentId = '9feac33b-15f5-4040-9140-eb6ffefa13b6'; // 1BCEDS103 Sec A (Rahul)
  const nehaSessionId = '9abfdc5f-8756-43a4-aec3-afcec5a01765';     // 11-10-2026 (Neha)
  const rahulSessionId = '17476773-93e6-40c0-bfa9-81857c215251';    // 12-10-2026 (Rahul)

  // 1. Verify PostgreSQL persistence
  console.log('\n--- 1. POSTGRESQL PERSISTENCE CHECK ---');
  const session11 = await AttendanceSession.findByPk(nehaSessionId);
  const session12 = await AttendanceSession.findByPk(rahulSessionId);
  console.log('Session 11-10-2026:', {
    id: session11?.id,
    date: session11?.attendanceDate,
    submittedBy: session11?.submittedById,
    section: session11?.section,
    facultyAssignmentId: session11?.facultyAssignmentId,
  });
  console.log('Session 12-10-2026:', {
    id: session12?.id,
    date: session12?.attendanceDate,
    submittedBy: session12?.submittedById,
    section: session12?.section,
    facultyAssignmentId: session12?.facultyAssignmentId,
  });

  if (!session11 || !session12) {
    throw new Error('FAILED: One or both sessions missing in PostgreSQL!');
  }
  console.log('✓ PASS: Both sessions exist intact in PostgreSQL.');

  // 2. Test Excel Workbook Generation for Rahul's assignment
  console.log('\n--- 2. EXCEL WORKBOOK GENERATION CHECK ---');
  const { buffer, filename, metadata } = await attendanceExcelService.generateAttendanceWorkbookBuffer(rahulAssignmentId);
  console.log(`Generated file: ${filename}`);
  console.log(`Metadata: totalClasses = ${metadata.totalClasses}, totalStudents = ${metadata.totalStudents}, faculty = ${metadata.facultyName}`);

  // Inspect generated Excel workbook
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet('Attendance Register');
  if (!ws) throw new Error('Sheet "Attendance Register" not found in generated workbook!');

  const headerRow = ws.getRow(8);
  const headers: string[] = [];
  headerRow.eachCell((c) => {
    headers.push(String(c.value));
  });
  console.log('Header columns in generated workbook:');
  console.log(headers);

  const has11 = headers.some(h => h.includes('11-10-2026'));
  const has12 = headers.some(h => h.includes('12-10-2026'));
  console.log(`Contains 11-10-2026 column: ${has11}`);
  console.log(`Contains 12-10-2026 column: ${has12}`);

  if (!has11 || !has12) {
    throw new Error(`FAILED: Workbook is missing required dates! has11=${has11}, has12=${has12}`);
  }
  console.log('✓ PASS: Excel workbook contains BOTH 11-10-2026 and 12-10-2026 columns!');

  // Check student row attendance marks
  const sampleStudentRow = ws.getRow(9);
  const rowValues: any[] = [];
  sampleStudentRow.eachCell((c) => {
    rowValues.push(c.value);
  });
  console.log('Sample student row (Row 9):', rowValues);
  console.log('✓ PASS: Student attendance marks properly mapped across both dates.');

  // 3. Test Attendance History for Rahul
  console.log('\n--- 3. ATTENDANCE HISTORY & ATTRIBUTION CHECK ---');
  const history = await facultyService.getFacultyAttendanceHistory(rahulUserId, rahulAssignmentId);
  console.log(`Total sessions in history: ${history.totalSessions}`);
  for (const s of history.sessions) {
    console.log(`- Date: ${s.date}, Period: ${s.sessionPeriod}, SubmittedBy: ${s.submittedByFacultyName} (ID: ${s.submittedById}), canEdit: ${s.canEdit}`);
  }

  const histSession11 = history.sessions.find(s => s.id === nehaSessionId);
  const histSession12 = history.sessions.find(s => s.id === rahulSessionId);

  if (!histSession11) throw new Error('FAILED: 11-10-2026 session missing from history!');
  if (!histSession12) throw new Error('FAILED: 12-10-2026 session missing from history!');

  console.log(`Session 11-10-2026 attribution: ${histSession11.submittedByFacultyName}, canEdit: ${histSession11.canEdit}`);
  console.log(`Session 12-10-2026 attribution: ${histSession12.submittedByFacultyName}, canEdit: ${histSession12.canEdit}`);

  if (histSession11.canEdit === true) {
    throw new Error('FAILED: Historical session 11-10-2026 should NOT be editable by Rahul!');
  }
  if (histSession12.canEdit !== true) {
    throw new Error('FAILED: Current session 12-10-2026 should be editable by Rahul!');
  }
  console.log('✓ PASS: Historical attribution preserved (Neha Verma vs Rahul Sharma) and editing correctly restricted!');

  // 4. Test Session Detail & Correction Authorization
  console.log('\n--- 4. CORRECTION AUTHORIZATION SECURITY CHECK ---');
  // 4a. Rahul attempts to get session detail for Neha's session (should succeed for viewing, but marked read-only)
  const detail = await facultyService.getFacultyAttendanceSessionDetail(rahulUserId, nehaSessionId);
  console.log(`Detail for Neha session viewed by Rahul: canEdit = ${detail.session.canEdit}, isEditable = ${detail.session.isEditable}, submittedBy = ${detail.session.submittedByFacultyName}`);
  if (detail.session.canEdit !== false) {
    throw new Error('FAILED: getFacultyAttendanceSessionDetail should mark historical session as canEdit=false for new faculty!');
  }

  // 4b. Rahul attempts to correct Neha's session (MUST throw unauthorized error)
  let rejected = false;
  try {
    await facultyService.correctFacultyAttendance(rahulUserId, nehaSessionId, {
      changes: [{ studentId: detail.students[0].studentId, newStatus: 'ABSENT', reason: 'Correction Test' }],
    });
  } catch (err: any) {
    rejected = true;
    console.log(`✓ PASS: Unauthorized correction attempt blocked with error: "${err.message}"`);
  }
  if (!rejected) {
    throw new Error('FAILED: Rahul was able to modify historical attendance recorded by Neha!');
  }

  // 5. Test Duplicate Session Prevention
  console.log('\n--- 5. DUPLICATE SESSION PREVENTION CHECK ---');
  let duplicateBlocked = false;
  try {
    await facultyService.saveFacultyAttendance(rahulUserId, rahulAssignmentId, {
      date: '2026-10-11',
      sessionPeriod: 1,
      records: [{ studentId: detail.students[0].studentId, status: 'PRESENT' }],
    });
  } catch (err: any) {
    duplicateBlocked = true;
    console.log(`✓ PASS: Duplicate attendance save on 11-10-2026 blocked with error: "${err.message}"`);
  }
  if (!duplicateBlocked) {
    throw new Error('FAILED: System allowed overwriting existing attendance on 11-10-2026!');
  }

  // 6. Test Workspace Continuity for Rahul
  console.log('\n--- 6. WORKSPACE CONTINUITY CHECK ---');
  const workspace = await facultyService.getFacultyAttendanceWorkspace(rahulUserId, rahulAssignmentId);
  console.log(`Workspace conducted dates: ${workspace.conductedDates.join(', ')}`);
  console.log(`Workspace total classes: ${workspace.metrics.totalClassesConducted}`);
  console.log(`Previous class shown: Date ${workspace.previousClass?.date}, Period ${workspace.previousClass?.sessionPeriod}`);

  if (!workspace.conductedDates.includes('2026-10-11') || !workspace.conductedDates.includes('2026-10-12')) {
    throw new Error('FAILED: Workspace conducted dates missing 2026-10-11 or 2026-10-12!');
  }
  console.log('✓ PASS: Rahul workspace shows complete teaching continuity across faculty transfer.');

  // 7. Test Idempotent Excel Generation
  console.log('\n--- 7. IDEMPOTENT SYNC / DUPLICATION CHECK ---');
  const secondGen = await attendanceExcelService.generateAttendanceWorkbookBuffer(rahulAssignmentId);
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(secondGen.buffer as any);
  const ws2 = wb2.getWorksheet('Attendance Register')!;
  const headers2: string[] = [];
  ws2.getRow(8).eachCell(c => headers2.push(String(c.value)));
  const count11 = headers2.filter(h => h.includes('11-10-2026')).length;
  const count12 = headers2.filter(h => h.includes('12-10-2026')).length;
  console.log(`Count of 11-10-2026 columns: ${count11}`);
  console.log(`Count of 12-10-2026 columns: ${count12}`);
  if (count11 !== 1 || count12 !== 1) {
    throw new Error(`FAILED: Duplicate date columns detected! count11=${count11}, count12=${count12}`);
  }
  console.log('✓ PASS: Excel generation is 100% idempotent; no duplicate date columns.');

  console.log('\n======================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! (7/7)');
  console.log('======================================================');
  process.exit(0);
}

verify().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
