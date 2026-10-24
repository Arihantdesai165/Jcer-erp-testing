import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();

    const rowsWithA = await sequelize.query(
      `SELECT sae.id, sae."studentId", sae."departmentId", sae."semesterId", sae."academicYearId", sae."sectionId",
              s.section as student_section_name, s."sectionId" as student_section_id, s.usn, s.semester as student_semester
       FROM student_academic_enrollments sae
       JOIN students s ON s.id = sae."studentId"
       WHERE sae."sectionId" = 'A'
       LIMIT 10;`,
      { type: QueryTypes.SELECT }
    );

    console.log('Sample rows where sectionId = "A" in student_academic_enrollments:');
    console.table(rowsWithA);

    // Group by semester and academic year
    const summary = await sequelize.query(
      `SELECT "semesterId", "academicYearId", "departmentId", count(*) 
       FROM student_academic_enrollments 
       WHERE "sectionId" = 'A' 
       GROUP BY "semesterId", "academicYearId", "departmentId";`,
      { type: QueryTypes.SELECT }
    );
    console.log('Summary of sectionId = "A":');
    console.table(summary);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
