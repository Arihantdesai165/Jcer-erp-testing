import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import HOD from '../models/HOD';
import sequelize from '../config/database';

const BASE_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

async function testLiveHttp() {
  try {
    await sequelize.authenticate();
    console.log('--- Testing Live HTTP Endpoints on ' + BASE_URL + ' ---');

    // 1. Health checks
    try {
      const h1 = await axios.get(`${BASE_URL}/health`);
      console.log('✅ GET /health ->', h1.status, h1.data);
    } catch (e: any) {
      console.error('❌ GET /health ->', e.response?.status || e.message);
    }

    try {
      const h2 = await axios.get(`${BASE_URL}/api/health/db`);
      console.log('✅ GET /api/health/db ->', h2.status, h2.data);
    } catch (e: any) {
      console.error('❌ GET /api/health/db ->', e.response?.status || e.message);
    }

    // 2. Auth tokens for DEAN and HOD
    const deanUser = await User.findOne({ where: { role: 'DEAN' } }) || await User.findOne({ where: { role: 'ADMIN' } });
    if (!deanUser) {
      console.error('No DEAN/ADMIN user found in database.');
      return;
    }

    const deanToken = jwt.sign(
      { id: deanUser.id, email: deanUser.email, role: deanUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const activeHod = await HOD.findOne({ where: { isActive: true } });
    const hodUser = activeHod ? await User.findByPk(activeHod.userId) : null;
    const hodToken = hodUser
      ? jwt.sign({ id: hodUser.id, email: hodUser.email, role: 'HOD' }, JWT_SECRET, { expiresIn: '1h' })
      : null;

    // 3. Test Dean Endpoints
    const deanHeaders = { Authorization: `Bearer ${deanToken}` };

    try {
      const resFaculty = await axios.get(`${BASE_URL}/api/dean/faculty?departmentId=ALL&status=ALL`, { headers: deanHeaders });
      console.log('✅ GET /api/dean/faculty?departmentId=ALL&status=ALL ->', resFaculty.status, 'records:', resFaculty.data?.data?.length);
    } catch (e: any) {
      console.error('❌ GET /api/dean/faculty ->', e.response?.status, e.response?.data || e.message);
    }

    try {
      const resFacultyArchived = await axios.get(`${BASE_URL}/api/dean/faculty?departmentId=ALL&status=ARCHIVED`, { headers: deanHeaders });
      console.log('✅ GET /api/dean/faculty?departmentId=ALL&status=ARCHIVED ->', resFacultyArchived.status, 'records:', resFacultyArchived.data?.data?.length);
    } catch (e: any) {
      console.error('❌ GET /api/dean/faculty (ARCHIVED) ->', e.response?.status, e.response?.data || e.message);
    }

    try {
      const resHodReqs = await axios.get(`${BASE_URL}/api/dean/hod-subject-requests`, { headers: deanHeaders });
      console.log('✅ GET /api/dean/hod-subject-requests ->', resHodReqs.status, 'records:', resHodReqs.data?.data?.length);
    } catch (e: any) {
      console.error('❌ GET /api/dean/hod-subject-requests ->', e.response?.status, e.response?.data || e.message);
    }

    // 4. Test HOD Endpoints
    if (hodToken) {
      const hodHeaders = { Authorization: `Bearer ${hodToken}` };

      try {
        const resDash = await axios.get(`${BASE_URL}/api/hod/dashboard`, { headers: hodHeaders });
        console.log('✅ GET /api/hod/dashboard ->', resDash.status, 'stats totalStudents:', resDash.data?.data?.stats?.totalStudents);
      } catch (e: any) {
        console.error('❌ GET /api/hod/dashboard ->', e.response?.status, e.response?.data || e.message);
      }

      try {
        const resDept = await axios.get(`${BASE_URL}/api/hod/department`, { headers: hodHeaders });
        console.log('✅ GET /api/hod/department ->', resDept.status, 'dept:', resDept.data?.data?.department?.name || resDept.data?.data?.name);
      } catch (e: any) {
        console.error('❌ GET /api/hod/department ->', e.response?.status, e.response?.data || e.message);
      }

      try {
        const resSubj = await axios.get(`${BASE_URL}/api/hod/subjects`, { headers: hodHeaders });
        console.log('✅ GET /api/hod/subjects ->', resSubj.status, 'subjects count:', resSubj.data?.data?.subjects?.length || resSubj.data?.data?.length);
      } catch (e: any) {
        console.error('❌ GET /api/hod/subjects ->', e.response?.status, e.response?.data || e.message);
      }

      try {
        const resBranches = await axios.get(`${BASE_URL}/api/hod/sections/branches-overview`, { headers: hodHeaders });
        console.log('✅ GET /api/hod/sections/branches-overview ->', resBranches.status, 'branches count:', resBranches.data?.data?.length);
      } catch (e: any) {
        console.error('❌ GET /api/hod/sections/branches-overview ->', e.response?.status, e.response?.data || e.message);
      }
    }

  } catch (err: any) {
    console.error('Live HTTP Test Failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

testLiveHttp();
