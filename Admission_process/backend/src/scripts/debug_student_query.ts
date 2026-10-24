import sequelize from '../config/database';
import HOD from '../models/HOD';
import Department from '../models/Department';
import User from '../models/User';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function debugStudentQuery() {
  try {
    await sequelize.authenticate();
    const hod = await HOD.findOne({
      where: { isActive: true },
      include: [
        { model: Department, as: 'department' },
        { model: User, as: 'user' },
      ],
    });
    const dept = (hod as any).department;

    console.log('Running getHodDepartmentStudents with departmentId:', dept.id);
    const result = await getHodDepartmentStudents({
      departmentId: dept.id,
      semester: 3,
      academicYear: '2026-27',
      limit: 1,
      page: 1,
    });
    console.log('Result count:', result.count);
    await sequelize.close();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR MESSAGE:', err.message);
    console.error('SQL:', err.sql);
    console.error('PARAMETERS:', err.parameters);
    console.error('STACK:', err.stack);
    await sequelize.close();
    process.exit(1);
  }
}

debugStudentQuery();
