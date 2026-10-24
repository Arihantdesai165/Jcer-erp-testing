import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import User from '../models/User';
import Department from '../models/Department';
import { Op } from 'sequelize';

async function check() {
  try {
    await sequelize.authenticate();
    const subjs = await Subject.findAll({
      where: {
        [Op.or]: [
          { code: { [Op.iLike]: '%BCS10%' } },
          { name: { [Op.iLike]: '%PHY%' } },
          { name: { [Op.iLike]: '%BDE%' } }
        ]
      }
    });
    console.log('=== MATCHING SUBJECTS ===');
    for (const s of subjs) {
      console.log({ id: s.id, name: s.name, code: s.code, cycle: s.cycle, semester: s.semester, deptId: s.departmentId });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { firstName: { [Op.iLike]: '%Manish%' } },
          { lastName: { [Op.iLike]: '%Manish%' } }
        ]
      }
    });
    console.log('=== MANISH USER ===', user ? { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email } : 'NOT FOUND');

    if (user) {
      const userAssignments = await FacultyAssignment.findAll({
        where: { userId: user.id },
        include: [
          { model: Subject, as: 'subject' },
          { model: Department, as: 'department' }
        ]
      });
      console.log('=== ALL ASSIGNMENTS FOR MANISH ===');
      for (const raw of userAssignments) {
        const a: any = raw;
        console.log({
          id: a.id,
          subjectId: a.subjectId,
          subjectName: a.subject?.name,
          subjectCode: a.subject?.code,
          semester: a.semester,
          section: a.section,
          branch: a.branch,
          academicYear: a.academicYear,
          departmentId: a.departmentId,
          departmentCode: a.department?.code,
          status: a.status
        });
      }
    }

    const allAssignments = await FacultyAssignment.findAll({
      include: [
        { model: Subject, as: 'subject' },
        { model: User, as: 'user' },
        { model: Department, as: 'department' }
      ]
    });
    console.log(`=== TOTAL ASSIGNMENTS IN DB: ${allAssignments.length} ===`);
    for (const raw of allAssignments) {
      const a: any = raw;
      if (
        a.subject?.name?.includes('BDE') ||
        a.subject?.code?.includes('103') ||
        a.subject?.name?.includes('PHY') ||
        a.subject?.code?.includes('101')
      ) {
        console.log({
          id: a.id,
          faculty: `${a.user?.firstName} ${a.user?.lastName}`,
          subject: `${a.subject?.name} (${a.subject?.code})`,
          subjectId: a.subjectId,
          sem: a.semester,
          sec: a.section,
          branch: a.branch,
          ay: a.academicYear,
          deptId: a.departmentId,
          deptCode: a.department?.code,
          status: a.status
        });
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
check();
