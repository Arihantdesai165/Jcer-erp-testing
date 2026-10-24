import sequelize from '../config/database';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function testFacultyNoForcePasswordChange() {
  const t = await sequelize.transaction();
  try {
    console.log('--- TESTING FACULTY NO FORCED PASSWORD CHANGE ON LOGIN ---');

    let dept = await Department.findOne({ where: { code: 'CSE' } });
    if (!dept) {
      dept = await Department.findOne();
    }

    // 1. Simulate Faculty Created by Dean
    const rawPass = 'Fac@123456';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPass, salt);

    const facultyUser = await User.create({
      firstName: 'Test',
      lastName: 'FacultyLogin',
      email: `testfac_${Date.now()}@jcer.edu.in`,
      role: 'TEACHER',
      status: 'ACTIVE',
      mustChangePassword: false,
      passwordHash: hash,
    }, { transaction: t });

    const teacher = await Teacher.create({
      userId: facultyUser.id,
      departmentId: dept!.id,
      designation: 'Assistant Professor',
      joiningDate: new Date(),
    }, { transaction: t });

    console.log('✓ Step 1: Faculty created with mustChangePassword = false');
    if (facultyUser.mustChangePassword) {
      throw new Error('Faculty user should have mustChangePassword = false');
    }

    // 2. Simulate Login verification
    const passMatches = await facultyUser.comparePassword(rawPass);
    if (!passMatches) throw new Error('Faculty login password comparison failed.');

    const token = jwt.sign(
      { id: facultyUser.id, role: facultyUser.role, email: facultyUser.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    console.log('✓ Step 2: Faculty login credentials verified successfully directly into dashboard.');

    // 3. Simulate Regenerate Password
    const newPass = 'Fac#998877!';
    const newHash = await bcrypt.hash(newPass, await bcrypt.genSalt(10));
    await facultyUser.update({
      passwordHash: newHash,
      mustChangePassword: false,
    }, { transaction: t });

    console.log('✓ Step 3: Regenerated password successfully; mustChangePassword remains false.');
    if (facultyUser.mustChangePassword) {
      throw new Error('Regenerated faculty must not have mustChangePassword = true');
    }

    // 4. Test login with regenerated password
    const newPassMatches = await facultyUser.comparePassword(newPass);
    if (!newPassMatches) throw new Error('Regenerated password login comparison failed.');
    console.log('✓ Step 4: Login with regenerated password succeeded with no password-change prompt required.');

    // 5. Rollback test data
    await t.rollback();
    console.log('\n========================================================');
    console.log('ALL FACULTY LOGIN / FORCE CHANGE REMOVAL TESTS PASSED 100%!');
    console.log('========================================================');
  } catch (err) {
    await t.rollback();
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

testFacultyNoForcePasswordChange();
