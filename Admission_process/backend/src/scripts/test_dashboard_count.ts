import sequelize from '../config/database';
import { getHodDepartmentStudents, getHodDashboard } from '../controllers/hod.controller';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Student from '../models/Student';

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const eceDept = await Department.findOne({ where: { code: 'ECE' } });
    if (!eceDept) {
      console.log('ECE Dept not found');
      process.exit(1);
    }
    console.log('ECE Dept ID:', eceDept.id);

    const enrollments = await StudentAcademicEnrollment.findAll({
      where: { departmentId: eceDept.id },
      raw: true
    });
    console.log('Raw ECE Enrollments in DB:', enrollments);

    const resStudents = await getHodDepartmentStudents({
      departmentId: eceDept.id,
      academicYear: '2026-27',
      semester: 'ALL',
      section: 'ALL',
      limit: 10,
    });
    console.log('getHodDepartmentStudents count for ECE with AY 2026-27:', resStudents.count);

    const resStudentsNoAY = await getHodDepartmentStudents({
      departmentId: eceDept.id,
      semester: 'ALL',
      section: 'ALL',
      limit: 10,
    });
    console.log('getHodDepartmentStudents count for ECE without AY:', resStudentsNoAY.count);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
