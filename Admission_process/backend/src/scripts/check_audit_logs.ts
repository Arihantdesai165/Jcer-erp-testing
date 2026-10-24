import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [logs] = await sequelize.query(`
    SELECT * FROM audit_logs 
    ORDER BY "createdAt" DESC 
    LIMIT 30;
  `);
  console.log('AUDIT LOGS:');
  for (const l of logs as any[]) {
    console.log(l.createdAt, l.action, l.details);
  }
  await sequelize.close();
}
run();
