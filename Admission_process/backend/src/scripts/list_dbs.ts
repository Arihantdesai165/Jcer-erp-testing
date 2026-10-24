import sequelize from '../config/database';

async function listDbs() {
  try {
    await sequelize.authenticate();
    const [dbs] = await sequelize.query(`
      SELECT datname FROM pg_database WHERE datistemplate = false;
    `);
    console.log('DATABASES ON POSTGRES SERVER:', dbs);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
listDbs();
