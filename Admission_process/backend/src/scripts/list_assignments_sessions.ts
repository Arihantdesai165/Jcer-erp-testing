import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import User from '../models/User';
import Department from '../models/Department';
import Subject from '../models/Subject';
import AttendanceSession from '../models/AttendanceSession';

async function listAssignmentsAndSessions() {
  await db.authenticate();

  const assignments = await FacultyAssignment.findAll({
    include: [
      { model: User, as: 'user', attributes: ['email', 'firstName', 'lastName'] },
      { model: Department, as: 'department', attributes: ['code', 'name'] },
      { model: Subject, as: 'subject', attributes: ['code', 'name'] },
    ],
  });

  console.log(`\n=== FACULTY ASSIGNMENTS (${assignments.length}) ===`);
  assignments.forEach((a: any) => {
    console.log(`ID: ${a.id} | User: ${a.user?.email} (${a.user?.firstName} ${a.user?.lastName}) | Dept: ${a.department?.code} | Subject: ${a.subject?.code} | Sec: ${a.section} | Sem: ${a.semester} | AY: ${a.academicYear}`);
  });

  const sessions = await AttendanceSession.findAll({
    include: [
      { model: Department, as: 'department', attributes: ['code'] },
      { model: Subject, as: 'subject', attributes: ['code'] },
    ],
  });
  console.log(`\n=== ATTENDANCE SESSIONS (${sessions.length}) ===`);
  sessions.forEach((s: any) => {
    console.log(`ID: ${s.id} | AssignmentID: ${s.facultyAssignmentId} | Dept: ${s.department?.code} | Subject: ${s.subject?.code} | Date: ${s.attendanceDate} | Period: ${s.sessionPeriod} | Status: ${s.status} | Present: ${s.presentCount}/${s.totalStudents}`);
  });

  process.exit(0);
}

listAssignmentsAndSessions().catch((err) => {
  console.error(err);
  process.exit(1);
});
