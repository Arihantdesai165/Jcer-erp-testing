import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import User from '../models/User';
import Student from '../models/Student';
import Section from '../models/Section';
import Subject from '../models/Subject';
import { facultyService } from '../services/faculty.service';

async function testFutureAttendance() {
  const t = await sequelize.transaction();
  try {
    console.log('--- TESTING FACULTY FUTURE ATTENDANCE DATE HANDLING ---');

    // Find active assignment
    const assignment = await FacultyAssignment.findOne({
      where: { status: 'ACTIVE', attendanceAccess: true },
      include: [
        { model: User, as: 'user' },
        { model: Subject, as: 'subject' },
      ],
    });

    if (!assignment) {
      throw new Error('No active attendance assignment found for testing.');
    }

    const item: any = assignment;
    console.log(`Using Assignment: ID=${item.id}, Subject=${item.subject?.name}, Section=${item.section}, User=${item.user?.email}`);

    // Get workspace to fetch enrolled students
    const workspace = await facultyService.getFacultyAttendanceWorkspace(assignment.userId, assignment.id);
    if (!workspace.students || workspace.students.length === 0) {
      throw new Error('No students enrolled in assignment section.');
    }
    console.log(`Loaded workspace with ${workspace.students.length} students.`);

    // 1. Test Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const recordsTomorrow = workspace.students.map((st: any) => ({
      studentId: st.id,
      status: 'PRESENT' as const,
    }));

    console.log(`\nTest 1: Saving attendance for tomorrow (${tomorrowStr})...`);
    const savedTomorrow = await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
      date: tomorrowStr,
      sessionPeriod: 1,
      records: recordsTomorrow,
    });
    console.log(`✓ Attendance saved successfully for tomorrow (${tomorrowStr}). Total Conducted: ${savedTomorrow.students.length}`);

    // 2. Test 7 days in future
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split('T')[0];

    console.log(`\nTest 2: Saving attendance for 7 days in future (${in7DaysStr})...`);
    const saved7Days = await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
      date: in7DaysStr,
      sessionPeriod: 2,
      records: recordsTomorrow,
    });
    console.log(`✓ Attendance saved successfully for 7 days in future (${in7DaysStr}).`);

    // 3. Test next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    console.log(`\nTest 3: Saving attendance for next month (${nextMonthStr})...`);
    const savedNextMonth = await facultyService.saveFacultyAttendance(assignment.userId, assignment.id, {
      date: nextMonthStr,
      sessionPeriod: 3,
      records: recordsTomorrow,
    });
    console.log(`✓ Attendance saved successfully for next month (${nextMonthStr}).`);

    // 4. Test reloading workspace for tomorrow - should load existing attendance without creating duplicate
    console.log(`\nTest 4: Reloading workspace and checking session for tomorrow (${tomorrowStr})...`);
    const reloadedWs = await facultyService.getFacultyAttendanceWorkspace(assignment.userId, assignment.id);
    const tomSession = reloadedWs.recordedSessions?.find((s) => s.date === tomorrowStr && s.sessionPeriod === 1);
    if (!tomSession) {
      throw new Error(`Expected recorded session for ${tomorrowStr} (Period 1) not found in workspace.`);
    }
    console.log(`✓ Existing attendance loaded for future date: ${tomSession.presentCount} Present, ${tomSession.absentCount} Absent (${tomSession.percentage}%).`);

    // 5. Clean up created test sessions in transaction rollback
    await t.rollback();
    // Also delete any sessions created if they used direct connection (facultyService opens its own transaction)
    await AttendanceRecord.destroy({
      where: {
        facultyAssignmentId: assignment.id,
        date: [tomorrowStr, in7DaysStr, nextMonthStr],
      },
    });
    await AttendanceSession.destroy({
      where: {
        facultyAssignmentId: assignment.id,
        attendanceDate: [tomorrowStr, in7DaysStr, nextMonthStr],
      },
    });

    console.log('\n========================================================');
    console.log('ALL FUTURE ATTENDANCE DATE TESTS PASSED 100%!');
    console.log('========================================================');
  } catch (err) {
    await t.rollback();
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

testFutureAttendance();
