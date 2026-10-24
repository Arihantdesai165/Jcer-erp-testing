import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import HOD from '../models/HOD';
import Department from '../models/Department';
import sequelize from '../config/database';

const BASE_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

export interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  notes: string;
}

export async function runComprehensiveHttpTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  try {
    await sequelize.authenticate();

    // 1. Health Checks
    try {
      const res = await axios.get(`${BASE_URL}/health`);
      results.push({
        endpoint: 'GET /health',
        status: res.status,
        success: res.data?.status === 'healthy',
        notes: `service: ${res.data?.service}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /health', status: e.response?.status || 500, success: false, notes: e.message });
    }

    try {
      const res = await axios.get(`${BASE_URL}/api/health/db`);
      results.push({
        endpoint: 'GET /api/health/db',
        status: res.status,
        success: res.data?.database === 'connected',
        notes: `db: ${res.data?.database}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/health/db', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 2. Auth for Dean & HOD
    const deanUser = (await User.findOne({ where: { role: 'DEAN' } })) || (await User.findOne({ where: { role: 'ADMIN' } }));
    const deanToken = deanUser ? jwt.sign({ id: deanUser.id, email: deanUser.email, role: deanUser.role }, JWT_SECRET, { expiresIn: '1h' }) : '';
    const deanHeaders = { Authorization: `Bearer ${deanToken}` };

    const activeHod = await HOD.findOne({ where: { isActive: true }, include: [{ model: Department, as: 'department' }] });
    const hodUser = activeHod ? await User.findByPk(activeHod.userId) : null;
    const hodToken = hodUser ? jwt.sign({ id: hodUser.id, email: hodUser.email, role: 'HOD' }, JWT_SECRET, { expiresIn: '1h' }) : '';
    const hodHeaders = { Authorization: `Bearer ${hodToken}` };

    // 3. Dean Faculty Directory (Active)
    try {
      const res = await axios.get(`${BASE_URL}/api/dean/faculty?departmentId=ALL&status=ALL`, { headers: deanHeaders });
      results.push({
        endpoint: 'GET /api/dean/faculty?departmentId=ALL&status=ALL',
        status: res.status,
        success: res.data?.success === true && Array.isArray(res.data?.data),
        notes: `count: ${res.data?.data?.length}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/dean/faculty (ALL)', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 4. Dean Faculty Directory (Archived)
    try {
      const res = await axios.get(`${BASE_URL}/api/dean/faculty?departmentId=ALL&status=ARCHIVED`, { headers: deanHeaders });
      results.push({
        endpoint: 'GET /api/dean/faculty?departmentId=ALL&status=ARCHIVED',
        status: res.status,
        success: res.data?.success === true && Array.isArray(res.data?.data),
        notes: `count: ${res.data?.data?.length}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/dean/faculty (ARCHIVED)', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 5. HOD Subject Requests
    try {
      const res = await axios.get(`${BASE_URL}/api/dean/hod-subject-requests`, { headers: deanHeaders });
      results.push({
        endpoint: 'GET /api/dean/hod-subject-requests',
        status: res.status,
        success: res.data?.success === true && Array.isArray(res.data?.data),
        notes: `count: ${res.data?.data?.length}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/dean/hod-subject-requests', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 6. HOD Dashboard
    try {
      const res = await axios.get(`${BASE_URL}/api/hod/dashboard`, { headers: hodHeaders });
      results.push({
        endpoint: 'GET /api/hod/dashboard',
        status: res.status,
        success: res.data?.success === true && !!res.data?.data?.stats,
        notes: `students: ${res.data?.data?.stats?.totalStudents}, faculty: ${res.data?.data?.stats?.totalFaculty}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/hod/dashboard', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 7. HOD Department Metadata
    try {
      const res = await axios.get(`${BASE_URL}/api/hod/department`, { headers: hodHeaders });
      results.push({
        endpoint: 'GET /api/hod/department',
        status: res.status,
        success: res.data?.success === true,
        notes: `dept: ${res.data?.data?.department?.name || res.data?.data?.name}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/hod/department', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 8. HOD Subjects
    try {
      const res = await axios.get(`${BASE_URL}/api/hod/subjects`, { headers: hodHeaders });
      const subjCount = res.data?.data?.subjects?.length ?? res.data?.data?.length ?? 0;
      results.push({
        endpoint: 'GET /api/hod/subjects',
        status: res.status,
        success: res.data?.success === true,
        notes: `count: ${subjCount}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/hod/subjects', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 9. Section Allocation Branches Overview
    try {
      const res = await axios.get(`${BASE_URL}/api/hod/sections/branches-overview?semester=1&academicYear=2026-27`, { headers: hodHeaders });
      const branchCount = res.data?.data?.branches?.length ?? (Array.isArray(res.data?.data) ? res.data?.data.length : 0);
      results.push({
        endpoint: 'GET /api/hod/sections/branches-overview',
        status: res.status,
        success: res.data?.success === true,
        notes: `branches: ${branchCount}, dept: ${res.data?.data?.department?.code}`,
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/hod/sections/branches-overview', status: e.response?.status || 500, success: false, notes: e.message });
    }

    // 10. Redis Form Drafts Endpoint
    try {
      const res = await axios.get(`${BASE_URL}/api/auth/drafts/test-session-key`, { headers: deanHeaders });
      results.push({
        endpoint: 'GET /api/auth/drafts/:key',
        status: res.status,
        success: res.status === 200,
        notes: 'session draft sync active',
      });
    } catch (e: any) {
      results.push({ endpoint: 'GET /api/auth/drafts/:key', status: e.response?.status || 500, success: false, notes: e.message });
    }

  } catch (err: any) {
    console.error('Test execution error:', err.message);
  } finally {
    await sequelize.close();
  }
  return results;
}

if (require.main === module) {
  runComprehensiveHttpTests().then((res) => {
    console.log('\n--- LIVE HTTP TEST RESULTS ---');
    console.table(res);
  });
}
