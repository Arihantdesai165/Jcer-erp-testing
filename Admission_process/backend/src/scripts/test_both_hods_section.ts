import jwt from 'jsonwebtoken';
import sequelize from '../config/database';
import HOD from '../models/HOD';
import Department from '../models/Department';
import User from '../models/User';

async function testBothHODs() {
  try {
    await sequelize.authenticate();
    const hods = await HOD.findAll({
      where: { isActive: true },
      include: [
        { model: Department, as: 'department' },
        { model: User, as: 'user' },
      ],
    });

    for (const hod of hods) {
      const user = (hod as any).user;
      const dept = (hod as any).department;
      if (!user || !dept) continue;

      const token = jwt.sign(
        { id: user.id, email: user.email, role: 'HOD', departmentId: dept.id },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '1h' }
      );
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

      console.log(`\n=== Testing HOD for Department: ${dept.code} (${dept.name}) ===`);
      const rSec = await fetch('http://localhost:5173/api/hod/sections?semester=3&academicYear=2026-27', { headers });
      console.log(`Vite -> GET /api/hod/sections?semester=3: ${rSec.status}`);
      const secData = (await rSec.json()) as any;
      console.log(`Sections count: ${secData.data?.length || 0}`);

      const rStud = await fetch('http://localhost:5173/api/hod/students?semester=3&academicYear=2026-27&limit=1', { headers });
      console.log(`Vite -> GET /api/hod/students?semester=3&limit=1: ${rStud.status}`);
      const studData = (await rStud.json()) as any;
      console.log(`Students count: ${studData.data?.pagination?.total ?? 'N/A'}`);
    }

    await sequelize.close();
    process.exit(0);
  } catch (err: any) {
    console.error(err);
    await sequelize.close();
    process.exit(1);
  }
}

testBothHODs();
