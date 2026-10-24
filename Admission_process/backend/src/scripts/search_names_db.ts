import sequelize from '../config/database';

async function searchName() {
  try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND data_type IN ('character varying', 'text', 'character')
      ORDER BY table_name;
    `);

    for (const col of cols as any[]) {
      try {
        const [rows] = await sequelize.query(`
          SELECT "${col.column_name}" 
          FROM "${col.table_name}" 
          WHERE "${col.column_name}" ILIKE '%Badnaik%' OR "${col.column_name}" ILIKE '%Lohar%'
          LIMIT 5;
        `);
        if (rows.length > 0) {
          console.log(`FOUND in table ${col.table_name}, column ${col.column_name}:`, rows);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
searchName();
