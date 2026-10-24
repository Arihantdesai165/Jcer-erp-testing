import sequelize from '../config/database';
import { getHodDashboard } from '../controllers/hod.controller';
import HOD from '../models/HOD';
import User from '../models/User';
import Department from '../models/Department';

async function testDashboardApi() {
  await sequelize.authenticate();
  const hods = await HOD.findAll({
    include: [
      { model: User, as: 'user' },
      { model: Department, as: 'department' },
    ]
  });

  for (const h of hods as any[]) {
    const req: any = {
      departmentId: h.departmentId,
      department: h.department,
      user: h.user,
      hod: h,
      query: { academicYear: '2026-27', semester: 'ALL', section: 'ALL' }
    };

    let responseData: any = null;
    const res: any = {
      json: (d: any) => { responseData = d; return res; },
      status: (c: number) => res
    };

    await getHodDashboard(req, res, (err: any) => console.error(err));

    console.log(`HOD Dashboard output for ${h.user?.email} (${h.department?.code}):`);
    console.log('  totalStudents:', responseData?.data?.stats?.totalStudents);
    console.log('  totalFaculty:', responseData?.data?.stats?.totalFaculty);
    console.log('  totalSubjects:', responseData?.data?.stats?.totalSubjects);
    console.log('  activeSections:', responseData?.data?.stats?.activeSections);
  }

  process.exit(0);
}

testDashboardApi();
