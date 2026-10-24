import sequelize from '../config/database';
import User from '../models/User';

async function updateFacultyMustChangePassword() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Find all users with role TEACHER where mustChangePassword is true
    const facultyUsers = await User.findAll({
      where: {
        role: 'TEACHER',
        mustChangePassword: true,
      },
    });

    console.log(`Found ${facultyUsers.length} faculty user accounts with mustChangePassword = true.`);

    for (const u of facultyUsers) {
      await u.update({ mustChangePassword: false });
      console.log(`Updated faculty user ${u.email} (id: ${u.id}) -> mustChangePassword: false`);
    }

    console.log('All existing faculty user accounts have been updated successfully.');
  } catch (err) {
    console.error('Error updating faculty users:', err);
  } finally {
    await sequelize.close();
  }
}

updateFacultyMustChangePassword();
