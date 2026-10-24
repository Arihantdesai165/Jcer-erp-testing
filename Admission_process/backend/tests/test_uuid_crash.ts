import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import Student from '../src/models/Student';
import { Op } from 'sequelize';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Testing Student query with non-uuid in sectionId...');

    // This is what would happen if someone queried students where sectionId = 'A':
    try {
      await Student.findAll({
        where: {
          sectionId: 'A',
        },
      });
      console.log('Query with sectionId: "A" succeeded?');
    } catch (e: any) {
      console.log('CRASH CAUGHT: Student.findAll with sectionId: "A" ->', e.message);
    }

    // What if sectionId IN ('A')?
    try {
      await Student.findAll({
        where: {
          sectionId: { [Op.in]: ['A'] },
        },
      });
      console.log('Query with sectionId IN ("A") succeeded?');
    } catch (e: any) {
      console.log('CRASH CAUGHT: Student.findAll with sectionId IN ("A") ->', e.message);
    }

  } catch (err: any) {
    console.error('Test error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
