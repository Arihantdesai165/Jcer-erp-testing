import jwt from 'jsonwebtoken';
import sequelize from '../config/database';
import HOD from '../models/HOD';
import Department from '../models/Department';
import User from '../models/User';

async function testError() {
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
      console.log('No active HOD');
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

    console.log('1. Testing GET /api/hod/sections?semester=3&academicYear=2026-27:');
    const r1 = await fetch('http://localhost:5000/api/hod/sections?semester=3&academicYear=2026-27', { headers });
    console.log('r1 status:', r1.status);
    const d1 = await r1.json();
    console.log('r1 body:', JSON.stringify(d1, null, 2));

    console.log('\n2. Testing GET /api/hod/students?semester=3&academicYear=2026-27&limit=1:');
    const r2 = await fetch('http://localhost:5000/api/hod/students?semester=3&academicYear=2026-27&limit=1', { headers });
    console.log('r2 status:', r2.status);
    const d2 = await r2.json();
    console.log('r2 body:', JSON.stringify(d2, null, 2));

    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    await sequelize.close();
    process.exit(1);
  }
}

testError();
