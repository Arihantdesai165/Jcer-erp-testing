import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [users] = await sequelize.query('SELECT id, "firstName", "lastName", email, role FROM users');
  console.log('ALL USERS:', users);
  await sequelize.close();
}
run();
