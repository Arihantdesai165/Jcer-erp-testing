import db from '../config/database';
import { QueryTypes } from 'sequelize';

async function checkForeignKeysAndData() {
  await db.authenticate();
  console.log('=== CHECKING POSTGRESQL TABLES & FOREIGN KEYS ===\n');

  // List all tables
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`,
    { type: QueryTypes.SELECT }
  );
  console.log('Public tables in database:', tables.map((t: any) => t.table_name).join(', '));

  // Check foreign keys pointing to teachers and users
  const foreignKeys = await db.query(
    `
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND (ccu.table_name IN ('teachers', 'users', 'faculty_assignments', 'FacultyAssignments'));
    `,
    { type: QueryTypes.SELECT }
  );
  console.log('\nForeign key references to teachers/users/faculty_assignments:');
  console.table(foreignKeys);

  // Check counts in faculty-related tables
  const facultyAuths = tables.some((t: any) => t.table_name.toLowerCase().includes('auth') || t.table_name.toLowerCase().includes('faculty'));
  console.log('\nChecking table counts:');
  for (const t of tables) {
    const name = (t as any).table_name;
    try {
      const res: any = await db.query(`SELECT count(*) as count FROM "${name}";`, { type: QueryTypes.SELECT });
      console.log(`  - ${name}: ${res[0].count} rows`);
    } catch (e: any) {
      console.log(`  - ${name}: error reading (${e.message})`);
    }
  }

  process.exit(0);
}

checkForeignKeysAndData().catch((err) => {
  console.error(err);
  process.exit(1);
});
