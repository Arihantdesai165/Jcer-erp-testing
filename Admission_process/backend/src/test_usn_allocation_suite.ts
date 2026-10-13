import db from './config/database';
import Admission from './models/Admission';
import Student from './models/Student';
import User from './models/User';
import Department from './models/Department';
import StudentAcademicEnrollment from './models/StudentAcademicEnrollment';
import AcademicYear from './models/AcademicYear';
import * as admissionController from './controllers/admission.controller';
import * as promotionController from './controllers/promotion.controller';
import admissionService from './services/admission.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  [FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`  [PASS] ${msg}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log('JCER ERP — USN ALLOCATION ELIGIBILITY & NORMALIZATION SUITE');
  console.log('============================================================');

  let passed = 0;
  let failed = 0;

  const testWrapper = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      console.error(`  ERROR in ${name}:`, err.message);
      failed++;
    }
  };

  const appNumber = 'JCER-2027-CV-00001';

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Inspect Test Student Records in Database
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 1: Student Record Integrity', async () => {
    console.log('\n--- TEST 1: Student Record Integrity ---');
    const admission = await Admission.findOne({
      where: { applicationNumber: appNumber },
      include: [
        { model: Department, as: 'branch' },
        { model: User, as: 'user', include: [{ model: Student, as: 'student' }] }
      ]
    });

    assert(admission !== null, `Admission record for ${appNumber} exists`);
    assert(admission?.applicationStatus === 'ENROLLED', `Admission status is ENROLLED (got ${admission?.applicationStatus})`);
    assert(admission?.academicYear === '2027-28', `Admission academicYear is '2027-28'`);
    assert(admission?.branch?.code === 'CV', `Admission branch is CV`);
    assert(admission?.usn === null, `Admission USN is initially null (Pending allocation)`);

    const student = await Student.findOne({ where: { enrollmentNumber: appNumber } });
    assert(student !== null, `Student master record for ${appNumber} exists`);
    assert(student?.semester === 1, `Student current semester is 1 (got ${student?.semester})`);
    assert(student?.currentAcademicYear === '2027-28', `Student currentAcademicYear is '2027-28'`);

    const enrollment = await StudentAcademicEnrollment.findOne({
      where: { studentId: student?.id, semesterId: 1 }
    });
    assert(enrollment !== null, `Student enrollment record for semester 1 exists`);
    assert(enrollment?.status === 'ACTIVE', `Enrollment status is ACTIVE`);
    assert(enrollment?.academicYearId === '2027-28', `Enrollment academicYearId is '2027-28'`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Admin Students Listing
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 2: Admin Students Listing', async () => {
    console.log('\n--- TEST 2: Admin Students Listing ---');
    const result = await admissionService.listApplications({
      status: 'ENROLLED',
      academicYear: '2027-28',
      semester: '1',
      branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
    });

    assert(result.total >= 1, `Admin Students returned >= 1 enrolled student (got ${result.total})`);
    const found = result.applications.some((app: any) =>
      app.applicationNumber === appNumber || (app.user?.student?.enrollmentNumber === appNumber)
    );
    assert(found, `Student ${appNumber} is found in Admin Students list`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Admin Promotion Queue
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 3: Admin Promotion Queue', async () => {
    console.log('\n--- TEST 3: Admin Promotion Queue ---');
    let promoStatus = 0;
    let promoBody: any = null;
    const req: any = {
      query: {
        academicYear: '2027-28',
        semester: '1',
        departmentId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
      }
    };
    const res: any = {
      status: (code: number) => ({
        json: (data: any) => {
          promoStatus = code;
          promoBody = data;
          return data;
        }
      })
    };

    await promotionController.getPromotionStudents(req, res, ((err: any) => console.error(err)) as any);
    assert(promoStatus === 200, `getPromotionStudents returned HTTP 200`);
    assert(promoBody?.data?.total >= 1, `Promotion queue total >= 1 (got ${promoBody?.data?.total})`);
    const foundInPromo = promoBody?.data?.students?.some((s: any) =>
      s.enrollmentNumber === appNumber || s.admission?.applicationNumber === appNumber
    );
    assert(foundInPromo, `Student ${appNumber} appears in Admin Promotion Queue with status ENROLLED`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: USN Allocation Eligibility (Canonical & 4-Digit Academic Year Normalization)
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 4: USN Allocation Eligibility (Normalized Years)', async () => {
    console.log('\n--- TEST 4: USN Allocation Eligibility ---');

    // Scenario 4A: Frontend selects 4-digit format '2027-2028'
    let status4A = 0;
    let body4A: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-2028',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
          entryType: 'ALL',
          usnStatus: 'ALL',
        }
      } as any,
      {
        json: (payload: any) => {
          status4A = 200;
          body4A = payload;
          return payload;
        }
      } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(status4A === 200, `Query with 2027-2028 returned HTTP 200`);
    assert(body4A?.total === 1, `Query with 2027-2028 returned exactly 1 eligible applicant (got ${body4A?.total})`);
    assert(body4A?.applicants?.[0]?.applicationNumber === appNumber, `Applicant is ${appNumber}`);

    // Scenario 4B: Query with canonical format '2027-28'
    let status4B = 0;
    let body4B: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-28',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
          entryType: 'ALL',
          usnStatus: 'ALL',
        }
      } as any,
      {
        json: (payload: any) => {
          status4B = 200;
          body4B = payload;
          return payload;
        }
      } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(status4B === 200, `Query with 2027-28 returned HTTP 200`);
    assert(body4B?.total === 1, `Query with 2027-28 returned exactly 1 eligible applicant (got ${body4B?.total})`);
    assert(body4B?.applicants?.[0]?.applicationNumber === appNumber, `Applicant is ${appNumber}`);

    // Scenario 4C: Query with en-dash format '2027–2028'
    let body4C: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027\u20132028',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
          entryType: 'ALL',
          usnStatus: 'ALL',
        }
      } as any,
      { json: (p: any) => { body4C = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(body4C?.total === 1, `Query with Unicode en-dash 2027\u20132028 normalized and returned 1 applicant`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: USN Allocation Summary Synchronization
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 5: USN Summary KPI Synchronization', async () => {
    console.log('\n--- TEST 5: USN Summary KPI Synchronization ---');

    // Filtered by academicYear = 2027-28, branch CV, semester 1
    let summaryBody: any = null;
    await admissionController.getUsnSummary(
      {
        query: {
          academicYear: '2027-28',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
        }
      } as any,
      { json: (p: any) => { summaryBody = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(summaryBody?.success === true, `getUsnSummary succeeded`);
    assert(summaryBody?.data?.totalEligible === 1, `totalEligible matches filtered cohort = 1 (got ${summaryBody?.data?.totalEligible})`);
    assert(summaryBody?.data?.assigned === 0, `assigned matches = 0 (got ${summaryBody?.data?.assigned})`);
    assert(summaryBody?.data?.pending === 1, `pending matches = 1 (got ${summaryBody?.data?.pending})`);
    assert(summaryBody?.data?.completionRate === 0, `completionRate is 0%`);

    // Global summary without filter continues to aggregate overall system metrics
    let globalSummaryBody: any = null;
    await admissionController.getUsnSummary(
      { query: {} } as any,
      { json: (p: any) => { globalSummaryBody = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(globalSummaryBody?.data?.totalEligible >= 231, `Global summary without filter returns total across system >= 231`);
    assert(globalSummaryBody?.data?.assigned >= 11, `Global summary assigned >= 11`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Branch & Semester Isolation
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 6: Branch & Semester Filter Isolation', async () => {
    console.log('\n--- TEST 6: Branch & Semester Filter Isolation ---');

    // Query for CSE branch in 2027-28
    let cseBody: any = null;
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-28',
          branchId: cseDept?.id,
          semester: '1',
          entryType: 'ALL',
          usnStatus: 'ALL',
        }
      } as any,
      { json: (p: any) => { cseBody = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(cseBody?.total === 0, `Query for CSE branch returns 0 (CV student is isolated)`);

    // Query for Semester 3 in 2027-28
    let sem3Body: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-28',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '3',
          entryType: 'ALL',
          usnStatus: 'ALL',
        }
      } as any,
      { json: (p: any) => { sem3Body = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(sem3Body?.total === 0, `Query for Semester 3 returns 0 (Semester 1 student is isolated)`);

    // Query with usnStatus = ASSIGNED
    let assignedBody: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-28',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
          usnStatus: 'ASSIGNED',
        }
      } as any,
      { json: (p: any) => { assignedBody = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(assignedBody?.total === 0, `Query for ASSIGNED status returns 0 (unassigned student is excluded)`);

    // Query with usnStatus = PENDING
    let pendingBody: any = null;
    await admissionController.listUsnEligibleApplicants(
      {
        query: {
          academicYear: '2027-28',
          branchId: 'cb064a49-a8aa-40b8-9942-0473780624ae',
          semester: '1',
          usnStatus: 'PENDING',
        }
      } as any,
      { json: (p: any) => { pendingBody = p; return p; } } as any,
      ((err: any) => console.error(err)) as any
    );
    assert(pendingBody?.total === 1, `Query for PENDING status returns 1 applicant`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: USN Validation and Assignment Workflow
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 7: USN Validation Rules & Rejection of Invalid Patterns', async () => {
    console.log('\n--- TEST 7: USN Validation Rules ---');

    const admission = await Admission.findOne({ where: { applicationNumber: appNumber } });

    // Validate wrong year suffix rejected (e.g. 2JR26CV001 for 2027-28 applicant)
    let assignStatus = 0;
    let assignBody: any = null;
    await admissionController.assignSingleUsn(
      {
        params: { id: admission?.id },
        body: { usn: '2JR26CV001' }, // Year suffix 26 vs expected 27
        user: { id: '84840d12-c7cd-4452-b376-6611883a6d1c', role: 'ADMIN' },
        ip: '127.0.0.1',
        headers: {},
      } as any,
      {
        status: (c: number) => ({
          json: (p: any) => {
            assignStatus = c;
            assignBody = p;
            return p;
          }
        })
      } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(assignStatus === 400, `Assignment with mismatched year suffix rejected with 400 (got ${assignStatus})`);
    assert(assignBody?.error?.includes('does not match academic year'), `Clear rejection message returned: "${assignBody?.error}"`);

    // Validate wrong department code rejected (e.g. 2JR27CS001 for CV applicant)
    let deptStatus = 0;
    let deptBody: any = null;
    await admissionController.assignSingleUsn(
      {
        params: { id: admission?.id },
        body: { usn: '2JR27CS001' }, // CS dept vs applicant branch CV
        user: { id: '84840d12-c7cd-4452-b376-6611883a6d1c', role: 'ADMIN' },
        ip: '127.0.0.1',
        headers: {},
      } as any,
      {
        status: (c: number) => ({
          json: (p: any) => {
            deptStatus = c;
            deptBody = p;
            return p;
          }
        })
      } as any,
      ((err: any) => console.error(err)) as any
    );

    assert(deptStatus === 400, `Assignment with mismatched department code rejected with 400 (got ${deptStatus})`);
    assert(deptBody?.error?.includes('does not match applicant branch'), `Clear department mismatch message: "${deptBody?.error}"`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Data Preservation & Non-Destructive Progression
  // ──────────────────────────────────────────────────────────────────────────
  await testWrapper('Test 8: Semester Progression & Enrollment Preserved', async () => {
    console.log('\n--- TEST 8: Progression & Enrollment Preserved ---');

    const student = await Student.findOne({ where: { enrollmentNumber: appNumber } });
    assert(student?.semester === 1, `Student semester remains 1 (not altered by query changes)`);

    const enrollments = await StudentAcademicEnrollment.findAll({ where: { studentId: student?.id } });
    assert(enrollments.length === 1, `Student has exactly 1 enrollment record`);
    assert(enrollments[0].semesterId === 1 && enrollments[0].status === 'ACTIVE', `Enrollment is Sem 1 ACTIVE`);

    const adm = await Admission.findOne({ where: { applicationNumber: appNumber } });
    assert(adm?.applicationStatus === 'ENROLLED', `Admission applicationStatus remains ENROLLED`);
    assert(adm?.usn === null, `No accidental USN overwrite occurred`);
  });

  console.log('\n============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
}).finally(() => db.close());
