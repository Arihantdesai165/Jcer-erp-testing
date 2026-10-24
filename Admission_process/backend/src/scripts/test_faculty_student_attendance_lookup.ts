import db from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Section from '../models/Section';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import facultyService from '../services/faculty.service';
import logger from '../utils/logger.util';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('STARTING: Student Attendance Lookup & Authorization Test Suite');
  console.log('===============================================================\n');

  try {
    await db.authenticate();
    console.log('✅ PostgreSQL Database connected successfully.');

    // 1. Fetch departments
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    const eceDept = await Department.findOne({ where: { code: 'ECE' } });

    if (!cseDept) throw new Error('CSE Department missing');

    const testAcademicYear = '2026-27';

    // 2. Setup or find Faculty A (Yuva / Test Faculty A)
    let facultyAUser = await User.findOne({ where: { email: 'test_faculty_a@jcer.edu' } });
    if (!facultyAUser) {
      facultyAUser = await User.create({
        email: 'test_faculty_a@jcer.edu',
        passwordHash: 'dummyhash',
        firstName: 'Yuva',
        lastName: 'Patil',
        role: 'TEACHER',
        status: 'ACTIVE',
      });
    }

    let teacherA = await Teacher.findOne({ where: { userId: facultyAUser.id } });
    if (!teacherA) {
      teacherA = await Teacher.create({
        userId: facultyAUser.id,
        departmentId: cseDept.id,
        designation: 'Associate Professor',
        status: 'ACTIVE',
      });
    }

    // Setup or find Faculty B (Another Faculty)
    let facultyBUser = await User.findOne({ where: { email: 'test_faculty_b@jcer.edu' } });
    if (!facultyBUser) {
      facultyBUser = await User.create({
        email: 'test_faculty_b@jcer.edu',
        passwordHash: 'dummyhash',
        firstName: 'Bhavna',
        lastName: 'Sharma',
        role: 'TEACHER',
        status: 'ACTIVE',
      });
    }

    let teacherB = await Teacher.findOne({ where: { userId: facultyBUser.id } });
    if (!teacherB) {
      teacherB = await Teacher.create({
        userId: facultyBUser.id,
        departmentId: cseDept.id,
        designation: 'Assistant Professor',
        status: 'ACTIVE',
      });
    }

    // 3. Setup Subjects: CAD (BCS101), Python (BCS102), Mathematics (BMA101)
    let [subCad] = await Subject.findOrCreate({
      where: { code: 'BCS101_TEST', departmentId: cseDept.id },
      defaults: {
        code: 'BCS101_TEST',
        name: 'Computer Aided Design (CAD)',
        departmentId: cseDept.id,
        semester: 1,
        credits: 4,
        type: 'IPCC',
      },
    });

    let [subPython] = await Subject.findOrCreate({
      where: { code: 'BCS102_TEST', departmentId: cseDept.id },
      defaults: {
        code: 'BCS102_TEST',
        name: 'Python Programming',
        departmentId: cseDept.id,
        semester: 1,
        credits: 4,
        type: 'IPCC',
      },
    });

    let [subMaths] = await Subject.findOrCreate({
      where: { code: 'BMA101_TEST', departmentId: cseDept.id },
      defaults: {
        code: 'BMA101_TEST',
        name: 'Engineering Mathematics 1',
        departmentId: cseDept.id,
        semester: 1,
        credits: 4,
        type: 'THEORY',
      },
    });

    // 4. Setup Sections: Section A and Section B
    let [secA] = await Section.findOrCreate({
      where: { name: 'A', departmentId: cseDept.id, semester: 1 },
      defaults: {
        name: 'A',
        departmentId: cseDept.id,
        semester: 1,
        academicYear: testAcademicYear,
        capacity: 60,
      },
    });

    let [secB] = await Section.findOrCreate({
      where: { name: 'B', departmentId: cseDept.id, semester: 1 },
      defaults: {
        name: 'B',
        departmentId: cseDept.id,
        semester: 1,
        academicYear: testAcademicYear,
        capacity: 60,
      },
    });

    // 5. Setup Students:
    // Student 1: SEM1-TEST-001 in Section A
    let userSt1 = await User.findOne({ where: { email: 'student1_test@jcer.edu' } });
    if (!userSt1) {
      userSt1 = await User.create({
        email: 'student1_test@jcer.edu',
        passwordHash: 'dummy',
        firstName: 'Aarav',
        lastName: 'Kulkarni',
        role: 'STUDENT',
        status: 'ACTIVE',
      });
    }

    let [st1] = await Student.findOrCreate({
      where: { userId: userSt1.id },
      defaults: {
        userId: userSt1.id,
        usn: '1JC26CS001',
        enrollmentNumber: 'ENR26001',
        batchYear: 2026,
        departmentId: cseDept.id,
        semester: 1,
        section: 'A',
        sectionId: secA.id,
        currentAcademicYear: testAcademicYear,
        admissionStatus: 'APPROVED',
      },
    });
    st1.sectionId = secA.id;
    st1.section = 'A';
    await st1.save();

    // Student 2: SEM1-TEST-002 in Section B
    let userSt2 = await User.findOne({ where: { email: 'student2_test@jcer.edu' } });
    if (!userSt2) {
      userSt2 = await User.create({
        email: 'student2_test@jcer.edu',
        passwordHash: 'dummy',
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        role: 'STUDENT',
        status: 'ACTIVE',
      });
    }

    let [st2] = await Student.findOrCreate({
      where: { userId: userSt2.id },
      defaults: {
        userId: userSt2.id,
        usn: '1JC26CS002',
        enrollmentNumber: 'ENR26002',
        batchYear: 2026,
        departmentId: cseDept.id,
        semester: 1,
        section: 'B',
        sectionId: secB.id,
        currentAcademicYear: testAcademicYear,
        admissionStatus: 'APPROVED',
      },
    });
    st2.sectionId = secB.id;
    st2.section = 'B';
    await st2.save();

    // 6. Setup Faculty Assignments:
    // Faculty A (Yuva):
    //   Assignment 1: CAD -> Section A
    //   Assignment 2: Python -> Section A
    let [assignA1] = await FacultyAssignment.findOrCreate({
      where: {
        userId: facultyAUser.id,
        subjectId: subCad.id,
        section: 'A',
        academicYear: testAcademicYear,
      },
      defaults: {
        userId: facultyAUser.id,
        teacherId: teacherA.id,
        departmentId: cseDept.id,
        subjectId: subCad.id,
        semester: 1,
        section: 'A',
        academicYear: testAcademicYear,
        attendanceAccess: true,
        marksAccess: true,
        status: 'ACTIVE',
      },
    });

    let [assignA2] = await FacultyAssignment.findOrCreate({
      where: {
        userId: facultyAUser.id,
        subjectId: subPython.id,
        section: 'A',
        academicYear: testAcademicYear,
      },
      defaults: {
        userId: facultyAUser.id,
        teacherId: teacherA.id,
        departmentId: cseDept.id,
        subjectId: subPython.id,
        semester: 1,
        section: 'A',
        academicYear: testAcademicYear,
        attendanceAccess: true,
        marksAccess: true,
        status: 'ACTIVE',
      },
    });

    // Faculty B (Bhavna):
    //   Assignment 3: CAD -> Section B
    //   Assignment 4: Mathematics -> Section A
    let [assignB1] = await FacultyAssignment.findOrCreate({
      where: {
        userId: facultyBUser.id,
        subjectId: subCad.id,
        section: 'B',
        academicYear: testAcademicYear,
      },
      defaults: {
        userId: facultyBUser.id,
        teacherId: teacherB.id,
        departmentId: cseDept.id,
        subjectId: subCad.id,
        semester: 1,
        section: 'B',
        academicYear: testAcademicYear,
        attendanceAccess: true,
        marksAccess: true,
        status: 'ACTIVE',
      },
    });

    let [assignB2] = await FacultyAssignment.findOrCreate({
      where: {
        userId: facultyBUser.id,
        subjectId: subMaths.id,
        section: 'A',
        academicYear: testAcademicYear,
      },
      defaults: {
        userId: facultyBUser.id,
        teacherId: teacherB.id,
        departmentId: cseDept.id,
        subjectId: subMaths.id,
        semester: 1,
        section: 'A',
        academicYear: testAcademicYear,
        attendanceAccess: true,
        marksAccess: true,
        status: 'ACTIVE',
      },
    });

    // 7. Clean up and setup Attendance Data for Faculty A (CAD Section A):
    await AttendanceRecord.destroy({ where: { facultyAssignmentId: assignA1.id } });
    await AttendanceSession.destroy({ where: { facultyAssignmentId: assignA1.id } });

    const sessionDate = '2026-10-01';
    let [sess1] = await AttendanceSession.findOrCreate({
      where: {
        facultyAssignmentId: assignA1.id,
        attendanceDate: sessionDate,
        sessionPeriod: 1,
      },
      defaults: {
        facultyAssignmentId: assignA1.id,
        departmentId: cseDept.id,
        subjectId: subCad.id,
        sectionId: secA.id,
        section: 'A',
        semester: 1,
        academicYear: testAcademicYear,
        attendanceDate: sessionDate,
        sessionPeriod: 1,
        status: 'SUBMITTED',
        totalStudents: 1,
        presentCount: 1,
        absentCount: 0,
      },
    });

    let [rec1] = await AttendanceRecord.findOrCreate({
      where: {
        facultyAssignmentId: assignA1.id,
        studentId: st1.id,
        date: sessionDate as any,
        sessionPeriod: 1,
      },
      defaults: {
        attendanceSessionId: sess1.id,
        studentId: st1.id,
        facultyAssignmentId: assignA1.id,
        departmentId: cseDept.id,
        subjectId: subCad.id,
        semester: 1,
        section: 'A',
        academicYear: testAcademicYear,
        date: sessionDate as any,
        sessionPeriod: 1,
        status: 'PRESENT',
      },
    });

    console.log('✅ Test Data Fixture initialized.\n');

    // ==============================================================
    // TEST 1: Search by full USN
    // ==============================================================
    console.log('Test 1: Search by full USN (1JC26CS001) for Faculty A');
    const search1 = await facultyService.searchFacultyStudents(facultyAUser.id, '1JC26CS001', testAcademicYear);
    console.log('Result:', search1.map((s) => ({ name: s.name, usn: s.usn, section: s.section })));
    if (search1.length !== 1 || search1[0].usn !== '1JC26CS001') {
      throw new Error('TEST 1 FAILED: Expected 1JC26CS001');
    }
    console.log('✅ TEST 1 PASSED.\n');

    // ==============================================================
    // TEST 2: Search by partial USN
    // ==============================================================
    console.log('Test 2: Search by partial USN (CS001) for Faculty A');
    const search2 = await facultyService.searchFacultyStudents(facultyAUser.id, 'CS001', testAcademicYear);
    if (search2.length !== 1 || search2[0].usn !== '1JC26CS001') {
      throw new Error('TEST 2 FAILED: Expected 1JC26CS001 for partial USN');
    }
    console.log('✅ TEST 2 PASSED.\n');

    // ==============================================================
    // TEST 3: Search by student name
    // ==============================================================
    console.log('Test 3: Search by student name (Aarav) for Faculty A');
    const search3 = await facultyService.searchFacultyStudents(facultyAUser.id, 'Aarav', testAcademicYear);
    if (search3.length !== 1 || !search3[0].name.includes('Aarav')) {
      throw new Error('TEST 3 FAILED: Expected Aarav');
    }
    console.log('✅ TEST 3 PASSED.\n');

    // ==============================================================
    // TEST 4: Cross-section isolation in search
    // Faculty A (teaches Section A) searches for Student 2 (in Section B)
    // ==============================================================
    console.log('Test 4: Cross-Section Isolation: Faculty A searches for Student 2 (1JC26CS002 in Section B)');
    const search4 = await facultyService.searchFacultyStudents(facultyAUser.id, '1JC26CS002', testAcademicYear);
    console.log('Result for Faculty A searching Section B student:', search4);
    if (search4.length !== 0) {
      throw new Error('TEST 4 FAILED: Faculty A must NOT find Section B student 1JC26CS002!');
    }
    console.log('✅ TEST 4 PASSED: Cross-section isolation strictly enforced in search.\n');

    // ==============================================================
    // TEST 5: Faculty B (teaches Section B) searches for Student 2 (in Section B)
    // ==============================================================
    console.log('Test 5: Faculty B searches for Student 2 (1JC26CS002 in Section B)');
    const search5 = await facultyService.searchFacultyStudents(facultyBUser.id, '1JC26CS002', testAcademicYear);
    if (search5.length !== 1 || search5[0].usn !== '1JC26CS002') {
      throw new Error('TEST 5 FAILED: Faculty B should find Section B student');
    }
    console.log('✅ TEST 5 PASSED.\n');

    // ==============================================================
    // TEST 6: Student Attendance Details for Faculty A on Student 1 (Section A)
    // Should ONLY return CAD and Python. Must NEVER return Mathematics!
    // ==============================================================
    console.log('Test 6: Faculty A views Student 1 attendance (Authorized: CAD, Python | Unauthorized: Maths)');
    const attendanceA1 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    console.log('Subjects returned for Faculty A:', attendanceA1.subjects.map((s) => s.subjectCode));

    const returnedCodes = attendanceA1.subjects.map((s) => s.subjectCode);
    if (!returnedCodes.includes('BCS101_TEST') || !returnedCodes.includes('BCS102_TEST')) {
      throw new Error('TEST 6 FAILED: Faculty A should see CAD and Python');
    }
    if (returnedCodes.includes('BMA101_TEST')) {
      throw new Error('TEST 6 CRITICAL SECURITY FAILURE: Faculty A must NEVER see Mathematics (assigned to Faculty B)!');
    }
    console.log('✅ TEST 6 PASSED: Cross-subject isolation strictly verified. Only authorized assignments returned.\n');

    // ==============================================================
    // TEST 7: Cross-Section Attendance Access Security
    // Faculty A attempts direct API fetch for Student 2 (Section B)
    // ==============================================================
    console.log('Test 7: Faculty A attempts direct API fetch for Student 2 (Section B)');
    const attendanceA2 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st2.id, testAcademicYear);
    console.log('Subjects returned for Faculty A inspecting Student 2:', attendanceA2.subjects);
    if (attendanceA2.subjects.length !== 0) {
      throw new Error('TEST 7 CRITICAL SECURITY FAILURE: Faculty A must receive 0 subjects for Section B student!');
    }
    if (!attendanceA2.message?.includes('No attendance available')) {
      throw new Error('TEST 7 FAILED: Expected informational empty message');
    }
    console.log('✅ TEST 7 PASSED: Cross-section student attendance returned 0 subjects with secure empty message.\n');

    // ==============================================================
    // TEST 8: Percentage and 85% Eligibility Threshold Verification
    // Requirement: >= 85% -> Eligible, < 85% -> Not Eligible, 0 conducted -> No Records / N/A
    // ==============================================================
    console.log('Test 8: Threshold Boundary Verification (100%, 90%, 85%, 80%, 75%, 0 conducted)');
    const cadSubject = attendanceA1.subjects.find((s) => s.subjectCode === 'BCS101_TEST');
    const pythonSubject = attendanceA1.subjects.find((s) => s.subjectCode === 'BCS102_TEST');

    console.log('100% Case (1/1):', {
      pct: cadSubject?.attendancePercentage,
      status: cadSubject?.eligibilityStatus,
      threshold: cadSubject?.threshold,
    });
    console.log('0 conducted Case (0/0):', {
      pct: pythonSubject?.attendancePercentage,
      status: pythonSubject?.eligibilityStatus,
    });

    if (cadSubject?.attendancePercentage !== 100 || cadSubject?.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 8 FAILED: 100% should be Eligible');
    }
    if (cadSubject?.threshold !== 85.0) {
      throw new Error(`TEST 8 FAILED: Expected threshold 85.0 but got ${cadSubject?.threshold}`);
    }
    if (pythonSubject?.conductedClasses !== 0 || pythonSubject?.attendancePercentage !== null || pythonSubject?.eligibilityStatus !== 'No Records') {
      throw new Error('TEST 8 FAILED: 0 conducted should have null percentage and No Records status');
    }

    // Test 85.0% boundary condition using 20 sessions setup
    // 17 / 20 = 85.0% -> Eligible
    // 18 / 20 = 90.0% -> Eligible
    // 16 / 20 = 80.0% -> Not Eligible
    // 15 / 20 = 75.0% -> Not Eligible
    // Create 19 more sessions for CAD to test exact boundaries
    const dummySessions: any[] = [];
    const dummyRecords: any[] = [];
    for (let i = 2; i <= 20; i++) {
      const d = `2026-10-${i.toString().padStart(2, '0')}`;
      const [s] = await AttendanceSession.findOrCreate({
        where: { facultyAssignmentId: assignA1.id, attendanceDate: d, sessionPeriod: 1 },
        defaults: {
          facultyAssignmentId: assignA1.id,
          departmentId: cseDept.id,
          subjectId: subCad.id,
          sectionId: secA.id,
          section: 'A',
          semester: 1,
          academicYear: testAcademicYear,
          attendanceDate: d,
          sessionPeriod: 1,
          status: 'SUBMITTED',
          totalStudents: 1,
          presentCount: 1,
          absentCount: 0,
        },
      });
      dummySessions.push(s);

      const [r] = await AttendanceRecord.findOrCreate({
        where: { facultyAssignmentId: assignA1.id, studentId: st1.id, date: d as any, sessionPeriod: 1 },
        defaults: {
          attendanceSessionId: s.id,
          studentId: st1.id,
          facultyAssignmentId: assignA1.id,
          departmentId: cseDept.id,
          subjectId: subCad.id,
          semester: 1,
          section: 'A',
          academicYear: testAcademicYear,
          date: d as any,
          sessionPeriod: 1,
          status: 'PRESENT',
        },
      });
      dummyRecords.push(r);
    }

    // 1) 20 / 20 = 100% -> Eligible
    let check100 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    let cad100 = check100.subjects.find((s) => s.subjectCode === 'BCS101_TEST')!;
    console.log('Testing 100% (20/20):', { pct: cad100.attendancePercentage, status: cad100.eligibilityStatus });
    if (cad100.attendancePercentage !== 100 || cad100.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 8 FAILED: 20/20 (100%) must be Eligible');
    }

    // 2) 18 / 20 = 90% -> Eligible (set 2 sessions to ABSENT)
    dummyRecords[0].status = 'ABSENT'; await dummyRecords[0].save();
    dummyRecords[1].status = 'ABSENT'; await dummyRecords[1].save();
    let check90 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    let cad90 = check90.subjects.find((s) => s.subjectCode === 'BCS101_TEST')!;
    console.log('Testing 90% (18/20):', { pct: cad90.attendancePercentage, status: cad90.eligibilityStatus });
    if (cad90.attendancePercentage !== 90 || cad90.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 8 FAILED: 18/20 (90%) must be Eligible');
    }

    // 3) 17 / 20 = 85.0% -> Eligible (set 3rd session to ABSENT)
    dummyRecords[2].status = 'ABSENT'; await dummyRecords[2].save();
    let check85 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    let cad85 = check85.subjects.find((s) => s.subjectCode === 'BCS101_TEST')!;
    console.log('Testing 85% (17/20):', { pct: cad85.attendancePercentage, status: cad85.eligibilityStatus });
    if (cad85.attendancePercentage !== 85 || cad85.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 8 FAILED: 17/20 (85.0%) must be Eligible');
    }

    // 4) 16 / 20 = 80.0% (< 85%) -> Not Eligible (set 4th session to ABSENT)
    dummyRecords[3].status = 'ABSENT'; await dummyRecords[3].save();
    let check80 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    let cad80 = check80.subjects.find((s) => s.subjectCode === 'BCS101_TEST')!;
    console.log('Testing 80% (16/20):', { pct: cad80.attendancePercentage, status: cad80.eligibilityStatus });
    if (cad80.attendancePercentage !== 80 || cad80.eligibilityStatus !== 'Not Eligible') {
      throw new Error('TEST 8 FAILED: 16/20 (80%) must be Not Eligible under 85% threshold');
    }

    // 5) 15 / 20 = 75.0% (< 85%) -> Not Eligible (set 5th session to ABSENT)
    dummyRecords[4].status = 'ABSENT'; await dummyRecords[4].save();
    let check75 = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    let cad75 = check75.subjects.find((s) => s.subjectCode === 'BCS101_TEST')!;
    console.log('Testing 75% (15/20):', { pct: cad75.attendancePercentage, status: cad75.eligibilityStatus });
    if (cad75.attendancePercentage !== 75 || cad75.eligibilityStatus !== 'Not Eligible') {
      throw new Error('TEST 8 FAILED: 15/20 (75%) must be Not Eligible under 85% threshold');
    }

    // Reset dummy records to PRESENT for clean state
    for (const dr of dummyRecords) {
      dr.status = 'PRESENT';
      await dr.save();
    }

    console.log('✅ TEST 8 PASSED: 100%, 90%, 85% (Eligible), 80%, 75% (Not Eligible), and 0-sessions (No Records) boundary rules verified.\n');

    // ==============================================================
    // TEST 9: Attendance Correction reflects on Student Attendance
    // ==============================================================
    console.log('Test 9: Attendance correction changes status to ABSENT and recalculates percentage');
    await facultyService.correctFacultyAttendance(facultyAUser.id, sess1.id, {
      changes: [
        {
          studentId: st1.id,
          newStatus: 'ABSENT',
          reason: 'Medical Leave (Pending Slip)',
        },
      ],
    });

    const attendanceA1AfterCorrection = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    const cadAfter = attendanceA1AfterCorrection.subjects.find((s) => s.subjectCode === 'BCS101_TEST');
    console.log('CAD after 1 absent correction (19/20):', {
      conducted: cadAfter?.conductedClasses,
      attended: cadAfter?.attendedClasses,
      pct: cadAfter?.attendancePercentage,
      status: cadAfter?.eligibilityStatus,
    });

    if (cadAfter?.conductedClasses !== 20 || cadAfter?.attendedClasses !== 19 || cadAfter?.attendancePercentage !== 95 || cadAfter?.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 9 FAILED: Percentage after 1 absent correction should be 19/20 = 95% (Eligible)');
    }

    // Restore back to PRESENT
    await facultyService.correctFacultyAttendance(facultyAUser.id, sess1.id, {
      changes: [
        {
          studentId: st1.id,
          newStatus: 'PRESENT',
          reason: 'Medical Slip Verified',
        },
      ],
    });

    const attendanceA1Restored = await facultyService.getFacultyStudentAttendance(facultyAUser.id, st1.id, testAcademicYear);
    const cadRestored = attendanceA1Restored.subjects.find((s) => s.subjectCode === 'BCS101_TEST');
    console.log('CAD after restoring to PRESENT (20/20):', {
      conducted: cadRestored?.conductedClasses,
      attended: cadRestored?.attendedClasses,
      pct: cadRestored?.attendancePercentage,
      status: cadRestored?.eligibilityStatus,
    });

    if (cadRestored?.attendedClasses !== 20 || cadRestored?.attendancePercentage !== 100 || cadRestored?.eligibilityStatus !== 'Eligible') {
      throw new Error('TEST 9 FAILED: Percentage after restoration should be 20/20 = 100% (Eligible)');
    }
    console.log('✅ TEST 9 PASSED: Correction immediately reflects on percentage and eligibility.\n');

    // ==============================================================
    // TEST 10: Unauthorized Correction Security
    // Faculty B attempts to correct Faculty A's session
    // ==============================================================
    console.log('Test 10: Unauthorized Correction Security: Faculty B attempts to correct Faculty A session');
    let unauthorizedCaught = false;
    try {
      await facultyService.correctFacultyAttendance(facultyBUser.id, sess1.id, {
        changes: [{ studentId: st1.id, newStatus: 'ABSENT', reason: 'Malicious Attempt' }],
      });
    } catch (err: any) {
      unauthorizedCaught = true;
      console.log('Expected error caught:', err.message);
    }

    if (!unauthorizedCaught) {
      throw new Error('TEST 10 CRITICAL SECURITY FAILURE: Faculty B was able to modify Faculty A attendance!');
    }
    console.log('✅ TEST 10 PASSED: Unauthorized correction blocked with error.\n');

    console.log('===============================================================');
    console.log('🎉 ALL 10 TESTS PASSED SUCCESSFULLY! FULL AUTHORIZATION VERIFIED.');
    console.log('===============================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

runTestSuite();
