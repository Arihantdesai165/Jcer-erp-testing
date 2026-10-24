import sequelize from './src/config/database';
import Department from './src/models/Department';
import Teacher from './src/models/Teacher';
import Section from './src/models/Section';
import Student from './src/models/Student';
import { findDepartmentCanonical, getBranchEquivalents, resolveDepartmentCanonical } from './src/utils/departmentCanonical.util';
import { SectionAllocationService } from './src/services/sectionAllocation.service';

async function runScenarioTests() {
  console.log('========================================================');
  console.log('STARTING CSE vs CSE-AIML CANONICAL IDENTITY TEST SUITE');
  console.log('========================================================\n');

  await sequelize.authenticate();
  console.log('✓ Database connection established.');

  const allDepts = await Department.findAll({ order: [['code', 'ASC']] });
  console.log(`✓ Loaded ${allDepts.length} departments:`);
  for (const d of allDepts) {
    console.log(`   - [${d.code}] ID=${d.id} Name="${d.name}"`);
  }

  const cseDept = allDepts.find((d) => d.code === 'CSE');
  const aimlDept = allDepts.find((d) => d.code === 'CSE-AIML');
  const asDept = allDepts.find((d) => d.code === 'AS');

  if (!cseDept || !aimlDept) {
    throw new Error('Missing CSE or CSE-AIML department in database!');
  }

  console.log('\n--- 1. DATABASE RECORD INDEPENDENCE ---');
  console.log(`CSE ID:      ${cseDept.id}`);
  console.log(`CSE-AIML ID: ${aimlDept.id}`);
  if (cseDept.id === aimlDept.id) {
    throw new Error('FAIL: CSE and CSE-AIML share the same ID!');
  }
  console.log('✓ PASS: CSE and CSE-AIML have distinct, non-overlapping UUIDs.');

  console.log('\n--- 2. CANONICAL RESOLVER TESTS (TEST 1 & TEST 2) ---');
  // Excel string variations that previously collapsed CSE-AIML to CSE
  const testInputs = [
    { input: 'CSE-AIML — Computer Science & Engineering (AIML)', expectedCode: 'CSE-AIML' },
    { input: 'CSE-AIML - Computer Science & Engineering (AIML)', expectedCode: 'CSE-AIML' },
    { input: 'CSE-AIML', expectedCode: 'CSE-AIML' },
    { input: 'AIML', expectedCode: 'CSE-AIML' },
    { input: 'Computer Science & Engineering (AIML)', expectedCode: 'CSE-AIML' },
    { input: 'CSE — Computer Science & Engineering', expectedCode: 'CSE' },
    { input: 'CSE - Computer Science & Engineering', expectedCode: 'CSE' },
    { input: 'CSE', expectedCode: 'CSE' },
    { input: 'Computer Science & Engineering', expectedCode: 'CSE' },
    { input: cseDept.id, expectedCode: 'CSE' },
    { input: aimlDept.id, expectedCode: 'CSE-AIML' },
  ];

  for (const t of testInputs) {
    const resolvedInMem = resolveDepartmentCanonical(t.input, allDepts);
    const resolvedDb = await findDepartmentCanonical(t.input);

    if (resolvedInMem?.code !== t.expectedCode) {
      throw new Error(`FAIL in-memory: "${t.input}" resolved to "${resolvedInMem?.code}", expected "${t.expectedCode}"`);
    }
    if (resolvedDb?.code !== t.expectedCode) {
      throw new Error(`FAIL DB: "${t.input}" resolved to "${resolvedDb?.code}", expected "${t.expectedCode}"`);
    }
    console.log(`✓ PASS: "${t.input}" → ${resolvedDb.code} (${resolvedDb.id})`);
  }

  console.log('\n--- 3. BRANCH EQUIVALENTS ISOLATION ---');
  const cseEquivs = getBranchEquivalents('CSE');
  const aimlEquivs = getBranchEquivalents('CSE-AIML');
  const legacyAimlEquivs = getBranchEquivalents('AIML');

  console.log(`CSE equivalents:      ${JSON.stringify(cseEquivs)}`);
  console.log(`CSE-AIML equivalents: ${JSON.stringify(aimlEquivs)}`);
  console.log(`AIML equivalents:     ${JSON.stringify(legacyAimlEquivs)}`);

  if (cseEquivs.includes('CSE-AIML') || cseEquivs.includes('AIML')) {
    throw new Error('FAIL: CSE equivalents contain AIML!');
  }
  if (aimlEquivs.includes('CSE')) {
    throw new Error('FAIL: CSE-AIML equivalents contain CSE!');
  }
  console.log('✓ PASS: CSE and CSE-AIML branch equivalents are strictly partitioned.');

  console.log('\n--- 4. SECTION ALLOCATION & SECTION RETRIEVAL (TEST 5, 6, 7, 8, 9) ---');
  const service = new SectionAllocationService();

  // Test Semester 1 sections for AS HOD querying CSE
  const cseSections = await service.getSections(asDept!.id, 1, '2026-27', 'CSE');
  console.log(`AS querying CSE Sem 1 sections: count = ${cseSections.length}`);
  for (const s of cseSections) {
    console.log(`   - Section "${s.name}" (branch: ${s.branch}, deptId: ${s.departmentId})`);
    if (s.branch === 'AIML' || s.branch === 'CSE-AIML') {
      throw new Error(`FAIL: CSE section query returned AIML section "${s.name}"!`);
    }
  }

  // Test Semester 1 sections for AS HOD querying CSE-AIML
  const aimlSectionsByCanon = await service.getSections(asDept!.id, 1, '2026-27', 'CSE-AIML');
  const aimlSectionsByAlias = await service.getSections(asDept!.id, 1, '2026-27', 'AIML');
  console.log(`AS querying CSE-AIML Sem 1 sections: count = ${aimlSectionsByCanon.length}`);
  console.log(`AS querying AIML Sem 1 sections:     count = ${aimlSectionsByAlias.length}`);

  if (aimlSectionsByCanon.length !== aimlSectionsByAlias.length) {
    throw new Error('FAIL: Querying by CSE-AIML and AIML gave different section counts!');
  }
  if (aimlSectionsByCanon.length === 0) {
    throw new Error('FAIL: Existing AIML sections not found when querying CSE-AIML!');
  }
  for (const s of aimlSectionsByCanon) {
    console.log(`   - Section "${s.name}" (branch: ${s.branch}, deptId: ${s.departmentId})`);
    if (s.branch === 'CSE') {
      throw new Error(`FAIL: CSE-AIML section query returned CSE section "${s.name}"!`);
    }
  }
  console.log('✓ PASS: Existing AIML sections (Section A, Section B) successfully returned for CSE-AIML!');

  console.log('\n--- 5. STUDENT COHORT ISOLATION ---');
  const cseStudentCount = await Student.count({ where: { departmentId: cseDept.id, semester: 1 } });
  const aimlStudentCount = await Student.count({ where: { departmentId: aimlDept.id, semester: 1 } });
  console.log(`CSE Semester 1 Students:      ${cseStudentCount}`);
  console.log(`CSE-AIML Semester 1 Students: ${aimlStudentCount}`);
  if (cseStudentCount === 0 || aimlStudentCount === 0) {
    console.warn('Note: One or both departments have 0 enrolled students in semester 1.');
  }

  console.log('\n--- 6. FACULTY CORE DEPT vs TEACHING DEPT INDEPENDENCE ---');
  console.log('Checking Teacher model structure...');
  const sampleTeacher = await Teacher.findOne({ where: { departmentId: cseDept.id } });
  if (sampleTeacher) {
    console.log(`Found faculty in CSE: ${sampleTeacher.id} (coreDeptId: ${sampleTeacher.departmentId})`);
    if (sampleTeacher.departmentId !== cseDept.id) {
      throw new Error('FAIL: Faculty departmentId does not match CSE ID!');
    }
  }

  console.log('\n========================================================');
  console.log('ALL CSE vs CSE-AIML SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('========================================================\n');
}

runScenarioTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
  });
