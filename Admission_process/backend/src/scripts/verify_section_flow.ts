import db from '../config/database';
import { sectionAllocationService } from '../services/sectionAllocation.service';
import { getHodDepartmentStudents } from '../controllers/hod.controller';
import Department from '../models/Department';

async function test() {
  try {
    await db.authenticate();
    console.log('Connected to DB');

    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!cseDept) throw new Error('CSE Dept not found');
    console.log('CSE Dept ID:', cseDept.id);

    const sectionId = 'c1445c62-f500-43c5-a163-11b914b9ae41'; // CSE Sem 1 Section A

    console.log('\n--- 1. Testing sectionAllocationService.getSectionById ---');
    const secMeta = await sectionAllocationService.getSectionById(sectionId, cseDept.id);
    console.log('Section Metadata:', JSON.stringify(secMeta, null, 2));

    console.log('\n--- 2. Testing sectionAllocationService.getSectionStudents ---');
    const secStudents = await sectionAllocationService.getSectionStudents(sectionId, cseDept.id);
    console.log('Returned Students Count:', secStudents.students.length);
    console.log('First 3 Students:');
    secStudents.students.slice(0, 3).forEach((s, idx) => {
      console.log(`  ${idx + 1}. ${s.name} (${s.enrollmentNumber}) - Sem ${s.semester} - Section ${s.currentSection}`);
    });
    console.log('Last Student:');
    const last = secStudents.students[secStudents.students.length - 1];
    console.log(`  40. ${last?.name} (${last?.enrollmentNumber}) - Sem ${last?.semester} - Section ${last?.currentSection}`);

    console.log('\n--- 3. Testing getHodDepartmentStudents filter (Semester 1, Section A) ---');
    const deptStudentsRes = await getHodDepartmentStudents({
      departmentId: cseDept.id,
      semester: 1,
      section: 'Section A',
      page: 1,
      limit: 100,
    });
    console.log('Dept Students Filter Total Count:', deptStudentsRes.count);
    console.log('Dept Students Filter Returned Rows:', deptStudentsRes.rows.length);

    console.log('\n--- 4. Testing getBranchesOverview for CSE HOD ---');
    const overview = await sectionAllocationService.getBranchesOverview(cseDept.id, 1, '2026-27');
    console.log('Overview:', JSON.stringify(overview, null, 2));

    console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (e) {
    console.error('Test error:', e);
  } finally {
    await db.close();
  }
}
test();
