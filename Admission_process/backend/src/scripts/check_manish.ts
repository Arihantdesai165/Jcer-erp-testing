import sequelize from '../config/database';

async function run() {
  try {
    await sequelize.authenticate();
    const [users] = await sequelize.query(`
      SELECT u.id, u."firstName", u."lastName", u.email, t.id as teacher_id, t."departmentId" as teacher_dept_id
      FROM users u 
      LEFT JOIN teachers t ON t."userId" = u.id 
      WHERE u."firstName" ILIKE '%Manish%' OR u."lastName" ILIKE '%Singh%'
    `);
    console.log('USERS FOR MANISH SINGH:', users);

    for (const u of users as any[]) {
      const [assigns] = await sequelize.query(`
        SELECT fa.*, s.name as sub_name, s.code as sub_code, d.code as dept_code 
        FROM faculty_assignments fa 
        LEFT JOIN subjects s ON fa."subjectId" = s.id 
        LEFT JOIN departments d ON fa."departmentId" = d.id
        WHERE fa."userId" = :uId OR fa."teacherId" = :tId
      `, { replacements: { uId: u.id, tId: u.teacher_id } });
      console.log(`ASSIGNMENTS FOR ${u.firstName} ${u.lastName}:`, assigns);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();
