import db from '../config/database';

/**
 * Migration: Drop Old Bitwise Marks Schema Objects
 * Drops tables: student_marks, assessment_components, assessments
 * Safe, idempotent, dependency-aware.
 */
export async function up() {
  console.log('--- STARTING CLEANUP MIGRATION: REMOVE OLD BITWISE MARKS SCHEMA ---');

  const queryInterface = db.getQueryInterface();

  // 1. Drop foreign keys and tables in safe dependency order
  // Order: student_marks (leaf) -> assessment_components -> assessments (root)

  console.log('Dropping table: student_marks...');
  await db.query('DROP TABLE IF EXISTS "student_marks" CASCADE;');
  console.log('✓ Dropped student_marks.');

  console.log('Dropping table: assessment_components...');
  await db.query('DROP TABLE IF EXISTS "assessment_components" CASCADE;');
  console.log('✓ Dropped assessment_components.');

  console.log('Dropping table: assessments...');
  await db.query('DROP TABLE IF EXISTS "assessments" CASCADE;');
  console.log('✓ Dropped assessments.');

  // 2. Drop specific enum types created for these tables if they exist
  try {
    await db.query('DROP TYPE IF EXISTS "enum_assessment_components_componentType" CASCADE;');
    await db.query('DROP TYPE IF EXISTS "enum_assessments_status" CASCADE;');
    console.log('✓ Dropped associated ENUM types.');
  } catch (enumErr) {
    console.warn('Enum drop note:', enumErr);
  }

  console.log('--- CLEANUP MIGRATION COMPLETED SUCCESSFULLY ---');
}

export async function down() {
  console.log('--- REVERSING CLEANUP MIGRATION (Recreating old schema structure) ---');
  // Reversible down migration
  await db.query(`
    CREATE TABLE IF NOT EXISTS "assessments" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "departmentId" UUID NOT NULL REFERENCES "departments"("id"),
      "subjectId" UUID NOT NULL REFERENCES "subjects"("id"),
      "semester" INTEGER NOT NULL,
      "section" VARCHAR(20),
      "academicYear" VARCHAR(20) NOT NULL,
      "name" VARCHAR(100) NOT NULL,
      "maxMarks" DECIMAL(5,2) DEFAULT 50.00 NOT NULL,
      "status" VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "assessment_components" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "assessmentId" UUID NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
      "name" VARCHAR(50) NOT NULL,
      "componentType" VARCHAR(20) DEFAULT 'BIT' NOT NULL,
      "maxMarks" DECIMAL(5,2) DEFAULT 10.00 NOT NULL,
      "sequence" INTEGER DEFAULT 1 NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "student_marks" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "assessmentId" UUID NOT NULL REFERENCES "assessments"("id"),
      "componentId" UUID NOT NULL REFERENCES "assessment_components"("id"),
      "studentId" UUID NOT NULL REFERENCES "students"("id"),
      "marks" DECIMAL(5,2) DEFAULT 0.00 NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT "student_marks_unique" UNIQUE ("studentId", "assessmentId", "componentId")
    );
  `);
  console.log('✓ Restored old schema structure.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/scripts/migrate_remove_old_bitwise_marks.ts')) {
  (async () => {
    try {
      await db.authenticate();
      if (process.argv.includes('--down')) {
        await down();
      } else {
        await up();
      }
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}
