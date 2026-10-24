import sequelize from '../config/database';

async function checkBackups() {
  try {
    await sequelize.authenticate();
    const [backups] = await sequelize.query(`
      SELECT * FROM attendance_backup_files WHERE "fileName" ILIKE '%BCS103%'
    `);
    console.log('BACKUPS FOR BCS103:', backups);

    const [sessions] = await sequelize.query(`
      SELECT s.*, fa.* 
      FROM attendance_sessions s
      JOIN faculty_assignments fa ON s."facultyAssignmentId" = fa.id
      WHERE fa."subjectId" IN (SELECT id FROM subjects WHERE code = 'BCS103')
    `);
    console.log('SESSIONS FOR BCS103:', sessions);

    const [assigns] = await sequelize.query(`
      SELECT fa.*, u."firstName", u."lastName", sub.name as "subName", sub.code as "subCode"
      FROM faculty_assignments fa
      JOIN users u ON fa."userId" = u.id
      JOIN subjects sub ON fa."subjectId" = sub.id
      WHERE sub.code = 'BCS103'
    `);
    console.log('ALL ASSIGNMENTS FOR BCS103:', assigns);

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
checkBackups();
