import db from '../config/database';
import { QueryTypes } from 'sequelize';

async function auditFacultyTables() {
  await db.authenticate();

  // 1. faculty_authorization_requests
  try {
    const authReqs: any[] = await db.query(`SELECT id, "facultyUserId", "createdByHODId", status, "authority" FROM faculty_authorization_requests;`, { type: QueryTypes.SELECT });
    console.log(`\nfaculty_authorization_requests (${authReqs.length} rows):`);
    console.table(authReqs);
  } catch (e: any) {
    console.log('faculty_authorization_requests table query error:', e.message);
  }

  // 2. faculty_assignments
  try {
    const assignments: any[] = await db.query(
      `SELECT fa.id, fa."facultyId", fa."userId", fa."teacherId", fa."subjectId", fa."departmentId", fa."teachingDepartmentId", fa.section, fa.semester, fa."academicYear", u.email as "userEmail", u."firstName"
       FROM faculty_assignments fa
       LEFT JOIN users u ON fa."userId" = u.id;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`\nfaculty_assignments (${assignments.length} rows):`);
    console.table(assignments);
  } catch (e: any) {
    console.log('faculty_assignments table query error:', e.message);
  }

  // 3. teachers
  try {
    const teachers: any[] = await db.query(
      `SELECT t.id, t."userId", t."departmentId", t.designation, u.email as "userEmail", u."firstName", u."lastName", u.role, d.code as "deptCode"
       FROM teachers t
       LEFT JOIN users u ON t."userId" = u.id
       LEFT JOIN departments d ON t."departmentId" = d.id;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`\nteachers (${teachers.length} rows):`);
    console.table(teachers);
  } catch (e: any) {
    console.log('teachers table query error:', e.message);
  }

  // 4. attendance_sessions
  try {
    const sessions: any[] = await db.query(
      `SELECT id, "facultyAssignmentId", "departmentId", "subjectId", semester, section, date, period, status
       FROM attendance_sessions;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`\nattendance_sessions (${sessions.length} rows):`);
    console.table(sessions);
  } catch (e: any) {
    console.log('attendance_sessions table query error:', e.message);
  }

  process.exit(0);
}

auditFacultyTables().catch((err) => {
  console.error(err);
  process.exit(1);
});
