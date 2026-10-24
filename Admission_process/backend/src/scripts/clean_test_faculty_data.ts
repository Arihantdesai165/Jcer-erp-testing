import db from '../config/database';
import { QueryTypes } from 'sequelize';
import User from '../models/User';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import Department from '../models/Department';
import Student from '../models/Student';

async function cleanOldTestFacultyData() {
  await db.authenticate();
  console.log('======================================================');
  console.log('STARTING CONTROLLED DATABASE CLEANUP OF TEST FACULTY');
  console.log('======================================================\n');

  const t = await db.transaction();

  try {
    // 1. Identify all Teacher Users to be cleaned
    const teacherUsers = await User.findAll({
      where: { role: 'TEACHER' },
      attributes: ['id', 'email', 'firstName', 'lastName'],
      transaction: t,
    });

    console.log(`Identified ${teacherUsers.length} old/test faculty accounts for cleanup:`);
    teacherUsers.forEach((u) => console.log(`  - [TEACHER] ${u.email} (${u.firstName} ${u.lastName}) [ID: ${u.id}]`));

    const teacherUserIds = teacherUsers.map((u) => u.id);

    // 2. Identify Teacher profile records
    const teachers = await Teacher.findAll({
      where: { userId: teacherUserIds },
      attributes: ['id', 'userId'],
      transaction: t,
    });
    const teacherIds = teachers.map((t) => t.id);
    console.log(`\nIdentified ${teachers.length} teacher profile records.`);

    // 3. Clear old faculty_authorization_requests
    const authDeleted = await db.query(
      `DELETE FROM faculty_authorization_requests WHERE "facultyUserId" IN (:teacherUserIds) OR "createdByHODId" IS NOT NULL;`,
      {
        replacements: { teacherUserIds: teacherUserIds.length ? teacherUserIds : ['00000000-0000-0000-0000-000000000000'] },
        type: QueryTypes.DELETE,
        transaction: t,
      }
    );
    console.log(`Cleaned old faculty_authorization_requests.`);

    // 4. Identify faculty assignments for these teachers
    const assignments = await FacultyAssignment.findAll({
      where: { userId: teacherUserIds },
      attributes: ['id'],
      transaction: t,
    });
    const assignmentIds = assignments.map((a) => a.id);
    console.log(`Identified ${assignmentIds.length} faculty assignments for cleanup.`);

    if (assignmentIds.length > 0) {
      // 5. Delete Attendance Records associated with these assignments
      await db.query(
        `DELETE FROM attendance_records WHERE "facultyAssignmentId" IN (:assignmentIds);`,
        {
          replacements: { assignmentIds },
          type: QueryTypes.DELETE,
          transaction: t,
        }
      );
      console.log(`Cleaned attendance_records.`);

      // 6. Delete Attendance Sessions associated with these assignments
      await db.query(
        `DELETE FROM attendance_sessions WHERE "facultyAssignmentId" IN (:assignmentIds);`,
        {
          replacements: { assignmentIds },
          type: QueryTypes.DELETE,
          transaction: t,
        }
      );
      console.log(`Cleaned attendance_sessions.`);

      // 7. Delete Faculty Assignments
      await FacultyAssignment.destroy({
        where: { id: assignmentIds },
        transaction: t,
      });
      console.log(`Cleaned faculty_assignments.`);
    }

    // 8. Delete any other attendance sessions / records submitted by teacher users
    if (teacherUserIds.length > 0) {
      await db.query(
        `DELETE FROM attendance_sessions WHERE "submittedById" IN (:teacherUserIds);`,
        {
          replacements: { teacherUserIds },
          type: QueryTypes.DELETE,
          transaction: t,
        }
      );

      // 9. Delete Teachers records
      await Teacher.destroy({
        where: { userId: teacherUserIds },
        transaction: t,
      });
      console.log(`Cleaned teachers table records.`);

      // 10. Delete Teacher User records
      await User.destroy({
        where: { id: teacherUserIds },
        transaction: t,
      });
      console.log(`Cleaned user accounts with role TEACHER.`);
    }

    await t.commit();
    console.log('\n✅ TRANSACTION COMMITTED SUCCESSFULLY.');

    // Verification of remaining essential records
    console.log('\n=== VERIFYING PRESERVED DATA ===');
    const adminCount = await User.count({ where: { role: 'ADMIN' } });
    const deanCount = await User.count({ where: { role: 'DEAN' } });
    const principalCount = await User.count({ where: { role: 'PRINCIPAL' } });
    const hodCount = await User.count({ where: { role: 'HOD' } });
    const studentCount = await User.count({ where: { role: 'STUDENT' } });
    const deptCount = await Department.count();
    const remainingFacultyCount = await User.count({ where: { role: 'TEACHER' } });

    console.log(`- Admin Accounts: ${adminCount} (Preserved)`);
    console.log(`- Dean Accounts: ${deanCount} (Preserved)`);
    console.log(`- Principal Accounts: ${principalCount} (Preserved)`);
    console.log(`- HOD Accounts: ${hodCount} (Preserved)`);
    console.log(`- Student Accounts: ${studentCount} (Preserved)`);
    console.log(`- Departments: ${deptCount} (Preserved)`);
    console.log(`- Faculty Accounts remaining: ${remainingFacultyCount} (Cleaned - ready for Dean creation)`);

    console.log('\n======================================================');
    console.log('CLEANUP COMPLETED SUCCESSFULLY');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    await t.rollback();
    console.error('Error during cleanup migration, rolled back:', error);
    process.exit(1);
  }
}

cleanOldTestFacultyData();
