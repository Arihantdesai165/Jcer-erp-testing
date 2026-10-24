import sequelize from '../config/database';

export async function migrateAppliedScienceScope() {
  try {
    console.log('Connecting to database for Applied Science schema update...');
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    // 1. Add columns to departments table if not present
    await sequelize.query(`
      ALTER TABLE IF EXISTS "departments" 
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
      ADD COLUMN IF NOT EXISTS "handlingSemesters" JSONB DEFAULT NULL;
    `);
    console.log('✓ departments table updated with type and handlingSemesters columns.');

    // 2. Add branch column to sections and faculty_assignments
    await sequelize.query(`
      ALTER TABLE IF EXISTS "sections" 
      ADD COLUMN IF NOT EXISTS "branch" VARCHAR(30) DEFAULT NULL;
      
      ALTER TABLE IF EXISTS "faculty_assignments" 
      ADD COLUMN IF NOT EXISTS "branch" VARCHAR(30) DEFAULT NULL;
    `);
    console.log('✓ sections and faculty_assignments updated with branch column.');

    // 3. Ensure Applied Science department exists
    const [existing]: any = await sequelize.query(`
      SELECT id, name, code, type FROM "departments" WHERE "code" = 'AS' OR "name" ILIKE '%Applied Science%';
    `);

    if (existing && existing.length > 0) {
      await sequelize.query(`
        UPDATE "departments" 
        SET "name" = 'Applied Science', 
            "code" = 'AS', 
            "type" = 'SEMESTER_HANDLING', 
            "handlingSemesters" = '[1, 2]'::jsonb,
            "updatedAt" = NOW()
        WHERE "id" = '${existing[0].id}';
      `);
      console.log(`✓ Updated existing department ${existing[0].name} to Applied Science (SEMESTER_HANDLING).`);
    } else {
      await sequelize.query(`
        INSERT INTO "departments" ("id", "name", "code", "type", "handlingSemesters", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          'Applied Science',
          'AS',
          'SEMESTER_HANDLING',
          '[1, 2]'::jsonb,
          NOW(),
          NOW()
        );
      `);
      console.log('✓ Created new Applied Science department (code: AS, type: SEMESTER_HANDLING).');
    }

    // 4. Update all other departments to ensure type is STANDARD
    await sequelize.query(`
      UPDATE "departments" 
      SET "type" = 'STANDARD'
      WHERE "code" != 'AS' AND ("type" IS NULL OR "type" = '');
    `);

    const [allDepts]: any = await sequelize.query(`
      SELECT id, name, code, type, "handlingSemesters" FROM "departments" ORDER BY name;
    `);
    console.log('\nCurrent Departments in Database:');
    allDepts.forEach((d: any) => {
      console.log(` - ${d.code}: ${d.name} [Type: ${d.type}, Semesters: ${JSON.stringify(d.handlingSemesters)}]`);
    });

    console.log('\n✅ Applied Science migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

if (require.main === module) {
  migrateAppliedScienceScope().then(() => process.exit(0)).catch(() => process.exit(1));
}
