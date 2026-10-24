import dotenv from 'dotenv';
dotenv.config();

import db from '../config/database';

async function migrateSubjectType() {
  try {
    await db.authenticate();
    console.log('Database connected.');

    // 1. Check current column data type in PostgreSQL information_schema
    const [columnInfo]: any = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'subjects' AND column_name = 'type';
    `);
    console.log('Current column info:', columnInfo);

    // 2. Convert column to VARCHAR(50) so any type (IPCC, CC, etc.) is seamlessly supported without ENUM constraint failures
    await db.query(`
      ALTER TABLE subjects 
      ALTER COLUMN type TYPE VARCHAR(50) 
      USING type::VARCHAR(50);
    `);
    console.log('Altered subjects.type to VARCHAR(50).');

    // 3. Set default to 'IPCC'
    await db.query(`
      ALTER TABLE subjects 
      ALTER COLUMN type SET DEFAULT 'IPCC';
    `);
    console.log('Set default of subjects.type to IPCC.');

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateSubjectType();
