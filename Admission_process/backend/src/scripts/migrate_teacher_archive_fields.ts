import sequelize from '../config/database';

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.query(`
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'ACTIVE';
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP WITH TIME ZONE NULL;
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "archivedBy" UUID NULL;
    `);

    // Ensure all existing teacher rows have status = 'ACTIVE' if null
    await sequelize.query(`
      UPDATE "teachers" SET "status" = 'ACTIVE' WHERE "status" IS NULL;
    `);

    const [cols] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teachers';
    `);

    console.log('Teachers columns:', cols);
    console.log('Migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
