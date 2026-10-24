import db from '../config/database';

async function migrate() {
  try {
    await db.authenticate();
    console.log('DB connected');

    // 1. Add activeSchemeId to departments
    await db.query(`
      ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS "activeSchemeId" VARCHAR(30) DEFAULT NULL;
    `);
    console.log('Added activeSchemeId to departments');

    // 2. Add cycle and schemeId to subjects
    await db.query(`
      ALTER TABLE subjects
      ADD COLUMN IF NOT EXISTS "cycle" VARCHAR(20) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "schemeId" VARCHAR(30) DEFAULT '2025';
    `);
    console.log('Added cycle and schemeId to subjects');

    // 3. Add cycle to teachers
    await db.query(`
      ALTER TABLE teachers
      ADD COLUMN IF NOT EXISTS "cycle" VARCHAR(20) DEFAULT NULL;
    `);
    console.log('Added cycle to teachers');

    // 4. Update existing subjects with schemeId = '2025' if null
    await db.query(`
      UPDATE subjects SET "schemeId" = '2025' WHERE "schemeId" IS NULL;
    `);

    // 5. Drop old global unique constraints on subjects.code if present
    await db.query(`
      ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
      ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key1;
      DROP INDEX IF EXISTS subjects_code_key;
      DROP INDEX IF EXISTS subjects_code_key1;
    `);
    console.log('Dropped old global unique constraint on subjects.code');

    // 6. Create composite unique index on subjects (departmentId, COALESCE(cycle, ''), semester, schemeId, code)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_dept_cycle_sem_scheme_code_uq
      ON subjects ("departmentId", COALESCE(cycle, ''), semester, "schemeId", code);
    `);
    console.log('Created subjects_dept_cycle_sem_scheme_code_uq');

    // 7. Verify columns & indexes
    const [cols] = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subjects';");
    console.log('SUBJECT COLS:', cols.map((c: any) => c.column_name));

    const [indexes] = await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subjects';");
    console.log('SUBJECT INDEXES:', indexes.map((i: any) => i.indexname));

  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await db.close();
  }
}
migrate();
