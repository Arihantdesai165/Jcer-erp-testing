import sequelize from '../config/database';

async function migrate() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await sequelize.authenticate();
    console.log('PostgreSQL connected.');

    console.log('Executing cleanup migration to drop obsolete Google Sheets & OAuth database objects...');

    await sequelize.query(`
      DROP TABLE IF EXISTS "google_sheet_sync_logs" CASCADE;
      DROP TABLE IF EXISTS "google_sheet_resources" CASCADE;
      DROP TABLE IF EXISTS "google_sheet_tabs" CASCADE;
      DROP TABLE IF EXISTS "faculty_google_sheet_access" CASCADE;
      DROP TABLE IF EXISTS "google_sheet_connections" CASCADE;
      DROP TABLE IF EXISTS "google_oauth_tokens" CASCADE;
      ALTER TABLE IF EXISTS "faculty_assignments" DROP COLUMN IF EXISTS "googleSheetsAccess";
      DROP TYPE IF EXISTS "enum_google_oauth_tokens_status" CASCADE;
      DROP TYPE IF EXISTS "enum_google_sheet_connections_status" CASCADE;
      DROP TYPE IF EXISTS "enum_google_sheet_resources_sheetType" CASCADE;
      DROP TYPE IF EXISTS "enum_google_sheet_resources_status" CASCADE;
      DROP TYPE IF EXISTS "enum_google_sheet_sync_logs_syncType" CASCADE;
      DROP TYPE IF EXISTS "enum_google_sheet_sync_logs_status" CASCADE;
      DROP TYPE IF EXISTS "enum_faculty_google_sheet_access_accessRole" CASCADE;
      DROP TYPE IF EXISTS "enum_faculty_google_sheet_access_status" CASCADE;
    `);

    console.log('✅ Google Sheets & OAuth database objects successfully removed!');

    // Verify core tables
    const [tables]: any = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\nRemaining PostgreSQL Tables (${tables.length}):`);
    tables.forEach((t: any) => console.log(` - ${t.table_name}`));

    process.exit(0);
  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
