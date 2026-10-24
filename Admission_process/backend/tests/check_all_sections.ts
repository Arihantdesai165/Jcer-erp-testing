import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();

    const cseSections = await sequelize.query(
      `SELECT s.id, s.name, s."departmentId", d.code as dept_code, s.semester, s."academicYear", s.capacity 
       FROM sections s
       JOIN departments d ON d.id = s."departmentId"
       ORDER BY d.code, s.semester, s.name;`,
      { type: QueryTypes.SELECT }
    );
    console.table(cseSections);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
