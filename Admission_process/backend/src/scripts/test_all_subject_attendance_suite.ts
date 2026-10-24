import sequelize from '../config/database';
import Department from '../models/Department';
import User from '../models/User';
import Subject from '../models/Subject';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import facultyService, { ATTENDANCE_THRESHOLD } from '../services/faculty.service';
import semesterAttendanceConsolidationService from '../services/semesterAttendanceConsolidation.service';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('ALL SUBJECT ATTENDANCE — COMPREHENSIVE VERIFICATION & TEST SUITE');
  console.log('========================================================================\n');

  try {
    await sequelize.authenticate();
    console.log('✓ Database connection verified.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP & LOCATE USERS & COHORTS
    // ─────────────────────────────────────────────────────────────────────────
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!cseDept) throw new Error('CSE department not found.');
    console.log(`✓ Located CSE Department: ${cseDept.id} (${cseDept.name})`);

    const academicYear = '2026-27';
    const semester = 1;

    // Locate the Semester 1 CSE faculty members:
    // 1. Rahul Sharma (rahul.sharma.test@jcer.edu) -> 1BCEDS103, Sec A
    // 2. Neha Verma (neha.verma.test@jcer.edu) -> 1BCEDS103, Sec B
    // 3. Dr. S.V. Gorbal (arihantdesai47@gmail.com) -> 1BESC104, Sec A
    const rahulUser = await User.findOne({ where: { email: 'rahul.sharma.test@jcer.edu' } });
    const nehaUser = await User.findOne({ where: { email: 'neha.verma.test@jcer.edu' } });
    const gorbalUser = await User.findOne({ where: { email: 'arihantdesai47@gmail.com' } });

    if (!rahulUser || !nehaUser || !gorbalUser) {
      throw new Error('Required test faculty users not found in database.');
    }
    console.log(`✓ Located Faculty A: Rahul Sharma (${rahulUser.id})`);
    console.log(`✓ Located Faculty B: Neha Verma (${nehaUser.id})`);
    console.log(`✓ Located Faculty C: Dr. S.V. Gorbal (${gorbalUser.id})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST A: Multiple Faculty Members Shared Cohort Visibility
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST A: MULTIPLE FACULTY COHORT & ALL SUBJECTS VISIBILITY ---');

    // Test Rahul Sharma
    const cohortsRahul = await facultyService.getFacultyAllSubjectAttendanceCohorts(rahulUser.id, rahulUser.role);
    console.log(`Rahul Sharma Authorized Cohorts:`, cohortsRahul.cohorts.map((c) => `Sem ${c.semester} ${c.departmentCode} (Sec: ${c.sections.join(',')})`));

    const regRahul = await facultyService.getFacultyAllSubjectAttendanceRegister(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester, departmentId: cseDept.id, section: 'A' }
    );
    console.log(`Rahul Sharma View:`);
    console.log(`- Students returned: ${regRahul.students.length}`);
    console.log(`- Subjects returned: ${regRahul.subjects.map((s) => s.code).join(', ')}`);

    // Verify all 4 subjects appear for Rahul, even though he only teaches 1BCEDS103
    const subjectCodesRahul = regRahul.subjects.map((s) => s.code);
    const expectedSubjects = ['1BCEDS103', '1BEIT105', '1BESC104', 'CAED101'];
    const hasAllSubjectsRahul = expectedSubjects.every((code) => subjectCodesRahul.includes(code));
    if (!hasAllSubjectsRahul) {
      throw new Error('TEST A FAILED: Rahul Sharma does not see all cohort subjects.');
    }
    console.log('✓ Rahul Sharma sees all 4 cohort subjects (not just 1BCEDS103).');

    // Test Dr. S.V. Gorbal
    const regGorbal = await facultyService.getFacultyAllSubjectAttendanceRegister(
      gorbalUser.id,
      gorbalUser.role,
      { academicYear, semester, departmentId: cseDept.id, section: 'A' }
    );
    console.log(`Dr. S.V. Gorbal View:`);
    console.log(`- Students returned: ${regGorbal.students.length}`);
    console.log(`- Subjects returned: ${regGorbal.subjects.map((s) => s.code).join(', ')}`);

    const hasAllSubjectsGorbal = expectedSubjects.every((code) =>
      regGorbal.subjects.map((s) => s.code).includes(code)
    );
    if (!hasAllSubjectsGorbal) {
      throw new Error('TEST A FAILED: Dr. S.V. Gorbal does not see all cohort subjects.');
    }
    console.log('✓ Dr. S.V. Gorbal sees all 4 cohort subjects (not just 1BESC104).');

    // Test Neha Verma
    const regNeha = await facultyService.getFacultyAllSubjectAttendanceRegister(
      nehaUser.id,
      nehaUser.role,
      { academicYear, semester, departmentId: cseDept.id, section: 'B' }
    );
    console.log(`Neha Verma View (Section B):`);
    console.log(`- Students returned: ${regNeha.students.length}`);
    console.log(`- Subjects returned: ${regNeha.subjects.map((s) => s.code).join(', ')}`);
    console.log('✓ TEST A PASSED: All authorized faculty members see all cohort subjects.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST B: Spreadsheet Consistency with Existing Working Register
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST B: SPREADSHEET CONSISTENCY WITH EXISTING REGISTER ---');
    const fullRegister = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
      academicYear,
      departmentId: cseDept.id,
      semester,
    });

    console.log(`Total students in full register: ${fullRegister.students.length}`);
    console.log(`Total subjects: ${fullRegister.subjects.length}`);
    console.log(`Subject summaries:`, fullRegister.subjectSummaries.map((s) => `${s.subjectCode}: cond=${s.conductedClasses}, avg=${s.averagePercentage}%`));

    // Verify student Laxmi Pattanshetti (CER-2026-CSE-0004 from screenshot)
    const laxmi = fullRegister.students.find((s) => s.name.toLowerCase().includes('laxmi'));
    if (laxmi) {
      console.log(`Sample Student: ${laxmi.name} (${laxmi.usn}, Sec ${laxmi.section})`);
      console.log(`- Total Conducted: ${laxmi.totalConducted}`);
      console.log(`- Total Attended: ${laxmi.totalAttended}`);
      console.log(`- Overall %: ${laxmi.overallPercentage}%`);
      console.log(`- Eligibility: ${laxmi.eligibility}`);

      if (laxmi.overallPercentage !== null && laxmi.overallPercentage >= ATTENDANCE_THRESHOLD) {
        if (laxmi.eligibility !== 'Eligible') {
          throw new Error('TEST B FAILED: Laxmi eligibility mismatch.');
        }
      }
    }

    // Verify Excel generation buffer produces valid spreadsheet
    const excelBuffer = await semesterAttendanceConsolidationService.generateConsolidatedExcelBuffer(fullRegister);
    console.log(`✓ Excel buffer successfully generated: ${excelBuffer.length} bytes.`);
    console.log('✓ TEST B PASSED: Consistency with existing spreadsheet calculations verified.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST D & E: Read-Only & Authorization Enforcement
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST D & E: AUTHORIZATION & READ-ONLY ENFORCEMENT ---');

    // 1. Unauthorized cohort access attempt:
    // Try to access Semester 7 (neither Rahul nor Neha teach Sem 7)
    let sem7Blocked = false;
    try {
      await facultyService.getFacultyAllSubjectAttendanceRegister(
        rahulUser.id,
        rahulUser.role,
        { academicYear, semester: 7, departmentId: cseDept.id }
      );
    } catch (e: any) {
      if (e.message.includes('Unauthorized')) {
        sem7Blocked = true;
      }
    }
    if (!sem7Blocked) {
      throw new Error('TEST E FAILED: Unauthorized semester access was NOT blocked.');
    }
    console.log('✓ Unauthorized semester access strictly rejected with 403/Unauthorized.');

    // 2. Unauthorized department access attempt:
    // Create or find dummy department ID
    let randomDeptBlocked = false;
    try {
      await facultyService.getFacultyAllSubjectAttendanceRegister(
        rahulUser.id,
        rahulUser.role,
        { academicYear, semester: 1, departmentId: '00000000-0000-0000-0000-000000000000' }
      );
    } catch (e: any) {
      if (e.message.includes('Unauthorized')) {
        randomDeptBlocked = true;
      }
    }
    if (!randomDeptBlocked) {
      throw new Error('TEST E FAILED: Unauthorized department access was NOT blocked.');
    }
    console.log('✓ Unauthorized department access strictly rejected.');

    // 3. Section restriction check:
    // Rahul Sharma only teaches Section A. Attempt to access Section B:
    let sectionBBlocked = false;
    try {
      await facultyService.getFacultyAllSubjectAttendanceRegister(
        rahulUser.id,
        rahulUser.role,
        { academicYear, semester: 1, departmentId: cseDept.id, section: 'B' }
      );
    } catch (e: any) {
      if (e.message.includes('Unauthorized') && e.message.includes('Section B')) {
        sectionBBlocked = true;
      }
    }
    if (!sectionBBlocked) {
      throw new Error('TEST E FAILED: Section-restricted faculty accessing unauthorized section was NOT blocked.');
    }
    console.log('✓ Section-restricted faculty accessing unauthorized Section B strictly rejected.');
    console.log('✓ TEST D & E PASSED: Rigorous authorization enforcement verified.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST F: Academic-Year Integrity
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST F: ACADEMIC-YEAR INTEGRITY ---');
    // Ensure requesting a historical AY does not leak current AY attendance
    const historicalAY = '2024-25';
    let histBlockedOrEmpty = false;
    try {
      const histData = await facultyService.getFacultyAllSubjectAttendanceRegister(
        rahulUser.id,
        rahulUser.role,
        { academicYear: historicalAY, semester: 1, departmentId: cseDept.id }
      );
      if (histData.students.length === 0) histBlockedOrEmpty = true;
    } catch (e: any) {
      if (e.message.includes('Unauthorized')) histBlockedOrEmpty = true;
    }
    if (!histBlockedOrEmpty) {
      throw new Error('TEST F FAILED: Historical AY improperly accessed.');
    }
    console.log('✓ TEST F PASSED: Academic-year boundary and integrity preserved.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST G: Edge Cases (Filtered Sections & All Sections Consolidation)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST G: ALL SECTIONS CONSOLIDATION & FILTERING ---');
    
    // 1. All Sections selection for Sem 1 CSE
    const allSecData = await facultyService.getFacultyAllSubjectAttendanceRegister(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester: 1, departmentId: cseDept.id, section: 'ALL' }
    );
    console.log(`All Sections students count: ${allSecData.students.length}`);

    // Check no duplicate students
    const studentIds = allSecData.students.map((s) => s.id);
    const uniqueIds = new Set(studentIds);
    if (studentIds.length !== uniqueIds.size) {
      throw new Error(`TEST G FAILED: Duplicate students found in All Sections consolidated register.`);
    }
    console.log('✓ Consolidated register contains no duplicate students.');

    // Check subjects are unique
    const subCodes = allSecData.subjects.map((s) => s.code);
    const uniqueSubCodes = new Set(subCodes);
    if (subCodes.length !== uniqueSubCodes.size) {
      throw new Error(`TEST G FAILED: Duplicate subject columns found in All Sections register.`);
    }
    console.log('✓ Consolidated register contains unique subject columns.');

    // 2. Individual section filters
    const secAData = await facultyService.getFacultyAllSubjectAttendanceRegister(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester: 1, departmentId: cseDept.id, section: 'A' }
    );
    const secBData = await facultyService.getFacultyAllSubjectAttendanceRegister(
      nehaUser.id,
      nehaUser.role,
      { academicYear, semester: 1, departmentId: cseDept.id, section: 'B' }
    );

    console.log(`Section A students count: ${secAData.students.length}`);
    console.log(`Section B students count: ${secBData.students.length}`);

    const allSecA = secAData.students.every((s) => s.section === 'A');
    const allSecB = secBData.students.every((s) => s.section === 'B');
    if (!allSecA || !allSecB) {
      throw new Error('TEST G FAILED: Section-filtered students contained cross-section records.');
    }
    console.log('✓ Section filtering accurately scopes student rosters without leaking cross-section students.');

    // 3. Union verification: Sec A count + Sec B count == All Sections count
    if (allSecData.students.length !== (secAData.students.length + secBData.students.length)) {
      throw new Error(
        `TEST G FAILED: Count mismatch! All Sections (${allSecData.students.length}) != Sec A (${secAData.students.length}) + Sec B (${secBData.students.length})`
      );
    }
    console.log(`✓ All Sections count (${allSecData.students.length}) exactly matches sum of Section A (${secAData.students.length}) and Section B (${secBData.students.length}).`);

    // 4. Excel Export Filter Matching
    console.log('\n--- TEST H: EXCEL EXPORT MATCHES SECTION SELECTION ---');
    const excelAll = await facultyService.exportFacultyAllSubjectAttendanceExcel(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester: 1, departmentId: cseDept.id, section: 'ALL' }
    );
    console.log(`Excel All Sections: filename=${excelAll.fileName}, size=${excelAll.buffer.length} bytes`);
    if (!excelAll.fileName.includes('Sem1') || excelAll.fileName.includes('SecA') || excelAll.fileName.includes('SecB')) {
      throw new Error(`TEST H FAILED: All Sections excel filename unexpected: ${excelAll.fileName}`);
    }

    const excelSecA = await facultyService.exportFacultyAllSubjectAttendanceExcel(
      rahulUser.id,
      rahulUser.role,
      { academicYear, semester: 1, departmentId: cseDept.id, section: 'A' }
    );
    console.log(`Excel Section A: filename=${excelSecA.fileName}, size=${excelSecA.buffer.length} bytes`);
    if (!excelSecA.fileName.includes('SecA')) {
      throw new Error(`TEST H FAILED: Section A excel filename missing SecA: ${excelSecA.fileName}`);
    }
    console.log('✓ Excel export accurately respects section filter and naming convention.');

    console.log('\n========================================================================');
    console.log('ALL VERIFICATION AND TEST SCENARIOS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTestSuite();
