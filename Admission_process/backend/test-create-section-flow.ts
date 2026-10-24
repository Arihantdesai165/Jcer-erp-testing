import sequelize from './src/config/database';
import Department from './src/models/Department';
import Section from './src/models/Section';
import { SectionAllocationService } from './src/services/sectionAllocation.service';

async function testCreateSectionFlow() {
  console.log('========================================================');
  console.log('TESTING SECTION ALLOCATION CREATION & AUTO-SELECTION');
  console.log('========================================================\n');

  await sequelize.authenticate();
  console.log('✓ Database connected.');

  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  const aimlDept = await Department.findOne({ where: { code: 'CSE-AIML' } });
  const asDept = await Department.findOne({ where: { code: 'AS' } });

  if (!cseDept || !aimlDept || !asDept) {
    throw new Error('Required departments missing.');
  }

  const service = new SectionAllocationService();
  const testAy = '2026-27';
  const testSem = 1;

  function getNextAvailableAlphabet(sections: any[]) {
    const existing = new Set<string>();
    sections.forEach((s) => {
      const clean = s.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
      if (clean && clean.length === 1 && clean >= 'A' && clean <= 'Z') {
        existing.add(clean);
      }
    });
    const ALPHABETS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    const next = ALPHABETS.find((l) => !existing.has(l));
    return { existing: Array.from(existing).sort(), next };
  }

  console.log('\n--- 1. CURRENT LIVE SECTIONS & AUTO-SELECTION ---');
  // CSE Sections
  const existingCseSections = await service.getSections(asDept.id, testSem, testAy, 'CSE');
  const cseNext = getNextAvailableAlphabet(existingCseSections);
  console.log(`Current CSE sections (Sem 1):      [${existingCseSections.map((s) => s.name).join(', ')}]`);
  console.log(`CSE Existing Alphabets:           [${cseNext.existing.join(', ')}]`);
  console.log(`CSE Next Auto-selected Alphabet:  "${cseNext.next}"`);
  if (cseNext.next !== 'C') {
    throw new Error(`FAIL: Expected next CSE alphabet to be C (since A, B exist), got "${cseNext.next}"`);
  }
  console.log('✓ PASS: Next auto-selected alphabet for CSE is C!');

  // CSE-AIML Sections
  const existingAimlSections = await service.getSections(asDept.id, testSem, testAy, 'CSE-AIML');
  const aimlNext = getNextAvailableAlphabet(existingAimlSections);
  console.log(`Current CSE-AIML sections (Sem 1): [${existingAimlSections.map((s) => s.name).join(', ')}]`);
  console.log(`CSE-AIML Existing Alphabets:      [${aimlNext.existing.join(', ')}]`);
  console.log(`CSE-AIML Next Auto-selected:      "${aimlNext.next}"`);
  if (aimlNext.next !== 'C') {
    throw new Error(`FAIL: Expected next CSE-AIML alphabet to be C (since A, B exist), got "${aimlNext.next}"`);
  }
  console.log('✓ PASS: Next auto-selected alphabet for CSE-AIML is C!');

  console.log('\n--- 2. DUPLICATE PREVENTION VALIDATION ---');
  // Test duplicate creation rejection for Section A in CSE
  let cseDupRejected = false;
  try {
    await service.createSection(asDept.id, {
      name: 'Section A',
      semester: testSem,
      capacity: 60,
      branch: 'CSE',
      academicYear: testAy,
    });
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      cseDupRejected = true;
      console.log(`✓ PASS: Duplicate Section A for CSE rejected: "${err.message}"`);
    } else {
      throw err;
    }
  }
  if (!cseDupRejected) {
    throw new Error('FAIL: Duplicate Section A creation for CSE was not rejected!');
  }

  // Test duplicate creation rejection for Section B in CSE-AIML
  let aimlDupRejected = false;
  try {
    await service.createSection(asDept.id, {
      name: 'Section B',
      semester: testSem,
      capacity: 60,
      branch: 'CSE-AIML',
      academicYear: testAy,
    });
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      aimlDupRejected = true;
      console.log(`✓ PASS: Duplicate Section B for CSE-AIML rejected: "${err.message}"`);
    } else {
      throw err;
    }
  }
  if (!aimlDupRejected) {
    throw new Error('FAIL: Duplicate Section B creation for CSE-AIML was not rejected!');
  }

  console.log('\n--- 3. PROGRESSIVE AUTO-SELECTION SIMULATION (C -> D -> E) ---');
  const simulatedSections = [
    { name: 'Section A' },
    { name: 'Section B' },
    { name: 'Section C' },
  ];
  const nextAfterC = getNextAvailableAlphabet(simulatedSections);
  console.log(`With [A, B, C] -> Next: "${nextAfterC.next}"`);
  if (nextAfterC.next !== 'D') {
    throw new Error(`FAIL: Expected D, got ${nextAfterC.next}`);
  }
  console.log('✓ PASS: Correctly advances to D!');

  const simulatedAllLetters = Array.from({ length: 26 }, (_, i) => ({
    name: `Section ${String.fromCharCode(65 + i)}`,
  }));
  const nextWhenFull = getNextAvailableAlphabet(simulatedAllLetters);
  console.log(`With all 26 letters [A-Z] -> Next: ${nextWhenFull.next === undefined ? 'None' : nextWhenFull.next}`);
  if (nextWhenFull.next !== undefined) {
    throw new Error('FAIL: Expected undefined when all 26 alphabets are used!');
  }
  console.log('✓ PASS: Detects when all 26 alphabets are exhausted!');

  console.log('\n========================================================');
  console.log('ALL SECTION CREATION & AUTO-SELECTION TESTS PASSED (100%)');
  console.log('========================================================\n');
}

testCreateSectionFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
  });
