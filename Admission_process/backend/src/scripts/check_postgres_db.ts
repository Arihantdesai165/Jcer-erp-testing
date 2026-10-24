import { Sequelize } from 'sequelize';

async function checkPostgresDb() {
  const seq = new Sequelize('postgres://erp_user:erp_password_123@localhost:5432/postgres', { logging: false });
  try {
    await seq.authenticate();
    const [tables] = await seq.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('TABLES IN postgres DB:', tables);
  } catch (err: any) {
    console.log('Cannot connect to postgres DB:', err.message);
  } finally {
    await seq.close();
  }
}
checkPostgresDb();
