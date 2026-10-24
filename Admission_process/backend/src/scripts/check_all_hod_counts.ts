import sequelize from '../config/database';
import HOD from '../models/HOD';
import User from '../models/User';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function checkHodUsers() {
  await sequelize.authenticate();
  const hods = await HOD.findAll({
    include: [
      { model: User, as: 'user' },
      { model: Department, as: 'department' },
    ]
  });

  console.log('--- ALL HOD RECORDS ---');
  for (const h of hods as any[]) {
    const userJson = h.user?.toJSON();
    const deptJson = h.department?.toJSON();
    console.log(`HOD ID: ${h.id}, User: ${userJson?.email} (${userJson?.firstName} ${userJson?.lastName}), Dept: ${deptJson?.code} (${deptJson?.name})`);

    if (deptJson?.id) {
      const { count } = await StudentAcademicEnrollment.findAndCountAll({
        where: { departmentId: deptJson.id, status: 'ACTIVE' }
      });
      console.log(`  -> Direct SAE count for dept ${deptJson.code}: ${count}`);
      const res = await getHodDepartmentStudents({
        departmentId: deptJson.id,
        academicYear: '2026-27',
        semester: 'ALL',
        section: 'ALL',
      });
      console.log(`  -> getHodDepartmentStudents count for dept ${deptJson.code}: ${res.count}`);
    }
  }

  process.exit(0);
}

checkHodUsers();
