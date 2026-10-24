import sequelize from '../config/database';
async function listTables() {
  try {
    await sequelize.authenticate();
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('TABLES IN DB:', tables.map((t: any) => t.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
listTables();
