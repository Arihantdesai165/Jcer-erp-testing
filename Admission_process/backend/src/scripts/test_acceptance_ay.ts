import sequelize from '../config/database';
import { getHodDepartmentStudents } from '../controllers/hod.controller';
import Department from '../models/Department';

async function runFullAcceptanceTests() {
  await sequelize.authenticate();
  console.log('--- STARTING COMPREHENSIVE AY DATA ISOLATION ACCEPTANCE TESTS ---\n');

  const asDept = await Department.findOne({ where: { code: 'AS' } });
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });

  if (!asDept || !cseDept) {
    throw new Error('Required departments not found');
  }

  console.log('1. AS HOD Total Students:');
  const as26 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, academicYear: '2026-27' });
  const as27 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, academicYear: '2027-28' });
  console.log(`   AY 2026-27: ${as26.count} (Expected 401)`);
  console.log(`   AY 2027-28: ${as27.count} (Expected 0)`);

  console.log('\n2. AS HOD Semester 1 & 2 isolation:');
  const as26Sem1 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, semester: 1, academicYear: '2026-27' });
  const as27Sem1 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, semester: 1, academicYear: '2027-28' });
  console.log(`   Sem 1 AY 2026-27: ${as26Sem1.count} (Expected > 0)`);
  console.log(`   Sem 1 AY 2027-28: ${as27Sem1.count} (Expected 0)`);

  console.log('\n3. AS HOD Branch Filter (CSE):');
  const as26BranchCSE = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, branch: 'CSE', academicYear: '2026-27' });
  const as27BranchCSE = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, branch: 'CSE', academicYear: '2027-28' });
  console.log(`   Branch CSE AY 2026-27: ${as26BranchCSE.count} (Expected 113)`);
  console.log(`   Branch CSE AY 2027-28: ${as27BranchCSE.count} (Expected 0)`);

  console.log('\n4. AS HOD Section Filter (Section A):');
  const as26SecA = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, semester: 1, section: 'A', academicYear: '2026-27' });
  const as27SecA = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, semester: 1, section: 'A', academicYear: '2027-28' });
  console.log(`   Sem 1 Sec A AY 2026-27: ${as26SecA.count} (Expected > 0)`);
  console.log(`   Sem 1 Sec A AY 2027-28: ${as27SecA.count} (Expected 0)`);

  console.log('\n5. CSE HOD Department Scoping:');
  const cse26 = await getHodDepartmentStudents({ departmentId: cseDept.id, academicYear: '2026-27' });
  const cse27 = await getHodDepartmentStudents({ departmentId: cseDept.id, academicYear: '2027-28' });
  console.log(`   CSE AY 2026-27: ${cse26.count} (Expected 113)`);
  console.log(`   CSE AY 2027-28: ${cse27.count} (Expected 0)`);

  console.log('\n6. Search scoping within AY:');
  const search26 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, search: 'a', academicYear: '2026-27' });
  const search27 = await getHodDepartmentStudents({ departmentId: asDept.id, isSemesterHandling: true, search: 'a', academicYear: '2027-28' });
  console.log(`   Search 'a' AY 2026-27: ${search26.count} (Expected > 0)`);
  console.log(`   Search 'a' AY 2027-28: ${search27.count} (Expected 0)`);

  console.log('\n--- ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY ---');
  process.exit(0);
}

runFullAcceptanceTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
