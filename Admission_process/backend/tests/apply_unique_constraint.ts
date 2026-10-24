import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Add unique index on student_academic_enrollments for active enrollments
    console.log('Creating unique index on student_academic_enrollments...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_student_enrollment 
      ON student_academic_enrollments ("studentId", "departmentId", "academicYearId", "semesterId") 
      WHERE status = 'ACTIVE';
    `);
    console.log('Index uq_active_student_enrollment created successfully!');

    // Verify it in pg_indexes
    const idx = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'uq_active_student_enrollment';`,
      { type: QueryTypes.SELECT }
    );
    console.table(idx);

  } catch (err: any) {
    console.error('Error creating unique constraint:', err);
  } finally {
    await sequelize.close();
  }
}

main();
