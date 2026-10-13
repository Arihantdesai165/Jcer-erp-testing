import sequelize from '../config/database';
import Department from '../models/Department';
import User from '../models/User';
import Subject from '../models/Subject';
import Student from '../models/Student';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import facultyService from '../services/faculty.service';

async function testLiveUpdates() {
  console.log('========================================================================');
  console.log('TEST C: LIVE ATTENDANCE UPDATE & RECALCULATION VERIFICATION');
  console.log('========================================================================\n');

  const t = await sequelize.transaction();
  try {
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!cseDept) throw new Error('CSE department not found.');

    const rahulUser = await User.findOne({ where: { email: 'rahul.sharma.test@jcer.edu' } });
    if (!rahulUser) throw new Error('Rahul Sharma not found.');

    const academicYear = '2026-27';
    const semester = 1;

    // 1. Initial State
    const regBefore = await facultyService.getFacultyAllSubjectAttendanceRegister(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester, departmentId: cseDept.id, section: 'A' }
    );

    const testStudent = regBefore.students[0];
    const testSubject = regBefore.subjects[0];
    console.log(`Target Student: ${testStudent.name} (${testStudent.usn})`);
    console.log(`Target Subject: ${testSubject.code} (${testSubject.name})`);
    console.log(`Initial Attended for ${testSubject.code}: ${testStudent.subjectStats[testSubject.id]?.attended || 0}`);
    console.log(`Initial Total Attended: ${testStudent.totalAttended}`);

    // Find assignment for this subject & sec A
    const assignment = await FacultyAssignment.findOne({
      where: { subjectId: testSubject.id, semester: 1, section: 'A', status: 'ACTIVE' },
    });
    if (!assignment) throw new Error('Assignment not found.');

    // 2. Simulate saving a new attendance session with PRESENT status for testStudent
    const testDate = '2026-10-13';
    const session = await AttendanceSession.create(
      {
        facultyAssignmentId: assignment.id,
        departmentId: cseDept.id,
        subjectId: testSubject.id,
        semester: 1,
        section: 'A',
        academicYear,
        attendanceDate: testDate,
        sessionPeriod: 99, // test period
        sessionType: 'THEORY',
        topicsCovered: 'Verification topic',
        status: 'SUBMITTED',
        totalStudents: 30,
        presentCount: 1,
        absentCount: 29,
        percentage: 3.33,
      },
      { transaction: t }
    );

    await AttendanceRecord.create(
      {
        attendanceSessionId: session.id,
        facultyAssignmentId: assignment.id,
        date: testDate,
        studentId: testStudent.id,
        subjectId: testSubject.id,
        departmentId: cseDept.id,
        semester: 1,
        academicYear,
        status: 'PRESENT',
      },
      { transaction: t }
    );

    // 3. Query register within the transaction or after commit
    // To test live database reflection, commit transaction then verify, then clean up
    await t.commit();
    console.log('✓ Simulated attendance session & record created in PostgreSQL.');

    const regAfter = await facultyService.getFacultyAllSubjectAttendanceRegister(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester, departmentId: cseDept.id, section: 'A' }
    );

    const updatedStudent = regAfter.students.find((s) => s.id === testStudent.id);
    if (!updatedStudent) throw new Error('Student not found after refresh.');

    const newAttended = updatedStudent.subjectStats[testSubject.id]?.attended || 0;
    const newTotalAttended = updatedStudent.totalAttended;
    console.log(`Updated Attended for ${testSubject.code}: ${newAttended}`);
    console.log(`Updated Total Attended: ${newTotalAttended}`);
    console.log(`Updated Overall %: ${updatedStudent.overallPercentage}%`);

    if (newAttended <= (testStudent.subjectStats[testSubject.id]?.attended || 0)) {
      throw new Error('TEST C FAILED: Attended count did not increase upon attendance save.');
    }
    console.log('✓ TEST C PASSED: Register immediately recalculated with latest saved attendance.');

    // 4. Clean up test records
    await AttendanceRecord.destroy({ where: { attendanceSessionId: session.id } });
    await AttendanceSession.destroy({ where: { id: session.id } });
    console.log('✓ Test records cleaned up successfully.');

    console.log('\n========================================================================');
    console.log('TEST C COMPLETED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } catch (err: any) {
    if (!t.afterCommit) {
      await t.rollback();
    }
    console.error('❌ TEST C FAILED:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testLiveUpdates();
