import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../src/config/database';
import { findHodSectionByIdOrIdentifier, getCleanSectionCode, resolveStudentSection } from '../src/controllers/hod.controller';
import Section from '../src/models/Section';
import Student from '../src/models/Student';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const departmentId = '93be386a-f655-4ec3-89fb-4bccd340bf3a'; // ECE

    // Test 1: findHodSectionByIdOrIdentifier with valid UUID
    const sec1 = await findHodSectionByIdOrIdentifier('aa744435-cbc7-444a-8436-f3275af3c4df', departmentId);
    console.log('Test 1 (valid UUID):', sec1 ? `Found: ${sec1.name} (id: ${sec1.id})` : 'NOT FOUND');

    // Test 2: findHodSectionByIdOrIdentifier with invalid string
    const sec2 = await findHodSectionByIdOrIdentifier('invalid-uuid-123', departmentId);
    console.log('Test 2 (invalid string):', sec2 ? `Found: ${sec2.name}` : 'NOT FOUND (safe)');

    // Test 3: What if someone does a direct Sequelize query with an invalid UUID?
    try {
      console.log('Testing direct Sequelize query with invalid UUID...');
      await Section.findOne({ where: { id: 'not-a-real-uuid' } });
      console.log('Query succeeded unexpectedly');
    } catch (e: any) {
      console.log('Direct query with invalid UUID caught expected Postgres error:', e.message);
    }

  } catch (err: any) {
    console.error('Error in test:', err);
  } finally {
    await sequelize.close();
  }
}

main();
