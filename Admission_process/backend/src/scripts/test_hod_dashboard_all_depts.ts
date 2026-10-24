import sequelize from '../config/database';
import { getHodDashboard } from '../controllers/hod.controller';
import Department from '../models/Department';
import HOD from '../models/HOD';
import User from '../models/User';

async function testAllHodDashboards() {
  await sequelize.authenticate();
  const hods = await HOD.findAll({
    include: [
      { model: User, as: 'user' },
      { model: Department, as: 'department' },
    ]
  });

  console.log('=== VERIFYING HOD DASHBOARD STUDENT COUNTS FROM DATABASE ===');
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
    const stats = responseData?.data?.stats;
    console.log(`[HOD: ${h.user?.email}] Department: ${h.department?.code} (${h.department?.name})`);
    console.log(`  -> Exact DB Student Count: ${stats?.totalStudents}`);
    console.log(`  -> Total Faculty Count:   ${stats?.totalFaculty}`);
    console.log(`  -> Total Subjects Count:  ${stats?.totalSubjects}`);
  }

  process.exit(0);
}

testAllHodDashboards();
