import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import User from '../models/User';

async function resetPassword() {
  const email = (process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || 'arihantdesai483@gmail.com').trim().toLowerCase();
  const newPassword = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD || 'Desai@2004';

  console.log(`\n====================================================`);
  console.log(`🔐 RESETTING PASSWORD FOR: ${email}`);
  console.log(`====================================================\n`);

  try {
    await sequelize.authenticate();
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.error(`❌ User with email "${email}" not found in database.`);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = hash;
    user.mustChangePassword = false;
    await user.save();

    console.log(`✅ Success! Password for ${user.email} (Role: ${user.role}) has been reset to: ${newPassword}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Password reset failed:', error.message);
    process.exit(1);
  }
}

resetPassword();
