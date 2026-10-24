import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();
    const rows = await sequelize.query(
      `SELECT "sectionId", count(*) 
       FROM student_academic_enrollments 
       WHERE "departmentId" = '93be386a-f655-4ec3-89fb-4bccd340bf3a' 
       GROUP BY "sectionId";`,
      { type: QueryTypes.SELECT }
    );
    console.table(rows);
  } finally {
    await sequelize.close();
  }
}

main();
