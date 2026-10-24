import sequelize from '../config/database';
import { Op } from 'sequelize';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import User from '../models/User';
import Department from '../models/Department';

async function testRefinedCount() {
  await sequelize.authenticate();
  const ece = await Department.findOne({ where: { code: 'ECE' } });
  if (!ece) return;

  const departmentId = ece.id;

  // Refined saeWhere
  const saeWhere: any = {
    status: { [Op.notIn]: ['INACTIVE', 'DROPPED'] },
  };

  const studentWhere: any = {
    departmentId,
  };

  const { count, rows } = await Student.findAndCountAll({
    where: studentWhere,
    include: [
      {
        model: StudentAcademicEnrollment,
        as: 'academicEnrollments',
        where: saeWhere,
        required: false,
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status'],
        required: false,
      },
    ],
    distinct: true,
    subQuery: false,
  });

  console.log(`Refined count for ECE Department (${ece.code}):`, count);
  rows.forEach((r: any) => {
    console.log(` - Student ${r.usn}: ${r.user?.firstName} ${r.user?.lastName}, Sem: ${r.semester}`);
  });

  process.exit(0);
}

testRefinedCount();
