import sequelize from '../config/database';
import Department from '../models/Department';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Admission from '../models/Admission';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function testAyIsolation() {
  await sequelize.authenticate();
  console.log('Connected to DB');

  const depts = await Department.findAll();
  for (const d of depts) {
    const isAS = d.code === 'AS' || d.type === 'SEMESTER_HANDLING';
    const res26 = await getHodDepartmentStudents({
      departmentId: d.id,
      academicYear: '2026-27',
      isSemesterHandling: isAS,
      limit: 5,
    });
    const res27 = await getHodDepartmentStudents({
      departmentId: d.id,
      academicYear: '2027-28',
      isSemesterHandling: isAS,
      limit: 5,
    });
    console.log(`[${d.code}] 2026-27 => total: ${res26.count}, returned rows: ${res26.rows.length}`);
    console.log(`[${d.code}] 2027-28 => total: ${res27.count}, returned rows: ${res27.rows.length}`);
  }

  process.exit(0);
}

testAyIsolation().catch(err => {
  console.error(err);
  process.exit(1);
});
