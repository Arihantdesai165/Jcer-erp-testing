import jwt from 'jsonwebtoken';
import HOD from '../models/HOD';
import Department from '../models/Department';
import User from '../models/User';
import Subject from '../models/Subject';
import Section from '../models/Section';

async function testHodEndpoints() {
  console.log('Testing HOD endpoints via actual HTTP calls...');
  const hod = await HOD.findOne({
    where: { isActive: true },
    include: [{ model: Department, as: 'department' }, { model: User, as: 'user' }],
  });

  if (!hod || !(hod as any).user) {
    console.error('No active HOD found.');
    process.exit(1);
  }

  const user = (hod as any).user;
  const dept = (hod as any).department;
  console.log(`Testing with HOD: ${user.email}, Department: ${dept.code} (${dept.id})`);

  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'HOD', departmentId: dept.id },
    secret,
    { expiresIn: '1h' }
  );

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Test GET /api/hod/dashboard
  const dashRes = await fetch('http://localhost:5000/api/hod/dashboard', { headers });
  console.log(`GET /api/hod/dashboard -> Status: ${dashRes.status}`);

  // 2. Test GET /api/hod/students
  const studentsRes = await fetch('http://localhost:5000/api/hod/students', { headers });
  console.log(`GET /api/hod/students -> Status: ${studentsRes.status}`);

  // 3. Test POST /api/hod/students/sections (Create Section via alias)
  const testSecName = 'Sec_Audit_' + Date.now().toString().slice(-4);
  const createSec1 = await fetch('http://localhost:5000/api/hod/students/sections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: testSecName,
      semester: 3,
      academicYear: '2026-27',
      capacity: 60,
      classroom: '301',
      description: 'Audit Test Section',
    }),
  });
  const sec1Data = await createSec1.json();
  console.log(`POST /api/hod/students/sections -> Status: ${createSec1.status}`, sec1Data);

  // 4. Test POST /api/hod/sections (Create Section canonical)
  const testSecName2 = 'Sec_Audit2_' + Date.now().toString().slice(-4);
  const createSec2 = await fetch('http://localhost:5000/api/hod/sections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: testSecName2,
      semester: 3,
      academicYear: '2026-27',
      capacity: 60,
      classroom: '302',
    }),
  });
  const sec2Data = await createSec2.json();
  console.log(`POST /api/hod/sections -> Status: ${createSec2.status}`, sec2Data);

  // 5. Test DELETE /api/hod/subjects/:id
  const testSub = await Subject.create({
    code: 'TEST_SUB_' + Date.now().toString().slice(-4),
    name: 'Temporary Test Subject',
    departmentId: dept.id,
    semester: 3,
    credits: 4,
    type: 'IPCC',
    status: 'ACTIVE',
  });
  console.log(`Created test subject: ${testSub.code} (ID: ${testSub.id})`);

  const deleteRes = await fetch(`http://localhost:5000/api/hod/subjects/${testSub.id}`, {
    method: 'DELETE',
    headers,
  });
  const delData = await deleteRes.json();
  console.log(`DELETE /api/hod/subjects/${testSub.id} -> Status: ${deleteRes.status}`, delData);

  // Cleanup created sections
  await Section.destroy({ where: { name: [testSecName, testSecName2] } });

  process.exit(0);
}

testHodEndpoints().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
