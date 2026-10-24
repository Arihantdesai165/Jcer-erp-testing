import sequelize from '../config/database';

async function run() {
  await sequelize.authenticate();
  const [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('DB TABLES:', tables.map((t: any) => t.table_name));

  const [studentCols] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='students'");
  console.log('STUDENTS COLS:', studentCols);

  const [enrollmentCols] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='student_academic_enrollments'");
  console.log('ENROLLMENT COLS:', enrollmentCols);

  process.exit(0);
}

run().catch(console.error);
