import db from './config/database';
import AcademicYear from './models/AcademicYear';
import Semester from './models/Semester';
import SystemConfiguration from './models/SystemConfiguration';
import Student from './models/Student';
import StudentAcademicEnrollment from './models/StudentAcademicEnrollment';
import { normalizeAcademicYear, areAcademicYearsEqual } from './utils/academicYear.util';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runCentralizedSuite() {
  console.log('\n============================================================');
  console.log('JCER ERP — CENTRALIZED ACADEMIC YEAR MANAGEMENT TEST SUITE');
  console.log('============================================================\n');

  try {
    await db.authenticate();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST A: Operational Starting Year & Exclusion of 2025-26
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- TEST A: Operational Starting Year & Exclusion of 2025-26 ---');

    // 1. Query operational years via controller logic
    const operationalYears = await AcademicYear.findAll({
      where: {
        isOperational: true,
      },
      order: [['year', 'DESC']],
    });
    const operationalYearStrings = operationalYears.map(y => y.year);

    assert(!operationalYearStrings.includes('2025-26'), '2025-26 does not appear in operational years');
    assert(operationalYearStrings.includes('2026-27'), '2026-27 is present in operational years');
    assert(operationalYearStrings.includes('2027-28'), '2027-28 is present in operational years');

    // 2. Query all database records to verify historical retention of 2025-26
    const allDbYears = await AcademicYear.findAll({ order: [['year', 'ASC']] });
    const has2025Db = allDbYears.some(y => y.year === '2025-26');
    assert(has2025Db, '2025-26 row remains intact in database (not deleted)');

    const y2025 = allDbYears.find(y => y.year === '2025-26');
    assert(y2025?.isOperational === false, '2025-26 is marked with isOperational = false');
    assert(y2025?.isCurrent === false, '2025-26 is not current');

    // 3. Test activation rejection for 2025-26
    const testAdminController = await import('./controllers/admin.controller');
    let rejected2025 = false;
    let rejectMsg = '';
    const mockReq2025: any = {
      body: { academicYear: '2025-26' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const mockRes2025: any = {
      status: (code: number) => ({
        json: (payload: any) => {
          if (code === 400) {
            rejected2025 = true;
            rejectMsg = payload.error;
          }
          return payload;
        },
      }),
      json: (payload: any) => payload,
    };
    await testAdminController.updateSettings(mockReq2025, mockRes2025, (() => {}) as any);
    assert(rejected2025, `Attempts to activate 2025-26 are rejected with HTTP 400: "${rejectMsg}"`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST B: Future-Year Creation & Consecutive Generation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST B: Future-Year Creation & Consecutive Generation ---');

    const systemController = await import('./controllers/system.controller');

    // 1. Create a single future academic year (e.g. 2028-29)
    await AcademicYear.destroy({ where: { year: '2028-29' } }).catch(() => {});
    await Semester.destroy({ where: { academicYear: '2028-29' } }).catch(() => {});

    let createStatus = 0;
    let createBody: any = null;
    const mockReqCreate: any = {
      body: { year: '2028-29' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const mockResCreate: any = {
      status: (c: number) => ({
        json: (p: any) => {
          createStatus = c;
          createBody = p;
          return p;
        },
      }),
    };
    await systemController.createAcademicYear(mockReqCreate, mockResCreate, ((err: any) => console.error(err)) as any);
    assert(createStatus === 201, 'Single future year 2028-29 created successfully (201)');

    const ay2028 = await AcademicYear.findOne({ where: { year: '2028-29' } });
    assert(ay2028 !== null, '2028-29 exists in database');
    assert(ay2028?.isCurrent === false, '2028-29 is created as NOT active (isCurrent = false)');
    assert(ay2028?.status === 'UPCOMING', '2028-29 status is UPCOMING');
    assert(ay2028?.isOperational === true, '2028-29 isOperational is true');

    const sems2028 = await Semester.findAll({ where: { academicYear: '2028-29' } });
    assert(sems2028.length === 8, `Semesters 1 through 8 configured for 2028-29 (count = ${sems2028.length})`);

    // 2. Generate consecutive future years (e.g. 4 years starting from 2029-30)
    await AcademicYear.destroy({ where: { year: ['2029-30', '2030-31', '2031-32', '2032-33'] } }).catch(() => {});
    await Semester.destroy({ where: { academicYear: ['2029-30', '2030-31', '2031-32', '2032-33'] } }).catch(() => {});

    let genStatus = 0;
    let genBody: any = null;
    const mockReqGen: any = {
      body: { startYear: '2029-30', count: 4 }, // 2029-30, 2030-31, 2031-32, 2032-33
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const mockResGen: any = {
      status: (c: number) => ({
        json: (p: any) => {
          genStatus = c;
          genBody = p;
          return p;
        },
      }),
    };
    await systemController.generateAcademicYears(mockReqGen, mockResGen, ((err: any) => console.error(err)) as any);
    assert(genStatus === 200, 'generateAcademicYears executed successfully (200)');
    assert(genBody?.data?.newlyCreatedCount === 4, `4 new consecutive years created (got ${genBody?.data?.newlyCreatedCount})`);

    // Check years exist: 2029-30, 2030-31, 2031-32, 2032-33
    const expectedYears = ['2029-30', '2030-31', '2031-32', '2032-33'];
    for (const yr of expectedYears) {
      const rec = await AcademicYear.findOne({ where: { year: yr } });
      assert(rec !== null && rec.status === 'UPCOMING' && rec.isCurrent === false, `Year ${yr} generated correctly with status UPCOMING`);
      const sems = await Semester.findAll({ where: { academicYear: yr } });
      assert(sems.length === 8, `Year ${yr} has 8 configured semesters`);
    }

    // 3. Test Idempotency: Run generation AGAIN
    let genStatus2 = 0;
    let genBody2: any = null;
    await systemController.generateAcademicYears(mockReqGen, {
      status: (c: number) => ({
        json: (p: any) => {
          genStatus2 = c;
          genBody2 = p;
          return p;
        },
      }),
    } as any, ((err: any) => console.error(err)) as any);
    assert(genStatus2 === 200, 'Re-running generation succeeds without error');
    assert(genBody2?.data?.newlyCreatedCount === 0, 'Re-running generation creates 0 duplicates (idempotent)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST C: Active-Year Management & Single Institutional Active
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST C: Active-Year Management & Single Institutional Active ---');

    // 1. Activate an existing permitted year (2027-28)
    let actStatus = 0;
    await systemController.setActiveAcademicYear(
      { body: { year: '2027-28' }, user: { id: 'admin-1' } } as any,
      {
        status: (c: number) => ({
          json: (p: any) => {
            actStatus = c;
            return p;
          },
        }),
      } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(actStatus === 200, 'Activation of 2027-28 returns 200');

    // Verify exactly one year is current
    const currentYears = await AcademicYear.findAll({ where: { isCurrent: true } });
    assert(currentYears.length === 1, `Exactly one year isCurrent = true (count = ${currentYears.length})`);
    assert(currentYears[0].year === '2027-28', 'Active year is 2027-28');

    // Verify SystemConfiguration is synchronized
    const sysConf = await SystemConfiguration.findOne();
    assert(sysConf?.admissionCycle === '2027-28', `SystemConfiguration admissionCycle is synchronized to ${sysConf?.admissionCycle}`);

    // Verify other years statuses: 2026-27 is ARCHIVED, future years are UPCOMING
    const y2026 = await AcademicYear.findOne({ where: { year: '2026-27' } });
    assert(y2026?.status === 'ARCHIVED' && y2026.isCurrent === false, '2026-27 status updated to ARCHIVED');

    const y2028Rec = await AcademicYear.findOne({ where: { year: '2028-29' } });
    assert(y2028Rec?.status === 'UPCOMING' && y2028Rec.isCurrent === false, '2028-29 status remains UPCOMING');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST D: Centralized All-Portal Synchronization (API level)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST D: Centralized All-Portal Synchronization ---');

    // System endpoint
    let sysYearsResult: any = null;
    await systemController.getAcademicYears(
      { query: {} } as any,
      {
        status: () => ({
          json: (p: any) => { sysYearsResult = p; return p; }
        }),
      } as any,
      (() => {}) as any
    );
    assert(sysYearsResult?.data?.years?.length > 0, 'System API returns operational years list');
    assert(!sysYearsResult?.data?.years?.some((y: any) => y.year === '2025-26'), 'System API excludes 2025-26');
    assert(sysYearsResult?.data?.activeAcademicYear === '2027-28', 'System API returns activeAcademicYear = 2027-28');

    // Principal endpoint
    const principalController = await import('./controllers/principal.controller');
    let prinYearsResult: any = null;
    await principalController.getAcademicYears(
      { query: {} } as any,
      {
        json: (p: any) => { prinYearsResult = p; return p; }
      } as any,
      (() => {}) as any
    );
    assert(prinYearsResult?.data?.length > 0, 'Principal API returns operational years list');
    assert(!prinYearsResult?.data?.some((y: any) => y.year === '2025-26'), 'Principal API excludes 2025-26');

    // Dean endpoint
    const deanController = await import('./controllers/dean.controller');
    let deanYearsResult: any = null;
    await deanController.getAcademicYears(
      { query: {} } as any,
      {
        json: (p: any) => { deanYearsResult = p; return p; }
      } as any,
      (() => {}) as any
    );
    assert(deanYearsResult?.data?.length > 0, 'Dean API returns operational years list');
    assert(!deanYearsResult?.data?.some((y: any) => y.year === '2025-26'), 'Dean API excludes 2025-26');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST E: Student Data Integrity, Carry-Forward & Promotion Preservation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST E: Student Data Integrity, Carry-Forward & Promotion Preservation ---');

    // Check test student 293221f6-f1e6-4e0d-9a5a-e5960f2f514d (2JR26CV006)
    const testStudent = await Student.findByPk('293221f6-f1e6-4e0d-9a5a-e5960f2f514d');
    assert(testStudent !== null, 'Test student 293221f6-f1e6-4e0d-9a5a-e5960f2f514d exists in database');
    assert(testStudent?.semester === 4, `Test student semester is Semester 4 (got ${testStudent?.semester})`);

    // Verify student enrollments: Sem 1, 2, 3 PROMOTED, Sem 4 ACTIVE
    const enrollments = await StudentAcademicEnrollment.findAll({
      where: { studentId: testStudent?.id },
      order: [['semesterId', 'ASC']],
    });
    assert(enrollments.length === 4, `Student has exactly 4 historical enrollments (got ${enrollments.length})`);
    assert(enrollments[0].semesterId === 1 && enrollments[0].status === 'PROMOTED', 'Sem 1 enrollment status is PROMOTED');
    assert(enrollments[1].semesterId === 2 && enrollments[1].status === 'PROMOTED', 'Sem 2 enrollment status is PROMOTED');
    assert(enrollments[2].semesterId === 3 && enrollments[2].status === 'PROMOTED', 'Sem 3 enrollment status is PROMOTED');
    assert(enrollments[3].semesterId === 4 && enrollments[3].status === 'ACTIVE', 'Sem 4 enrollment status is ACTIVE');

    // Verify HOD department query returns student under Sem 4 cohort in active year 2027-28
    const hodController = await import('./controllers/hod.controller');
    const hodResult = await hodController.getHodDepartmentStudents({
      departmentId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
      semester: 4,
      branch: 'CV',
      academicYear: '2027-28',
    });

    assert(hodResult?.count >= 1, `HOD Sem 4 cohort returns students (count = ${hodResult?.count})`);
    assert(hodResult?.rows?.some((s: any) => s.id === testStudent?.id), 'Current cohort includes test student 2JR26CV006');

    // Verify HOD query for Sem 1 returns 0 (promoted student no longer in Sem 1)
    const hodSem1Result = await hodController.getHodDepartmentStudents({
      departmentId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
      semester: 1,
      branch: 'CV',
      academicYear: '2027-28',
    });

    assert(hodSem1Result?.count === 0, `HOD Sem 1 cohort returns 0 students (count = ${hodSem1Result?.count})`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST F: Security & Validation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST F: Security & Validation ---');

    // Invalid format rejected
    let invalidFormatRejected = false;
    await systemController.createAcademicYear(
      { body: { year: '2028/2029/bad' } } as any,
      { status: (c: number) => ({ json: () => { if (c === 400) invalidFormatRejected = true; } }) } as any,
      (() => {}) as any
    );
    assert(invalidFormatRejected, 'Invalid academic year format rejected (400)');

    // Pre-2026 year rejected
    let pre2026Rejected = false;
    await systemController.createAcademicYear(
      { body: { year: '2024-25' } } as any,
      { status: (c: number) => ({ json: () => { if (c === 400) pre2026Rejected = true; } }) } as any,
      (() => {}) as any
    );
    assert(pre2026Rejected, 'Creation of pre-2026 year (2024-25) rejected (400)');

    // Duplicate year rejected
    let duplicateRejected = false;
    await systemController.createAcademicYear(
      { body: { year: '2027-28' } } as any,
      { status: (c: number) => ({ json: () => { if (c === 400) duplicateRejected = true; } }) } as any,
      (() => {}) as any
    );
    assert(duplicateRejected, 'Duplicate creation of existing year (2027-28) rejected (400)');

    console.log('\n============================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal error running suite:', err);
    process.exit(1);
  }
}

runCentralizedSuite();
