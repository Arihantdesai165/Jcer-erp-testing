import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // 1. Inspect sections table columns & constraints
    const sectionCols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'sections' 
       ORDER BY ordinal_position;`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- SECTIONS TABLE COLUMNS ---');
    console.table(sectionCols);

    const sectionIndexes = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sections';`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- SECTIONS TABLE INDEXES ---');
    console.table(sectionIndexes);

    // 2. Inspect student_academic_enrollments table columns & constraints
    const enrollmentCols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'student_academic_enrollments' 
       ORDER BY ordinal_position;`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- STUDENT_ACADEMIC_ENROLLMENTS TABLE COLUMNS ---');
    console.table(enrollmentCols);

    const enrollmentIndexes = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'student_academic_enrollments';`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- STUDENT_ACADEMIC_ENROLLMENTS TABLE INDEXES ---');
    console.table(enrollmentIndexes);

    // 3. Inspect students table section-related columns
    const studentCols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'students' AND column_name IN ('id', 'section', 'sectionId', 'semester', 'academicYear', 'departmentId');`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- STUDENTS TABLE SECTION-RELATED COLUMNS ---');
    console.table(studentCols);

    // 4. Inspect existing sections in the database
    const sections = await sequelize.query(
      `SELECT id, name, "departmentId", semester, "academicYear", capacity, status, "createdAt" 
       FROM sections 
       ORDER BY semester, name;`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- ALL SECTIONS IN DB ---');
    console.table(sections);

    // 5. Inspect existing student_academic_enrollments count by section
    const enrollmentsCount = await sequelize.query(
      `SELECT "sectionId", count(*) as count 
       FROM student_academic_enrollments 
       GROUP BY "sectionId";`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- ENROLLMENTS BY SECTION_ID ---');
    console.table(enrollmentsCount);

    // 6. Inspect students with section or sectionId set
    const studentsWithSection = await sequelize.query(
      `SELECT count(*) as total, 
              count("sectionId") as with_section_id, 
              count(section) as with_section_name 
       FROM students;`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n--- STUDENTS SECTION POPULATION ---');
    console.table(studentsWithSection);

  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
