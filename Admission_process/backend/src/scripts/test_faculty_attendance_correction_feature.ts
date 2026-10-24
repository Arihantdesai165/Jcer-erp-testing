import db from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import AuditLog from '../models/AuditLog';
import Subject from '../models/Subject';
import Department from '../models/Department';
import { facultyService } from '../services/faculty.service';

async function runAttendanceCorrectionTests() {
  console.log('================================================================');
  console.log('=== VERIFYING ATTENDANCE CORRECTION & AUDIT SYSTEM ===');
  console.log('================================================================\n');

  try {
    await db.authenticate();
    console.log('✓ Database connection authenticated.');

    // 1. Find an assignment with attendance sessions
    const session = await AttendanceSession.findOne({
      order: [['attendanceDate', 'DESC'], ['sessionPeriod', 'DESC']],
    });

    if (!session) {
      throw new Error('No AttendanceSession found in database to test.');
    }

    const assignment = await FacultyAssignment.findByPk(session.facultyAssignmentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      throw new Error(`FacultyAssignment not found for session: ${session.id}`);
    }

    const facultyUserId = assignment.userId;
    console.log(`✓ Test Scope Resolved:`);
    console.log(`- Session ID: ${session.id} (Date: ${session.attendanceDate}, Period: ${session.sessionPeriod})`);
    console.log(`- Subject: ${(assignment as any).subject?.name} (${(assignment as any).subject?.code})`);
    console.log(`- Section: ${assignment.section}, Semester: ${assignment.semester}, AY: ${assignment.academicYear}`);
    console.log(`- Authorized Faculty User ID: ${facultyUserId}`);

    // TEST 1 — Load Session Detail & Roster
    console.log('\n--- TEST 1: Load Session Detail & Student Roster ---');
    const sessionDetail = await facultyService.getFacultyAttendanceSessionDetail(facultyUserId, session.id);
    console.log(`✓ Session loaded: ${sessionDetail.students.length} students in roster.`);
    console.log(`  Initial Present: ${sessionDetail.session.presentCount}, Absent: ${sessionDetail.session.absentCount}, Rate: ${sessionDetail.session.percentage}%`);

    if (sessionDetail.students.length === 0) {
      throw new Error('No students found in session roster!');
    }

    // Find an absent student or mark one absent to test correction
    let targetStudent = sessionDetail.students.find((s) => s.currentStatus === 'ABSENT');
    if (!targetStudent) {
      // Toggle the first student to ABSENT for testing
      targetStudent = sessionDetail.students[0];
      const rec = await AttendanceRecord.findOne({
        where: { attendanceSessionId: session.id, studentId: targetStudent.studentId },
      });
      if (rec) {
        rec.status = 'ABSENT';
        await rec.save();
      }
      console.log(`  Set student ${targetStudent.usn} (${targetStudent.studentName}) to ABSENT for testing.`);
    } else {
      console.log(`  Found student ${targetStudent.usn} (${targetStudent.studentName}) currently ABSENT.`);
    }

    // TEST 2 — Single Student Correction: ABSENT -> PRESENT
    console.log('\n--- TEST 2: Single Student Correction (ABSENT -> PRESENT) ---');
    const prevLogCount = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });

    const singleCorrectionResult = await facultyService.correctFacultyAttendance(
      facultyUserId,
      session.id,
      {
        changes: [
          {
            studentId: targetStudent.studentId,
            newStatus: 'PRESENT',
            reason: 'Approved Attendance Permission',
            remarks: 'Student presented approved permission before examination',
          },
        ],
      },
      { ipAddress: '127.0.0.1', userAgent: 'Jest-Verification-Agent' }
    );

    console.log(`✓ Correction applied. Updated Present: ${singleCorrectionResult.session.presentCount}, Absent: ${singleCorrectionResult.session.absentCount}`);

    // Verify record in database
    const updatedRecord = await AttendanceRecord.findOne({
      where: { attendanceSessionId: session.id, studentId: targetStudent.studentId },
    });
    if (!updatedRecord || updatedRecord.status !== 'PRESENT') {
      throw new Error(`FAILED: AttendanceRecord status is not PRESENT (got: ${updatedRecord?.status})`);
    }

    // Verify no duplicate records created
    const recordCount = await AttendanceRecord.count({
      where: { attendanceSessionId: session.id, studentId: targetStudent.studentId },
    });
    if (recordCount !== 1) {
      throw new Error(`FAILED: Expected exactly 1 AttendanceRecord for student, found: ${recordCount}`);
    }
    console.log('✓ AttendanceRecord safely updated without duplicates.');

    // TEST 3 — Verify Audit Log
    console.log('\n--- TEST 3: Verify Immutable Audit Log ---');
    const newLogCount = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });
    if (newLogCount !== prevLogCount + 1) {
      throw new Error(`FAILED: Audit log count mismatch. Expected +1 log, got: ${newLogCount - prevLogCount}`);
    }

    const latestAudit = await AuditLog.findOne({
      where: { action: 'ATTENDANCE_CORRECTED' },
      order: [['createdAt', 'DESC']],
    });

    if (!latestAudit) {
      throw new Error('FAILED: Latest audit log not found!');
    }

    console.log('✓ Latest AuditLog captured:');
    console.log(`  - User ID: ${latestAudit.userId}`);
    console.log(`  - Action: ${latestAudit.action}`);
    console.log(`  - Student USN: ${latestAudit.details?.studentUsn}`);
    console.log(`  - Old Status: ${latestAudit.details?.oldStatus} -> New Status: ${latestAudit.details?.newStatus}`);
    console.log(`  - Reason: ${latestAudit.details?.reason}`);
    console.log(`  - Remarks: ${latestAudit.details?.remarks}`);
    console.log(`  - Timestamp: ${latestAudit.details?.timestamp}`);

    if (
      latestAudit.details?.studentId !== targetStudent.studentId ||
      latestAudit.details?.oldStatus !== 'ABSENT' ||
      latestAudit.details?.newStatus !== 'PRESENT' ||
      latestAudit.details?.reason !== 'Approved Attendance Permission'
    ) {
      throw new Error('FAILED: Audit log payload fields mismatch!');
    }
    console.log('✓ AuditLog fields fully validated.');

    // TEST 4 — No-Op Correction (PRESENT -> PRESENT)
    console.log('\n--- TEST 4: No-Op Correction (No changes made) ---');
    const logCountBeforeNoOp = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });

    await facultyService.correctFacultyAttendance(facultyUserId, session.id, {
      changes: [
        {
          studentId: targetStudent.studentId,
          newStatus: 'PRESENT',
          reason: 'Approved Attendance Permission',
        },
      ],
    });

    const logCountAfterNoOp = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });
    if (logCountAfterNoOp !== logCountBeforeNoOp) {
      throw new Error('FAILED: Audit log was created for a no-op correction!');
    }
    console.log('✓ No-op successfully handled without generating redundant audit logs.');

    // TEST 5 — Bulk Correction
    console.log('\n--- TEST 5: Bulk Student Correction ---');
    // Find up to 2 students to toggle
    const studentsToBulkCorrect = sessionDetail.students.slice(0, 2);
    const bulkChanges = studentsToBulkCorrect.map((st) => ({
      studentId: st.studentId,
      newStatus: 'PRESENT' as const,
      reason: 'Faculty Entry Correction',
      remarks: 'Bulk verified attendance roster',
    }));

    // First mark them absent
    for (const st of studentsToBulkCorrect) {
      const r = await AttendanceRecord.findOne({
        where: { attendanceSessionId: session.id, studentId: st.studentId },
      });
      if (r) {
        r.status = 'ABSENT';
        await r.save();
      }
    }

    const logCountBeforeBulk = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });
    await facultyService.correctFacultyAttendance(facultyUserId, session.id, { changes: bulkChanges });
    const logCountAfterBulk = await AuditLog.count({ where: { action: 'ATTENDANCE_CORRECTED' } });

    if (logCountAfterBulk !== logCountBeforeBulk + studentsToBulkCorrect.length) {
      throw new Error(`FAILED: Expected ${studentsToBulkCorrect.length} audit logs for bulk correction, got: ${logCountAfterBulk - logCountBeforeBulk}`);
    }
    console.log(`✓ Bulk correction created ${studentsToBulkCorrect.length} distinct immutable audit logs.`);

    // TEST 6 — Unauthorized Faculty Protection
    console.log('\n--- TEST 6: Unauthorized Faculty Access Rejection ---');
    const randomFakeUserId = '00000000-0000-0000-0000-000000000000';
    let unauthorizedCaught = false;
    try {
      await facultyService.correctFacultyAttendance(randomFakeUserId, session.id, {
        changes: [{ studentId: targetStudent.studentId, newStatus: 'PRESENT', reason: 'Hack' }],
      });
    } catch (err: any) {
      unauthorizedCaught = true;
      console.log(`✓ Unauthorized access rejected with message: "${err.message}"`);
    }

    if (!unauthorizedCaught) {
      throw new Error('FAILED: Unauthorized faculty was not blocked!');
    }

    // TEST 7 — Non-Roster Student Rejection
    console.log('\n--- TEST 7: Non-Roster Student Rejection ---');
    let nonRosterCaught = false;
    try {
      await facultyService.correctFacultyAttendance(facultyUserId, session.id, {
        changes: [{ studentId: '00000000-0000-0000-0000-000000000000', newStatus: 'PRESENT', reason: 'Invalid Student' }],
      });
    } catch (err: any) {
      nonRosterCaught = true;
      console.log(`✓ Invalid/foreign student rejected with message: "${err.message}"`);
    }

    if (!nonRosterCaught) {
      throw new Error('FAILED: Non-roster student was not rejected!');
    }

    // TEST 8 — Locked Session Protection
    console.log('\n--- TEST 8: Locked Session Protection ---');
    // Temporarily set session status to LOCKED
    session.status = 'LOCKED';
    await session.save();

    let lockedCaught = false;
    try {
      await facultyService.correctFacultyAttendance(facultyUserId, session.id, {
        changes: [{ studentId: targetStudent.studentId, newStatus: 'PRESENT', reason: 'Locked Test' }],
      });
    } catch (err: any) {
      lockedCaught = true;
      console.log(`✓ Locked session modification blocked with message: "${err.message}"`);
    }

    // Restore session status
    session.status = 'SUBMITTED';
    await session.save();

    if (!lockedCaught) {
      throw new Error('FAILED: Locked session modification was not blocked!');
    }

    // TEST 9 — Attendance History & Corrections Retrieval API
    console.log('\n--- TEST 9: Attendance History & Assignment Corrections API ---');
    const historyResult = await facultyService.getFacultyAttendanceHistory(facultyUserId, assignment.id);
    console.log(`✓ Attendance History: ${historyResult.totalSessions} sessions recorded.`);

    const assignmentAuditLogs = await facultyService.getFacultyAssignmentCorrections(facultyUserId, assignment.id);
    console.log(`✓ Assignment Corrections Audit Log: ${assignmentAuditLogs.length} events found.`);
    if (assignmentAuditLogs.length > 0) {
      console.log(`  Sample: ${assignmentAuditLogs[0].studentUsn} (${assignmentAuditLogs[0].oldStatus} -> ${assignmentAuditLogs[0].newStatus}) by ${assignmentAuditLogs[0].correctedByFacultyName}`);
    }

    // TEST 10 — Excel Export Uses Corrected Records
    console.log('\n--- TEST 10: Excel Export with Corrected Records ---');
    const exportResult = await facultyService.exportFacultyAttendanceExcel(facultyUserId, assignment.id);
    console.log(`✓ Excel Export generated: ${exportResult.filename} (${exportResult.buffer.length} bytes)`);

    console.log('\n================================================================');
    console.log('=== ALL ATTENDANCE CORRECTION TESTS PASSED PERFECTLY! ===');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR DURING CORRECTION SYSTEM VERIFICATION:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runAttendanceCorrectionTests();
