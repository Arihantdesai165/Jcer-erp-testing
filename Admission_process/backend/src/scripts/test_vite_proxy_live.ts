import jwt from 'jsonwebtoken';
import sequelize from '../config/database';
import HOD from '../models/HOD';
import Department from '../models/Department';
import User from '../models/User';
import Section from '../models/Section';

async function testViteProxy() {
  try {
    await sequelize.authenticate();
    const hod = await HOD.findOne({
      where: { isActive: true },
      include: [
        { model: Department, as: 'department' },
        { model: User, as: 'user' },
      ],
    });

    if (!hod) {
      console.log('No active HOD found');
      await sequelize.close();
      process.exit(0);
    }

    const user = (hod as any).user;
    const dept = (hod as any).department;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'HOD', departmentId: dept.id },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '1h' }
    );
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

    console.log('--- 1. Testing through Vite Proxy (http://localhost:5173) ---');
    const r1 = await fetch('http://localhost:5173/api/hod/dashboard', { headers });
    console.log('Vite -> GET /api/hod/dashboard:', r1.status);

    const r2 = await fetch('http://localhost:5173/api/hod/students', { headers });
    console.log('Vite -> GET /api/hod/students:', r2.status);

    const secName = 'Vite_Proxy_Sec_' + Date.now().toString().slice(-4);
    const r3 = await fetch('http://localhost:5173/api/hod/sections', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: secName,
        semester: 3,
        academicYear: '2026-27',
        capacity: 60,
        classroom: '301',
      }),
    });
    const secData = await r3.json();
    console.log('Vite -> POST /api/hod/sections:', r3.status, (secData as any).success ? 'SUCCESS' : secData);
    await Section.destroy({ where: { name: secName } });

    // Test Subject creation and deletion through Vite Proxy
    const subCode = 'VITE_SUB_' + Date.now().toString().slice(-4);
    const rSubCreate = await fetch('http://localhost:5173/api/hod/subjects', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: subCode,
        name: 'Vite Proxy Test Subject',
        semester: 3,
        credits: 4,
        type: 'IPCC',
      }),
    });
    const subCreateData = (await rSubCreate.json()) as any;
    console.log('Vite -> POST /api/hod/subjects:', rSubCreate.status, subCreateData.success ? 'SUCCESS' : subCreateData);
    const createdSubId = subCreateData.data?.id;

    if (createdSubId) {
      const rSubDelete = await fetch(`http://localhost:5173/api/hod/subjects/${createdSubId}`, {
        method: 'DELETE',
        headers,
      });
      const subDelData = await rSubDelete.json();
      console.log('Vite -> DELETE /api/hod/subjects/:id:', rSubDelete.status, (subDelData as any).success ? 'SUCCESS' : subDelData);
    }

    console.log('\n--- 2. Testing Direct Backend (http://localhost:5000) ---');
    const d1 = await fetch('http://localhost:5000/api/hod/dashboard', { headers });
    console.log('Direct -> GET /api/hod/dashboard:', d1.status);
    const d2 = await fetch('http://localhost:5000/api/hod/students', { headers });
    console.log('Direct -> GET /api/hod/students:', d2.status);

    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    await sequelize.close();
    process.exit(1);
  }
}

testViteProxy();
