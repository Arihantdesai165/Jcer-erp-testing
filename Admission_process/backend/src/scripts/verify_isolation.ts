import db from '../config/database';
import { sectionAllocationService } from '../services/sectionAllocation.service';
import Department from '../models/Department';

async function testIsolation() {
  try {
    await db.authenticate();
    const aimlDept = await Department.findOne({ where: { code: 'CSE-AIML' } });
    if (!aimlDept) throw new Error('AIML Dept not found');

    const cseSectionId = 'c1445c62-f500-43c5-a163-11b914b9ae41'; // CSE Sem 1 Section A

    console.log('--- Testing Department Isolation: AIML HOD accessing CSE Section A ---');
    try {
      await sectionAllocationService.getSectionById(cseSectionId, aimlDept.id);
      console.error('FAILED: AIML HOD should NOT have access to CSE Section A!');
    } catch (e: any) {
      console.log('PASSED: AIML HOD access correctly denied with error:', e.message || e);
    }
  } catch (e) {
    console.error('Isolation test error:', e);
  } finally {
    await db.close();
  }
}
testIsolation();
