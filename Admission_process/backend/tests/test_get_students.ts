import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { getHodDepartmentStudents } from '../src/controllers/hod.controller';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const departmentId = '93be386a-f655-4ec3-89fb-4bccd340bf3a'; // ECE
    const semester = 3;

    console.log('Running getHodDepartmentStudents for departmentId:', departmentId, 'semester:', semester);
    const result = await getHodDepartmentStudents({
      departmentId,
      semester,
      limit: 1000,
    });

    console.log(`Success! Found ${result.rows.length} students (total count: ${result.count}).`);
  } catch (err: any) {
    console.error('CRITICAL ERROR in getHodDepartmentStudents:');
    console.error(err);
    if (err.sql) {
      console.error('SQL query:', err.sql);
    }
  } finally {
    await sequelize.close();
  }
}

main();
