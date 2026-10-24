import sequelize from '../config/database';

async function searchWord(word: string) {
  try {
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
          WHERE "${col.column_name}" ILIKE '%${word}%'
          LIMIT 5;
        `);
        if (rows.length > 0) {
          console.log(`FOUND '${word}' in table ${col.table_name}, column ${col.column_name}:`, rows);
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

searchWord('Badnaik');
