import db from '../config/database';

async function migrate() {
  try {
    await db.authenticate();
    console.log('Connected to DB');

    // 1. Drop the old unique index that omitted 'branch'
    await db.query('DROP INDEX IF EXISTS sections_department_id_semester_academic_year_name;');
    console.log('Dropped old index sections_department_id_semester_academic_year_name');

    // 2. Create the new unique index that includes COALESCE(branch, '')
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sections_dept_sem_ay_branch_name_uq
      ON sections ("departmentId", semester, "academicYear", COALESCE(branch, ''), name);
    `);
    console.log('Created new unique index on ("departmentId", semester, "academicYear", COALESCE(branch, \'\'), name)');

    const [indexes] = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sections';
    `);
    console.log('CURRENT INDEXES:\n', JSON.stringify(indexes, null, 2));
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await db.close();
  }
}

migrate();
