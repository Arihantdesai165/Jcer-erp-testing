import sequelize from '../config/database';
async function test() {
  await sequelize.authenticate();
  const [cols] = await sequelize.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    LIMIT 5;
  `);
  console.log('SAMPLE COLS:', cols);
  await sequelize.close();
}
test();
