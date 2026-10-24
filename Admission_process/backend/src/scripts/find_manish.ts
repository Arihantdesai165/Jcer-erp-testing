import sequelize from '../config/database';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import { Op } from 'sequelize';

async function f() {
  try {
    await sequelize.authenticate();
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { firstName: { [Op.iLike]: '%Manish%' } },
          { lastName: { [Op.iLike]: '%Singh%' } },
          { email: { [Op.iLike]: '%manish%' } }
        ]
      }
    });
    console.log('USERS FOUND:', users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role, deptId: (u as any).departmentId })));

    const teachers = await Teacher.findAll({
      include: [{ model: User, as: 'user' }, { model: Department, as: 'department' }]
    });
    console.log(`ALL TEACHERS (${teachers.length}):`);
    for (const t of teachers) {
      const raw: any = t;
      console.log({ id: raw.id, userId: raw.userId, name: `${raw.user?.firstName} ${raw.user?.lastName}`, email: raw.user?.email, dept: raw.department?.code });
    }

    const allAssignments = await FacultyAssignment.findAll({
      include: [
        { model: Subject, as: 'subject' },
        { model: User, as: 'user' },
        { model: Department, as: 'department' }
      ]
    });
    console.log(`\nALL FACULTY ASSIGNMENTS IN DB (${allAssignments.length}):`);
    for (const a of allAssignments) {
      const raw: any = a;
      console.log({
        id: raw.id,
        user: `${raw.user?.firstName} ${raw.user?.lastName}`,
        subject: `${raw.subject?.name} (${raw.subject?.code})`,
        subjectCycle: raw.subject?.cycle,
        sem: raw.semester,
        sec: raw.section,
        branch: raw.branch,
        ay: raw.academicYear,
        assignmentDeptCode: raw.department?.code,
        assignmentDeptId: raw.departmentId,
        subjectDeptId: raw.subject?.departmentId,
        status: raw.status
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}
f();
