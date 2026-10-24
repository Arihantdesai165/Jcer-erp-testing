import db from '../config/database';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';

async function inspectFacultyData() {
  await db.authenticate();
  console.log('=== DATABASE FACULTY AUDIT ===\n');

  // 1. All Users by Role
  const allUsers = await User.findAll({
    attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'status'],
  });
  console.log(`Total Users in DB: ${allUsers.length}`);
  const byRole: Record<string, any[]> = {};
  allUsers.forEach((u: any) => {
    byRole[u.role] = byRole[u.role] || [];
    byRole[u.role].push({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`, status: u.status });
  });
  for (const [role, users] of Object.entries(byRole)) {
    console.log(`\nRole: ${role} (${users.length} users):`);
    users.forEach((u) => console.log(`  - [${u.status}] ${u.email} (${u.name}) [ID: ${u.id}]`));
  }

  // 2. All Teachers
  const teachers = await Teacher.findAll({
    include: [
      { model: User, as: 'user', attributes: ['email', 'firstName', 'lastName', 'role', 'status'] },
      { model: Department, as: 'department', attributes: ['code', 'name'] },
    ],
  });
  console.log(`\nTotal Teachers in DB: ${teachers.length}`);
  teachers.forEach((t: any) => {
    console.log(`  - Teacher ID: ${t.id} | User: ${t.user?.email} (${t.user?.firstName} ${t.user?.lastName}) | Core Dept: ${t.department?.code} | Designation: ${t.designation}`);
  });

  // 3. Faculty Assignments
  const assignments = await FacultyAssignment.findAll();
  console.log(`\nTotal Faculty Assignments: ${assignments.length}`);
  assignments.forEach((a: any) => {
    console.log(`  - Assignment ID: ${a.id} | Faculty ID: ${a.facultyId} | Subject ID: ${a.subjectId} | Teaching Dept: ${a.teachingDepartmentId || a.departmentId} | Sec: ${a.section} | Sem: ${a.semester} | AY: ${a.academicYear}`);
  });

  // 4. Attendance Sessions
  const sessions = await AttendanceSession.count();
  console.log(`\nTotal Attendance Sessions: ${sessions}`);

  // 5. Attendance Records
  const records = await AttendanceRecord.count();
  console.log(`Total Attendance Records: ${records}`);

  process.exit(0);
}

inspectFacultyData().catch((err) => {
  console.error(err);
  process.exit(1);
});
