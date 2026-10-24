import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [logs] = await sequelize.query(`
    SELECT * FROM audit_logs 
    WHERE action = 'HOD_ASSIGN_SUBJECT'
    ORDER BY "createdAt" DESC;
  `);
  console.log('HOD_ASSIGN_SUBJECT LOGS:', logs);
  await sequelize.close();
}
run();
