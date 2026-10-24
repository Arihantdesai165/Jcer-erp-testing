import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [users] = await sequelize.query(`
    SELECT u.id, u."firstName", u."lastName", u.email, u.role, t.id as teacher_id, t."departmentId" as teacher_dept_id, d.code as dept_code
    FROM users u 
    LEFT JOIN teachers t ON t."userId" = u.id 
    LEFT JOIN departments d ON t."departmentId" = d.id
    WHERE u.role != 'STUDENT'
  `);
  console.log('FACULTY USERS:', users);
  await sequelize.close();
}
run();
