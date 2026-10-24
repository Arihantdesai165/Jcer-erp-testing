import db from '../config/database';

/**
 * Migration: Completely Remove Mentorship Module
 * Drops tables: mentor_transitions, mentoring_records, mentor_assignments
 * Drops associated foreign keys, indexes, and ENUM types.
 * Safe, idempotent, dependency-aware.
 */
export async function up() {
  console.log('--- STARTING CLEANUP MIGRATION: REMOVE MENTORSHIP MODULE ---');

  // 1. Drop foreign keys and tables in safe dependency order
  // Order: mentor_transitions & mentoring_records (leaf) -> mentor_assignments (root)

  console.log('Dropping table: mentor_transitions...');
  await db.query('DROP TABLE IF EXISTS "mentor_transitions" CASCADE;');
  console.log('✓ Dropped mentor_transitions.');

  console.log('Dropping table: mentoring_records...');
  await db.query('DROP TABLE IF EXISTS "mentoring_records" CASCADE;');
  console.log('✓ Dropped mentoring_records.');

  console.log('Dropping table: mentor_assignments...');
  await db.query('DROP TABLE IF EXISTS "mentor_assignments" CASCADE;');
  console.log('✓ Dropped mentor_assignments.');

  // 2. Drop associated indexes (if standalone or remaining)
  const indexesToDrop = [
    'idx_mentor_assignments_student',
    'idx_mentor_assignments_faculty',
    'idx_mentor_assignments_dept',
    'idx_mentor_assignments_mentor_dept',
    'idx_mentor_assignments_status',
    'idx_mentor_assignments_ay_sem',
    'idx_mentor_assignments_phase',
    'idx_mentor_assignments_batch',
    'idx_mentoring_records_student',
    'idx_mentoring_records_faculty',
    'idx_mentoring_records_mentor_assignment',
    'idx_mentor_transitions_dept_status',
    'idx_mentor_transitions_student',
  ];

  for (const idx of indexesToDrop) {
    try {
      await db.query(`DROP INDEX IF EXISTS "${idx}" CASCADE;`);
    } catch {
      // Ignored if index was dropped with table
    }
  }
  console.log('✓ Dropped associated indexes.');

  // 3. Drop specific enum types if they exist
  const enumsToDrop = [
    'enum_mentor_assignments_status',
    'enum_mentor_assignments_phase',
    'enum_mentoring_records_meetingType',
    'enum_mentoring_records_concernCategory',
    'enum_mentoring_records_followUpStatus',
    'enum_mentor_transitions_status',
    'enum_mentor_transitions_decision',
  ];

  for (const enumName of enumsToDrop) {
    try {
      await db.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE;`);
    } catch (enumErr) {
      console.warn(`Enum drop note (${enumName}):`, enumErr);
    }
  }
  console.log('✓ Dropped associated ENUM types.');

  console.log('--- MENTORSHIP CLEANUP MIGRATION COMPLETED SUCCESSFULLY ---');
}

export async function down() {
  console.log('--- REVERSING MENTORSHIP CLEANUP MIGRATION ---');

  await db.query(`
    CREATE TABLE IF NOT EXISTS "mentor_assignments" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "studentId" UUID NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "facultyId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "assignedByHodId" UUID NOT NULL REFERENCES "users"("id"),
      "academicYear" VARCHAR(30) NOT NULL DEFAULT '2026-27',
      "semester" INTEGER NOT NULL,
      "departmentId" UUID NOT NULL REFERENCES "departments"("id"),
      "mentorDepartmentId" UUID NOT NULL REFERENCES "departments"("id"),
      "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      "phase" VARCHAR(20) NOT NULL DEFAULT 'PHASE_1',
      "startSemester" INTEGER NULL DEFAULT 1,
      "endSemester" INTEGER NULL DEFAULT 2,
      "admissionBatch" VARCHAR(30) NULL,
      "reassignmentReason" TEXT NULL,
      "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "reassignedAt" TIMESTAMP WITH TIME ZONE NULL,
      "notes" TEXT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "mentoring_records" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "studentId" UUID NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "mentorAssignmentId" UUID NULL REFERENCES "mentor_assignments"("id") ON DELETE SET NULL,
      "facultyId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "meetingDate" DATE NOT NULL DEFAULT CURRENT_DATE,
      "meetingType" VARCHAR(30) NOT NULL DEFAULT 'IN_PERSON',
      "concernCategory" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
      "summary" TEXT NOT NULL,
      "actionPlan" TEXT NULL,
      "followUpDate" DATE NULL,
      "followUpStatus" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      "resolutionNotes" TEXT NULL,
      "resolvedAt" TIMESTAMP WITH TIME ZONE NULL,
      "createdBy" UUID NOT NULL REFERENCES "users"("id"),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "mentor_transitions" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "studentId" UUID NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "departmentId" UUID NOT NULL REFERENCES "departments"("id"),
      "admissionBatch" VARCHAR(30) NOT NULL DEFAULT '2026-27',
      "fromPhase" VARCHAR(20) NOT NULL DEFAULT 'PHASE_1',
      "toPhase" VARCHAR(20) NOT NULL DEFAULT 'PHASE_2',
      "fromSemester" INTEGER NOT NULL DEFAULT 2,
      "toSemester" INTEGER NOT NULL DEFAULT 3,
      "previousFacultyId" UUID NULL REFERENCES "users"("id") ON DELETE SET NULL,
      "newFacultyId" UUID NULL REFERENCES "users"("id") ON DELETE SET NULL,
      "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "decision" VARCHAR(30) NULL,
      "resolvedByHodId" UUID NULL REFERENCES "users"("id"),
      "resolvedAt" TIMESTAMP WITH TIME ZONE NULL,
      "notes" TEXT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT "unique_student_phase_transition" UNIQUE ("studentId", "toPhase")
    );
  `);
  console.log('✓ Restored mentorship tables.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/scripts/migrate_remove_mentorship_module.ts')) {
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
