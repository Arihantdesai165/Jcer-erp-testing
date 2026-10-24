import db from '../config/database';

async function check() {
  try {
    await db.authenticate();
    const [constraints] = await db.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'sections'::regclass;
    `);
    console.log('=== CONSTRAINTS ===\n', JSON.stringify(constraints, null, 2));

    const [indexes] = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sections';
    `);
    console.log('=== INDEXES ===\n', JSON.stringify(indexes, null, 2));

    const [sections] = await db.query(`
      SELECT id, name, "departmentId", semester, "academicYear", branch, capacity, status
      FROM sections;
    `);
    console.log('=== SECTIONS IN DB ===\n', JSON.stringify(sections, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await db.close();
  }
}

check();
