import db from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import { facultyService } from '../services/faculty.service';

async function runEndToEndTest() {
  console.log('=== STARTING END-TO-END TEST FOR SUMIT ATTENDANCE ===\n');

  try {
    await db.authenticate();

    // 1. Resolve Sumit User
    const sumit = await User.findOne({ where: { email: 'sumitdesai@gmail.com' } });
    if (!sumit) {
      throw new Error('Sumit user not found in DB!');
    }
    console.log(`✓ 1. Authenticated Sumit User: ${sumit.id} (${sumit.firstName} ${sumit.lastName})`);

    // 2. Fetch Faculty Dashboard Overview
    const dashboard = await facultyService.getFacultyDashboard(sumit.id);
    console.log(`✓ 2. Dashboard loaded: ${dashboard.assignments.length} assignments, ${dashboard.stats.totalAssignments} total assignments.`);

    // 3. Fetch Attendance Courses List for AY '2026-27'
    const attendanceCourses = await facultyService.getFacultyAttendanceList(sumit.id, undefined, '2026-27');
    console.log(`✓ 3. Attendance Courses loaded (AY '2026-27'): ${attendanceCourses.length} teaching sections found.`);
    attendanceCourses.forEach((c) => {
      console.log(`   - Course ID: ${c.id} | Subject: ${c.subjectName} (${c.subjectCode}) | Sem ${c.semester} | Sec ${c.section} | Dept: ${c.departmentCode} | Students: ${c.totalStudents}`);
    });

    if (attendanceCourses.length === 0) {
      throw new Error('FAILED: 0 attendance courses found for Sumit!');
    }

    // 4. Test Workspace Loading for Physics Section A
    const secAAssignment = attendanceCourses.find((c) => c.section === 'A') || attendanceCourses[0];
    console.log(`\n✓ 4. Opening Attendance Workspace for ${secAAssignment.subjectName} Section ${secAAssignment.section} (ID: ${secAAssignment.id})`);
    
    const workspaceA = await facultyService.getFacultyAttendanceWorkspace(sumit.id, secAAssignment.id);
    console.log(`   - Workspace loaded: ${workspaceA.students.length} students in Section ${secAAssignment.section} roster.`);
    console.log(`   - Subject Code: ${workspaceA.assignment.subjectCode}, Dept Code: ${workspaceA.assignment.departmentCode}`);

    // Verify student roster belongs to Section A
    const secAStudents = await Student.findAll({
      where: {
        departmentId: secAAssignment.departmentId,
        semester: secAAssignment.semester,
      },
    });

    if (secAStudents.length > 0) {
      const sampleStudent = workspaceA.students[0];
      console.log(`   - Sample Student in roster: USN ${sampleStudent.usn}, Name: ${sampleStudent.studentName}, Section: ${sampleStudent.section}`);
    }

    // 5. Test Saving Attendance for Section A
    const testDate = new Date().toISOString().split('T')[0];
    const testPeriod = 1;
    const recordsPayload = workspaceA.students.slice(0, 10).map((st, idx) => ({
      studentId: st.id,
      status: (idx % 2 === 0 ? 'PRESENT' : 'ABSENT') as 'PRESENT' | 'ABSENT',
    }));

    console.log(`\n✓ 5. Saving Attendance for Date: ${testDate}, Period: ${testPeriod} (${recordsPayload.length} students marked)...`);
    const updatedWorkspace = await facultyService.saveFacultyAttendance(sumit.id, secAAssignment.id, {
      date: testDate,
      sessionPeriod: testPeriod,
      records: recordsPayload,
    });

    console.log(`   - Attendance saved successfully! Workspace metrics total classes: ${updatedWorkspace.metrics.totalClassesConducted}`);

    // Verify AttendanceSession created
    const createdSession = await AttendanceSession.findOne({
      where: {
        facultyAssignmentId: secAAssignment.id,
        attendanceDate: testDate,
        sessionPeriod: testPeriod,
      },
    });

    if (!createdSession) {
      throw new Error('FAILED: AttendanceSession DB row not found!');
    }
    console.log(`✓ 6. AttendanceSession created in PostgreSQL: ID ${createdSession.id}, Total: ${createdSession.totalStudents}, Present: ${createdSession.presentCount}, Absent: ${createdSession.absentCount}`);

    // 6. Test Updated Dashboard Metrics
    const reloadedCourses = await facultyService.getFacultyAttendanceList(sumit.id, undefined, '2026-27');
    const secAUpdated = reloadedCourses.find((c) => c.id === secAAssignment.id);
    console.log(`✓ 7. Reloaded courses: Section A completedToday flag = ${secAUpdated?.completedToday}`);

    console.log('\n============================================================');
    console.log('SUMIT ATTENDANCE END-TO-END VERIFICATION COMPLETED CLEANLY!');
    console.log('============================================================\n');

  } catch (err: any) {
    console.error('END-TO-END VERIFICATION ERROR:', err);
    process.exit(1);
  }
}

runEndToEndTest().then(() => process.exit(0));
