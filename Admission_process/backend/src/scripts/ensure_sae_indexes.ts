import sequelize from '../config/database';

async function run() {
  await sequelize.authenticate();
  console.log('Database connected.');

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sae_student_ay_sem 
    ON student_academic_enrollments ("studentId", "academicYearId", "semesterId");
  `);
  console.log('✅ Unique index idx_sae_student_ay_sem verified/created.');

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_sae_student_id 
    ON student_academic_enrollments ("studentId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_sae_status 
    ON student_academic_enrollments ("status");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_sae_ay 
    ON student_academic_enrollments ("academicYearId");
  `);
  console.log('✅ Performance indexes on student_academic_enrollments verified/created.');

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
