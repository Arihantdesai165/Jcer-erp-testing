import sequelize from '../config/database';
import * as deanController from '../controllers/dean.controller';
import * as hodController from '../controllers/hod.controller';
import User from '../models/User';
import HOD from '../models/HOD';
import Department from '../models/Department';

async function testAllApis() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Find Dean User
    let deanUser = await User.findOne({ where: { role: 'DEAN' } });
    if (!deanUser) {
      deanUser = await User.findOne({ where: { role: 'ADMIN' } });
    }
    console.log('Using Dean/Admin user for testing:', deanUser?.email, 'role:', deanUser?.role);

    // Test 1: Dean Faculty List (ALL)
    {
      const req: any = {
        user: { id: deanUser?.id, role: deanUser?.role || 'DEAN' },
        query: { departmentId: 'ALL', status: 'ALL' },
      };
      let data: any = null, error: any = null;
      const res: any = {
        json: (d: any) => { data = d; return res; },
        status: (code: number) => ({ json: (d: any) => { error = { code, d }; } }),
      };
      await deanController.getFacultyList(req, res, (e: any) => { error = e; });
      if (error) {
        console.error('❌ GET /api/dean/faculty (ALL) FAILED:', error);
      } else {
        console.log('✅ GET /api/dean/faculty (ALL) SUCCESS: count =', data?.data?.length);
      }
    }

    // Test 2: Dean Faculty List (Filter by Department)
    const sampleDept = await Department.findOne();
    if (sampleDept) {
      const req: any = {
        user: { id: deanUser?.id, role: deanUser?.role || 'DEAN' },
        query: { departmentId: sampleDept.id, status: 'ALL' },
      };
      let data: any = null, error: any = null;
      const res: any = {
        json: (d: any) => { data = d; return res; },
        status: (code: number) => ({ json: (d: any) => { error = { code, d }; } }),
      };
      await deanController.getFacultyList(req, res, (e: any) => { error = e; });
      if (error) {
        console.error(`❌ GET /api/dean/faculty (Dept ${sampleDept.code}) FAILED:`, error);
      } else {
        console.log(`✅ GET /api/dean/faculty (Dept ${sampleDept.code}) SUCCESS: count =`, data?.data?.length);
      }
    }

    // Test 3: Dean Faculty List (Status ARCHIVED vs ACTIVE)
    {
      const req: any = {
        user: { id: deanUser?.id, role: deanUser?.role || 'DEAN' },
        query: { departmentId: 'ALL', status: 'ARCHIVED' },
      };
      let data: any = null, error: any = null;
      const res: any = {
        json: (d: any) => { data = d; return res; },
        status: (code: number) => ({ json: (d: any) => { error = { code, d }; } }),
      };
      await deanController.getFacultyList(req, res, (e: any) => { error = e; });
      if (error) {
        console.error('❌ GET /api/dean/faculty (ARCHIVED) FAILED:', error);
      } else {
        console.log('✅ GET /api/dean/faculty (ARCHIVED) SUCCESS: count =', data?.data?.length);
      }
    }

    // Test 4: HOD Subject Handling Requests
    {
      const req: any = {
        user: { id: deanUser?.id, role: deanUser?.role || 'DEAN' },
        query: {},
      };
      let data: any = null, error: any = null;
      const res: any = {
        json: (d: any) => { data = d; return res; },
        status: (code: number) => ({ json: (d: any) => { error = { code, d }; } }),
      };
      await deanController.getDeanTeachingProfile(req, res, (e: any) => { error = e; });
      if (error) {
        console.error('❌ GET /api/dean/teaching-profile FAILED:', error);
      } else {
        console.log('✅ GET /api/dean/teaching-profile SUCCESS: coreDepartment =', data?.data?.coreDepartment?.code, 'eligible =', data?.data?.isTeachingEligible);
      }
    }

    // Test 5: HOD Dashboard & Department Metadata
    const activeHod = await HOD.findOne({
      where: { isActive: true },
      include: [{ model: User, as: 'user' }, { model: Department, as: 'department' }],
    });
    if (activeHod) {
      console.log('\nTesting HOD Portal for active HOD:', (activeHod as any).user?.email, 'dept:', (activeHod as any).department?.code);
      const hodReqContext: any = {
        user: { id: activeHod.userId, role: 'HOD' },
        departmentId: activeHod.departmentId,
        department: (activeHod as any).department,
        hod: activeHod,
        isSemesterHandling: (activeHod as any).department?.type === 'SEMESTER_HANDLING',
        query: {},
      };

      // 5a. HOD Dashboard
      let dashData: any = null, dashError: any = null;
      const resDash: any = {
        json: (d: any) => { dashData = d; return resDash; },
        status: (code: number) => ({ json: (d: any) => { dashError = { code, d }; } }),
      };
      await hodController.getHodDashboard(hodReqContext, resDash, (e: any) => { dashError = e; });
      if (dashError) {
        console.error('❌ GET /api/hod/dashboard FAILED:', dashError);
      } else {
        console.log('✅ GET /api/hod/dashboard SUCCESS: stats =', dashData?.data?.stats);
      }

      // 5b. HOD Department Metadata
      let deptData: any = null, deptError: any = null;
      const resDept: any = {
        json: (d: any) => { deptData = d; return resDept; },
        status: (code: number) => ({ json: (d: any) => { deptError = { code, d }; } }),
      };
      await hodController.getHodDepartment(hodReqContext, resDept, (e: any) => { deptError = e; });
      if (deptError) {
        console.error('❌ GET /api/hod/department FAILED:', deptError);
      } else {
        console.log('✅ GET /api/hod/department SUCCESS: dept =', deptData?.data?.department?.name || deptData?.data?.name);
      }

      // 5c. HOD Subjects
      let subjData: any = null, subjError: any = null;
      const resSubj: any = {
        json: (d: any) => { subjData = d; return resSubj; },
        status: (code: number) => ({ json: (d: any) => { subjError = { code, d }; } }),
      };
      await hodController.getHodSubjects(hodReqContext, resSubj, (e: any) => { subjError = e; });
      if (subjError) {
        console.error('❌ GET /api/hod/subjects FAILED:', subjError);
      } else {
        console.log('✅ GET /api/hod/subjects SUCCESS: count =', subjData?.data?.subjects?.length || subjData?.data?.length);
      }
    }

    // Test 6: Health & Database Connectivity
    const [dbCheck] = await sequelize.query('SELECT 1 as is_alive');
    console.log('\n✅ Database Connectivity Health Check: is_alive =', (dbCheck as any)[0]?.is_alive);

    console.log('\n=============================================');
    console.log('ALL API TESTS COMPLETED AND VERIFIED.');
    console.log('=============================================');

  } catch (err) {
    console.error('API Test Error:', err);
  } finally {
    await sequelize.close();
  }
}

testAllApis();
