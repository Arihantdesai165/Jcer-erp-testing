import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  const transaction = await sequelize.transaction();
  try {
    const secA = 'aa744435-cbc7-444a-8436-f3275af3c4df';
    const eceDept = '93be386a-f655-4ec3-89fb-4bccd340bf3a';

    // 1. Update student_academic_enrollments for ECE Sem 3 where sectionId is 'A' or 'Section A'
    const [updatedEnrollments] = await sequelize.query(`
      UPDATE student_academic_enrollments 
      SET "sectionId" = :secA
      WHERE "departmentId" = :eceDept 
        AND "semesterId" = 3 
        AND ("sectionId" = 'A' OR "sectionId" = 'Section A');
    `, {
      replacements: { secA, eceDept },
      transaction
    });
    console.log('Updated student_academic_enrollments count:', updatedEnrollments);

    // 2. Synchronize students table for those students
    const [updatedStudents] = await sequelize.query(`
      UPDATE students 
      SET "sectionId" = :secA,
          section = 'Section A'
      WHERE "departmentId" = :eceDept 
        AND semester = 3 
        AND (section = 'A' OR section = 'Section A')
        AND ("sectionId" IS NULL OR "sectionId" = :secA);
    `, {
      replacements: { secA, eceDept },
      transaction
    });
    console.log('Updated students table count:', updatedStudents);

    await transaction.commit();
    console.log('Data migration completed successfully!');
  } catch (err: any) {
    await transaction.rollback();
    console.error('Migration error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
