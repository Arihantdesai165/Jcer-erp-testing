import sequelize from '../config/database';
async function q() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query("SELECT * FROM subjects WHERE code IN ('BCS101', 'BCS103')");
    console.log('SUBJECTS IN DB:', rows);
    const [allSubjs] = await sequelize.query('SELECT id, code, name, cycle, semester, "departmentId" FROM subjects ORDER BY "createdAt" DESC LIMIT 10');
    console.log('RECENT SUBJECTS:', allSubjs);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
q();
