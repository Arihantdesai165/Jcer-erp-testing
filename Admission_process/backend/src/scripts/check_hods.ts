import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [hods] = await sequelize.query(`
    SELECT h.*, d.code as dept_code, d.name as dept_name, u.email, u."firstName", u."lastName" 
    FROM hods h 
    LEFT JOIN departments d ON h."departmentId" = d.id 
    LEFT JOIN users u ON h."userId" = u.id
  `);
  console.log('HODS TABLE:', hods);
  await sequelize.close();
}
run();
