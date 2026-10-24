import db from '../config/database';
import Section from '../models/Section';
import Student from '../models/Student';
import Department from '../models/Department';
import User from '../models/User';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import sequelize from '../config/database';
import { Op } from 'sequelize';

async function testQuery() {
  await db.authenticate();
  const secId = 'c1445c62-f500-43c5-a163-11b914b9ae41';
  const sec = await Section.findByPk(secId);
  console.log('Section:', sec?.name, sec?.branch, sec?.semester, sec?.departmentId);

  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  const asDept = await Department.findOne({ where: { code: 'AS' } });

  const targetDeptId = cseDept?.id;

  const studentWhere: any = {
    semester: sec?.semester,
    departmentId: targetDeptId,
    [Op.or]: [
      { sectionId: sec?.id },
      { '$academicEnrollments.sectionId$': sec?.id },
      { section: sec?.name },
      { section: 'A' },
      { section: 'Section A' }
    ]
  };

  const students = await Student.findAll({
    where: studentWhere,
    include: [
      {
        model: StudentAcademicEnrollment,
        as: 'academicEnrollments',
        where: { status: 'ACTIVE' },
        required: false,
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'name', 'code'],
        required: false,
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
        required: false,
      },
      {
        model: Admission,
        as: 'admission',
        required: false,
        include: [
          {
            model: AdmissionPersonalDetail,
            as: 'studentpersonaldetails',
            required: false,
          },
        ],
      },
    ],
    order: [
      [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.firstName'), '')), 'ASC'],
      [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.lastName'), '')), 'ASC'],
      ['id', 'ASC'],
    ],
  });

  console.log('Found allocated students count:', students.length);
  console.log('First 3:', students.slice(0, 3).map(s => ({
    id: s.id,
    name: s.user?.firstName + ' ' + s.user?.lastName,
    enrollment: s.enrollmentNumber,
    section: s.section,
    sectionId: s.sectionId
  })));

  await db.close();
}
testQuery();
