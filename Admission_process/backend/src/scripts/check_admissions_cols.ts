import sequelize from '../config/database';

async function checkCols() {
  try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'admissions';
    `);
    console.log('ADMISSIONS COLUMNS:', cols.map((c: any) => c.column_name));

    const [colsP] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'admission_personal_details';
    `);
    console.log('PERSONAL DETAILS COLUMNS:', colsP.map((c: any) => c.column_name));

    const [adms] = await sequelize.query(`
      SELECT * FROM admissions LIMIT 3;
    `);
    console.log('SAMPLE ADMISSIONS:', adms);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
checkCols();
