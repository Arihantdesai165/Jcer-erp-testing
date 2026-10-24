import sequelize from '../config/database';
import Department from '../models/Department';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function testCount() {
  await sequelize.authenticate();
  const ece = await Department.findOne({ where: { code: 'ECE' } });
  if (!ece) return;

  const res1 = await getHodDepartmentStudents({
    departmentId: ece.id,
    academicYear: '2026-27',
    semester: 'ALL',
    section: 'ALL',
    limit: 1,
  });

  console.log('Result 1 (limit 1):', {
    countType: typeof res1.count,
    countVal: res1.count,
    isArray: Array.isArray(res1.count),
    rowsLength: res1.rows.length,
  });

  const res10 = await getHodDepartmentStudents({
    departmentId: ece.id,
    academicYear: '2026-27',
    semester: 'ALL',
    section: 'ALL',
    limit: 10,
  });

  console.log('Result 10 (limit 10):', {
    countType: typeof res10.count,
    countVal: res10.count,
    isArray: Array.isArray(res10.count),
    rowsLength: res10.rows.length,
  });

  process.exit(0);
}

testCount();
