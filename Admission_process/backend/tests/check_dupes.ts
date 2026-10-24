import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Check for duplicate active enrollments per student/dept/AY/semester
    const dupes = await sequelize.query(
      `SELECT "studentId", "departmentId", "academicYearId", "semesterId", count(*) as count 
       FROM student_academic_enrollments 
       WHERE status = 'ACTIVE'
       GROUP BY "studentId", "departmentId", "academicYearId", "semesterId" 
       HAVING count(*) > 1;`,
      { type: QueryTypes.SELECT }
    );

    console.log('Duplicate active enrollments found:', dupes.length);
    if (dupes.length > 0) {
      console.table(dupes);
    } else {
      console.log('NO duplicate active enrollments exist! Clean dataset.');
    }

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
