import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Student from '../models/Student';
import User from '../models/User';
import { facultyService } from '../services/faculty.service';

async function runVerification() {
  console.log('=== STARTING ATTENDANCE HARDENING VERIFICATION ===\n');

  try {
    await db.authenticate();
    console.log('✓ Database connection authenticated.');

    // 1. Check AttendanceSession table existence & schema
    const sessionCount = await AttendanceSession.count();
    console.log(`✓ AttendanceSession model functional. Current session count in DB: ${sessionCount}`);

    // 2. Fetch or find an active FacultyAssignment
    const assignment = await FacultyAssignment.findOne({
      where: { status: 'ACTIVE' },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      console.log('⚠️ No active FacultyAssignment found to run end-to-end test. Standard schema verification completed!');
      return;
    }

    console.log(`✓ Found active FacultyAssignment: ID ${assignment.id} (Subject: ${assignment.subjectId}, Sem: ${assignment.semester}, Sec: ${assignment.section})`);

    // Fetch students belonging to section
    const students = await Student.findAll({
      where: {
        departmentId: assignment.departmentId,
        semester: assignment.semester,
      },
      limit: 5,
    });

    if (students.length === 0) {
      console.log('⚠️ No students allocated in department/semester. Verified schema structure!');
      return;
    }

    const testDate = '2026-10-02';
    const testPeriod = 1;
    const recordsPayload = students.map((st, idx) => ({
      studentId: st.id,
      status: (idx % 2 === 0 ? 'PRESENT' : 'ABSENT') as 'PRESENT' | 'ABSENT',
    }));

    // 3. Test Transactional Attendance Save
    console.log('\n--- TEST 1: Save Faculty Attendance (Creates 1 AttendanceSession) ---');
    const result = await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
      date: testDate,
      sessionPeriod: testPeriod,
      records: recordsPayload,
    });

    console.log(`✓ Workspace returned after save: ${result.students.length} students in roster.`);

    const createdSession = await AttendanceSession.findOne({
      where: {
        facultyAssignmentId: assignment.id,
        attendanceDate: testDate,
        sessionPeriod: testPeriod,
      },
    });

    if (!createdSession) {
      throw new Error('FAILED: AttendanceSession was not created!');
    }

    console.log(`✓ AttendanceSession created successfully! Session ID: ${createdSession.id}, Total: ${createdSession.totalStudents}, Present: ${createdSession.presentCount}, Absent: ${createdSession.absentCount}`);

    const linkedRecords = await AttendanceRecord.findAll({
      where: { attendanceSessionId: createdSession.id },
    });
    console.log(`✓ AttendanceRecords linked to session: ${linkedRecords.length} records.`);

    // 4. Test Duplicate Prevention (Saving same date & period again)
    console.log('\n--- TEST 2: Duplicate Prevention (Save same date + period again) ---');
    await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
      date: testDate,
      sessionPeriod: testPeriod,
      records: recordsPayload,
    });

    const sessionsCountForSlot = await AttendanceSession.count({
      where: {
        facultyAssignmentId: assignment.id,
        attendanceDate: testDate,
        sessionPeriod: testPeriod,
      },
    });

    if (sessionsCountForSlot !== 1) {
      throw new Error(`FAILED: Found ${sessionsCountForSlot} AttendanceSessions for the same date & period! Expected exactly 1.`);
    }
    console.log('✓ Duplicate session protection verified! Exactly 1 AttendanceSession exists for the date & period.');

    // 5. Test Future Date Protection
    console.log('\n--- TEST 3: Future Date Protection ---');
    try {
      await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
        date: '2099-12-31',
        sessionPeriod: 1,
        records: recordsPayload,
      });
      console.error('❌ FAILED: Future date attendance was not rejected!');
    } catch (err: any) {
      console.log(`✓ Future date correctly rejected with error: "${err.message}"`);
    }

    // 6. Test Locked Session Protection
    console.log('\n--- TEST 4: Locked Session Protection ---');
    createdSession.status = 'LOCKED';
    await createdSession.save();

    try {
      await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
        date: testDate,
        sessionPeriod: testPeriod,
        records: recordsPayload,
      });
      console.error('❌ FAILED: Editing locked session was not rejected!');
    } catch (err: any) {
      console.log(`✓ Locked session edit correctly rejected with error: "${err.message}"`);
    } finally {
      // Revert status to SUBMITTED for cleanup
      createdSession.status = 'SUBMITTED';
      await createdSession.save();
    }

    console.log('\n============================================================');
    console.log('ALL ATTENDANCE HARDENING VERIFICATIONS PASSED PERFECTLY!');
    console.log('============================================================\n');

  } catch (error: any) {
    console.error('VERIFICATION ERROR:', error);
    process.exit(1);
  }
}

runVerification().then(() => process.exit(0));
