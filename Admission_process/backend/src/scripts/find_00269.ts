import sequelize from '../config/database';
async function search00269() {
  await sequelize.authenticate();
  const [tables] = await sequelize.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND data_type IN ('character varying', 'text', 'character')
    ORDER BY table_name;
  `);

  for (const col of tables as any[]) {
    try {
      const [rows] = await sequelize.query(`
        SELECT "${col.column_name}" 
        FROM "${col.table_name}" 
        WHERE "${col.column_name}" ILIKE '%00269%'
        LIMIT 5;
      `);
      if (rows.length > 0) {
        console.log(`FOUND in table ${col.table_name}, column ${col.column_name}:`, rows);
      }
    } catch (e) {}
  }
  await sequelize.close();
}
search00269();
