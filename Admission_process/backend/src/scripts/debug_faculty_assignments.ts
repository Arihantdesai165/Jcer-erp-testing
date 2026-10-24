import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Subject from '../models/Subject';
import Department from '../models/Department';

async function debugAssignments() {
  await db.authenticate();
  console.log('=== DEBUGGING FACULTY ASSIGNMENTS IN DB ===\n');

  // 1. All Users
  const users = await User.findAll({
    attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
  });
  console.log('Users in DB:');
  users.forEach((u) => {
    console.log(` - User ID: ${u.id}, Name: ${u.firstName} ${u.lastName}, Role: ${u.role}, Email: ${u.email}`);
  });

  // 2. All Teachers
  const teachers = await Teacher.findAll({
    include: [{ model: User, as: 'user' }],
  });
  console.log('\nTeachers in DB:');
  teachers.forEach((t: any) => {
    console.log(` - Teacher ID: ${t.id}, User ID: ${t.userId}, Name: ${t.user?.firstName} ${t.user?.lastName}`);
  });

  // 3. All FacultyAssignments
  const assignments = await FacultyAssignment.findAll({
    include: [
      { model: Subject, as: 'subject' },
      { model: Department, as: 'department' },
      { model: User, as: 'user' },
    ],
  });

  console.log(`\nTotal FacultyAssignments in DB: ${assignments.length}`);
  assignments.forEach((a: any) => {
    console.log(` - ID: ${a.id}`);
    console.log(`   userId: ${a.userId}`);
    console.log(`   teacherId: ${a.teacherId}`);
    console.log(`   subject: ${a.subject?.name || a.subjectId} (${a.subject?.code})`);
    console.log(`   department: ${a.department?.code} (${a.departmentId})`);
    console.log(`   branch: ${a.branch}`);
    console.log(`   semester: ${a.semester}, section: ${a.section}`);
    console.log(`   academicYear: "${a.academicYear}"`);
    console.log(`   status: ${a.status}`);
    console.log(`   attendanceAccess: ${a.attendanceAccess}`);
    console.log('----------------------------------------------------');
  });

  process.exit(0);
}

debugAssignments().catch((err) => {
  console.error(err);
  process.exit(1);
});
