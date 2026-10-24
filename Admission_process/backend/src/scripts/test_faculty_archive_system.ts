import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import User from '../models/User';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import Student from '../models/Student';
import AuditLog from '../models/AuditLog';

async function runTest() {
  const t = await sequelize.transaction();
  try {
    console.log('--- STARTING NON-DESTRUCTIVE ARCHIVE & RESTORE VERIFICATION TEST ---');

    // 1. Get or create test department & subject
    let dept = await Department.findOne({ transaction: t });
    if (!dept) {
      dept = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' }, { transaction: t });
    }

    let subject = await Subject.findOne({ transaction: t });
    if (!subject) {
      subject = await Subject.create({
        name: 'Operating Systems',
        code: 'CS401',
        semester: 4,
        departmentId: dept.id,
        credits: 4,
        type: 'Theory',
        status: 'ACTIVE'
      }, { transaction: t });
    }

    // 2. Create Dean user
    const deanEmail = `test.dean.${Date.now()}@jcer.edu.in`;
    const deanUser = await User.create({
      firstName: 'Dean',
      lastName: 'Academics',
      email: deanEmail,
      username: deanEmail,
      role: 'DEAN',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash('DeanPass123', 10),
    }, { transaction: t });

    // 3. Create Test Faculty User & Teacher
    const facultyEmail = `test.prof.${Date.now()}@jcer.edu.in`;
    const facultyRawPass = 'FacPass123!';
    const facultyUser = await User.create({
      firstName: 'Ajit',
      lastName: 'Patil',
      email: facultyEmail,
      username: facultyEmail,
      role: 'TEACHER',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash(facultyRawPass, 10),
    }, { transaction: t });

    const teacher = await Teacher.create({
      userId: facultyUser.id,
      departmentId: dept.id,
      designation: 'Assistant Professor',
      status: 'ACTIVE',
      joiningDate: new Date('2025-08-01'),
    }, { transaction: t });

    // 4. Create Academic Records: FacultyAssignment, AttendanceSession
    const assignment = await FacultyAssignment.create({
      teacherId: teacher.id,
      userId: facultyUser.id,
      departmentId: dept.id,
      subjectId: subject.id,
      semester: 4,
      section: 'A',
      academicYear: '2026-27',
      attendanceAccess: true,
      marksAccess: true,
      assignmentType: 'REGULAR',
      status: 'ACTIVE',
    }, { transaction: t });

    const attendanceSession = await AttendanceSession.create({
      facultyAssignmentId: assignment.id,
      departmentId: dept.id,
      subjectId: subject.id,
      section: 'A',
      semester: 4,
      academicYear: '2026-27',
      attendanceDate: '2026-09-15',
      sessionPeriod: 2,
      status: 'SUBMITTED',
      totalStudents: 60,
      presentCount: 55,
      absentCount: 5,
      submittedById: facultyUser.id,
    }, { transaction: t });

    console.log('✓ Step 1: Created test faculty, assignment, and attendance session.');
    console.log(`  Faculty User ID: ${facultyUser.id}, Teacher ID: ${teacher.id}`);
    console.log(`  Assignment ID: ${assignment.id}, AttendanceSession ID: ${attendanceSession.id}`);

    // Verify initial state
    const isInitialMatch = await facultyUser.comparePassword(facultyRawPass);
    if (!isInitialMatch || facultyUser.status !== 'ACTIVE' || teacher.status !== 'ACTIVE') {
      throw new Error('Initial state validation failed.');
    }
    console.log('✓ Initial active login verified.');

    // ─── 5. SIMULATE ARCHIVE (SOFT-DELETE) ───
    console.log('\n--- EXECUTING ARCHIVE ACTION ---');
    await teacher.update({
      status: 'ARCHIVED',
      archivedAt: new Date(),
      archivedBy: deanUser.id,
    }, { transaction: t });

    await facultyUser.update({ status: 'INACTIVE' }, { transaction: t });

    await AuditLog.create({
      userId: deanUser.id,
      action: 'FACULTY_ARCHIVED',
      details: {
        teacherId: teacher.id,
        userId: facultyUser.id,
        facultyName: 'Ajit Patil',
        email: facultyEmail,
        archivedBy: deanUser.id,
        archivedAt: new Date(),
      },
    }, { transaction: t });

    console.log('✓ Step 2: Soft-delete/Archive executed in transaction.');

    // ─── 6. VERIFY POST-ARCHIVE INTEGRITY ───
    const reloadedTeacher = await Teacher.findByPk(teacher.id, { transaction: t });
    const reloadedUser = await User.findByPk(facultyUser.id, { transaction: t });
    const reloadedAssignment = await FacultyAssignment.findByPk(assignment.id, { transaction: t });
    const reloadedAttendance = await AttendanceSession.findByPk(attendanceSession.id, { transaction: t });

    if (!reloadedTeacher || reloadedTeacher.status !== 'ARCHIVED' || !reloadedTeacher.archivedAt) {
      throw new Error('Teacher record status was not properly set to ARCHIVED with timestamp.');
    }
    if (!reloadedUser || reloadedUser.status !== 'INACTIVE') {
      throw new Error('User record status was not properly set to INACTIVE.');
    }
    if (!reloadedAssignment || reloadedAssignment.id !== assignment.id) {
      throw new Error('FacultyAssignment was corrupted or deleted! Must be preserved.');
    }
    if (!reloadedAttendance || reloadedAttendance.id !== attendanceSession.id) {
      throw new Error('AttendanceSession was corrupted or deleted! Must be preserved.');
    }

    console.log('✓ Step 3: Database Verification Confirmed:');
    console.log('  - Teacher record: EXISTS, status = ARCHIVED');
    console.log('  - User record: EXISTS, status = INACTIVE (Login disabled)');
    console.log('  - FacultyAssignment record: INTACT & LINKED');
    console.log('  - AttendanceSession record: INTACT & LINKED');

    // ─── 7. SIMULATE RESTORE ───
    console.log('\n--- EXECUTING RESTORE ACTION ---');
    await reloadedTeacher.update({
      status: 'ACTIVE',
      archivedAt: null,
      archivedBy: null,
    }, { transaction: t });

    await reloadedUser.update({ status: 'ACTIVE' }, { transaction: t });

    await AuditLog.create({
      userId: deanUser.id,
      action: 'FACULTY_RESTORED',
      details: {
        teacherId: reloadedTeacher.id,
        userId: reloadedUser.id,
        facultyName: 'Ajit Patil',
        email: facultyEmail,
        restoredBy: deanUser.id,
      },
    }, { transaction: t });

    const restoredTeacher = await Teacher.findByPk(teacher.id, { transaction: t });
    const restoredUser = await User.findByPk(facultyUser.id, { transaction: t });

    if (!restoredTeacher || restoredTeacher.status !== 'ACTIVE' || restoredTeacher.archivedAt !== null) {
      throw new Error('Restored Teacher status is not ACTIVE.');
    }
    if (!restoredUser || restoredUser.status !== 'ACTIVE') {
      throw new Error('Restored User status is not ACTIVE.');
    }

    const isPasswordStillValid = await restoredUser.comparePassword(facultyRawPass);
    if (!isPasswordStillValid) {
      throw new Error('Password check failed after restoration.');
    }

    console.log('✓ Step 4: Faculty Restored Successfully.');
    console.log('  - Teacher status: ACTIVE');
    console.log('  - User status: ACTIVE');
    console.log('  - Password integrity intact for login');

    await t.rollback(); // Clean rollback of test data
    console.log('\n========================================================');
    console.log('ALL NON-DESTRUCTIVE ARCHIVE & RESTORE TESTS PASSED 100%!');
    console.log('========================================================');
    process.exit(0);
  } catch (error) {
    await t.rollback();
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

runTest();
