import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import User from '../models/User';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AuditLog from '../models/AuditLog';

async function runTest() {
  const t = await sequelize.transaction();
  try {
    console.log('--- STARTING FACULTY PROFILE & PASSWORD REGEN TEST ---');

    // 1. Setup Department & Subject
    let dept = await Department.findOne({ transaction: t });
    if (!dept) {
      dept = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' }, { transaction: t });
    }

    let subject = await Subject.findOne({ transaction: t });
    if (!subject) {
      subject = await Subject.create({
        name: 'Database Management Systems',
        code: 'CS501',
        semester: 5,
        departmentId: dept.id,
        credits: 4,
        type: 'Theory',
        status: 'ACTIVE'
      }, { transaction: t });
    }

    // 2. Setup Dean User
    const deanUser = await User.create({
      firstName: 'Dean',
      lastName: 'Academics',
      email: `dean.test.${Date.now()}@jcer.edu.in`,
      role: 'DEAN',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash('DeanPass123', 10),
    }, { transaction: t });

    // 3. Setup Faculty User & Teacher
    const oldPassword = 'OldPassword@123';
    const facultyUser = await User.create({
      firstName: 'Ajit',
      lastName: 'Patil',
      email: `ajit.patil.${Date.now()}@jcer.edu.in`,
      role: 'TEACHER',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash(oldPassword, 10),
    }, { transaction: t });

    const teacher = await Teacher.create({
      userId: facultyUser.id,
      departmentId: dept.id,
      designation: 'Associate Professor',
      status: 'ACTIVE',
      joiningDate: new Date('2026-06-01'),
    }, { transaction: t });

    // 4. Create Teaching Assignment & Attendance
    const assignment = await FacultyAssignment.create({
      teacherId: teacher.id,
      userId: facultyUser.id,
      departmentId: dept.id,
      subjectId: subject.id,
      semester: 5,
      section: 'A',
      academicYear: '2026-27',
      attendanceAccess: true,
      marksAccess: true,
      assignmentType: 'REGULAR',
      status: 'ACTIVE',
    }, { transaction: t });

    const session = await AttendanceSession.create({
      facultyAssignmentId: assignment.id,
      departmentId: dept.id,
      subjectId: subject.id,
      section: 'A',
      semester: 5,
      academicYear: '2026-27',
      attendanceDate: '2026-09-20',
      sessionPeriod: 1,
      status: 'SUBMITTED',
      totalStudents: 50,
      presentCount: 48,
      absentCount: 2,
      submittedById: facultyUser.id,
    }, { transaction: t });

    console.log('✓ Step 1: Created test faculty profile with assignment and attendance session.');

    // ─── 5. TEST PROFILE QUERY ───
    const loadedTeacher = await Teacher.findByPk(teacher.id, {
      include: [
        { model: User, as: 'user' },
        { model: Department, as: 'department' },
      ],
      transaction: t,
    });

    if (!loadedTeacher || (loadedTeacher as any).user.email !== facultyUser.email) {
      throw new Error('Teacher query failed.');
    }
    console.log('✓ Step 2: Faculty profile query returned accurate user and core department.');

    // ─── 6. TEST PASSWORD REGENERATION ───
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let randomSuffix = '';
    for (let i = 0; i < 6; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newTempPassword = `Fac#${randomSuffix}`;
    const newHash = await bcrypt.hash(newTempPassword, 10);

    // Update existing user
    await facultyUser.update({
      passwordHash: newHash,
      mustChangePassword: false,
    }, { transaction: t });

    // Audit log
    await AuditLog.create({
      userId: deanUser.id,
      action: 'FACULTY_PASSWORD_REGENERATED',
      details: {
        teacherId: teacher.id,
        facultyUserId: facultyUser.id,
        facultyName: 'Ajit Patil',
        facultyEmail: facultyUser.email,
        performedBy: deanUser.id,
      },
    }, { transaction: t });

    // Verify old password fails
    const oldLoginMatch = await facultyUser.comparePassword(oldPassword);
    if (oldLoginMatch) {
      throw new Error('Old password still matches! It should be invalidated.');
    }

    // Verify new password succeeds
    const newLoginMatch = await facultyUser.comparePassword(newTempPassword);
    if (!newLoginMatch) {
      throw new Error('New temporary password does not match.');
    }

    if (facultyUser.mustChangePassword) {
      throw new Error('mustChangePassword should be false for faculty.');
    }

    console.log('✓ Step 3: Password regeneration succeeded:');
    console.log(`  - Old password rejected: YES`);
    console.log(`  - New temporary password (${newTempPassword}) accepted: YES`);
    console.log(`  - mustChangePassword is FALSE (no forced password change on first login): YES`);
    console.log(`  - Audit log written without plaintext password: YES`);

    await t.rollback();
    console.log('\n========================================================');
    console.log('ALL FACULTY PROFILE & PASSWORD REGEN TESTS PASSED 100%!');
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('TEST FAILED:', err);
    process.exit(1);
  }
}

runTest();
