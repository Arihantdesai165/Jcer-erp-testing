import sequelize from '../config/database';

async function remapAndVerify() {
  await sequelize.authenticate();
  console.log('Database connected.');

  const [r1] = await sequelize.query(`
    UPDATE attendance_sessions
    SET "sectionId" = 'c1445c62-f500-43c5-a163-11b914b9ae41'
    WHERE "sectionId" = '84a75204-b1da-4a12-bc6a-1ffef635e110';
  `);
  console.log('Remapped sessions to Section A:', r1);

  const [r2] = await sequelize.query(`
    UPDATE attendance_sessions
    SET "sectionId" = '4f8d2a5c-c4b7-4f13-9bcf-087e5046e0a6'
    WHERE "sectionId" = 'df2f5ff3-1cff-40b6-bcfb-a491095df1bd';
  `);
  console.log('Remapped sessions to Section B:', r2);

  const [secs] = await sequelize.query(`
    SELECT id, name, semester, branch, "departmentId"
    FROM sections
    WHERE status = 'ACTIVE'
    ORDER BY semester, branch, name;
  `);
  console.log('All remaining active sections in DB:');
  console.table(secs);

  process.exit(0);
}

remapAndVerify().catch((err) => {
  console.error(err);
  process.exit(1);
});
