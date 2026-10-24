import sequelize from '../config/database';

async function listUsers() {
  try {
    await sequelize.authenticate();
    const [users] = await sequelize.query(`
      SELECT id, "firstName", "lastName", email, role 
      FROM users 
      ORDER BY "firstName" ASC;
    `);
    console.log(`TOTAL USERS: ${users.length}`);
    for (const u of users as any[]) {
      if (
        u.firstName?.toLowerCase().includes('manish') || 
        u.lastName?.toLowerCase().includes('singh') ||
        u.email?.toLowerCase().includes('manish') ||
        u.email?.toLowerCase().includes('singh')
      ) {
        console.log('MATCH USER:', u);
      }
    }

    const [teachers] = await sequelize.query(`
      SELECT t.id, t."userId", u."firstName", u."lastName", u.email, d.code as "deptCode"
      FROM teachers t
      JOIN users u ON t."userId" = u.id
      LEFT JOIN departments d ON t."departmentId" = d.id;
    `);
    console.log('ALL TEACHERS:');
    for (const t of teachers as any[]) {
      console.log(t);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
listUsers();
