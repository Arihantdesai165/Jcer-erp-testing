import sequelize from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import { Op } from 'sequelize';

async function investigate() {
  try {
    await sequelize.authenticate();

    // 1. All subjects
    const allSubjects = await Subject.findAll({ order: [['code', 'ASC']] });
    console.log(`=== ALL SUBJECTS IN DB (${allSubjects.length}) ===`);
    for (const s of allSubjects) {
      console.log({
        id: s.id,
        code: s.code,
        name: s.name,
        sem: s.semester,
        cycle: s.cycle,
        type: s.type,
        deptId: s.departmentId
      });
    }

    // 2. All teachers
    const teachers = await Teacher.findAll({
      include: [
        { model: User, as: 'user' },
        { model: Department, as: 'department' }
      ]
    });
    console.log(`\n=== ALL TEACHERS (${teachers.length}) ===`);
    for (const t of teachers) {
      const raw: any = t;
      console.log({
        id: raw.id,
        userId: raw.userId,
        name: `${raw.user?.firstName} ${raw.user?.lastName}`,
        email: raw.user?.email,
        dept: raw.department?.code
      });
    }

    // 3. All Faculty Assignments
    const allAssignments = await FacultyAssignment.findAll({
      include: [
        { model: Subject, as: 'subject' },
        { model: User, as: 'user' },
        { model: Department, as: 'department' }
      ]
    });
    console.log(`\n=== ALL FACULTY ASSIGNMENTS (${allAssignments.length}) ===`);
    for (const a of allAssignments) {
      const raw: any = a;
      console.log({
        id: raw.id,
        user: `${raw.user?.firstName} ${raw.user?.lastName}`,
        userId: raw.userId,
        subject: `${raw.subject?.name} (${raw.subject?.code})`,
        subjectId: raw.subjectId,
        sem: raw.semester,
        sec: raw.section,
        branch: raw.branch,
        ay: raw.academicYear,
        assignmentDeptCode: raw.department?.code,
        assignmentDeptId: raw.departmentId,
        status: raw.status
      });
    }

    // 4. Sample students
    const someStudents = await Student.findAll({
      limit: 10,
      include: [{ model: User, as: 'user' }, { model: Department, as: 'department' }]
    });
    console.log(`\n=== SAMPLE STUDENTS (${someStudents.length}) ===`);
    for (const s of someStudents) {
      const raw: any = s;
      console.log({
        id: raw.id,
        usn: raw.usn,
        name: `${raw.user?.firstName} ${raw.user?.lastName}`,
        dept: raw.department?.code,
        sem: raw.semester,
        sec: raw.section
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}
investigate();
