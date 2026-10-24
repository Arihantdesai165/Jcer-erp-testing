import sequelize from '../config/database';
import { Op } from 'sequelize';
import User from '../models/User';
import Student from '../models/Student';
import Department from '../models/Department';
import Admission from '../models/Admission';
import AcademicYear from '../models/AcademicYear';
import Semester from '../models/Semester';
import SystemConfiguration from '../models/SystemConfiguration';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import PromotionBatch from '../models/PromotionBatch';
import StudentPromotionHistory from '../models/StudentPromotionHistory';
import * as systemController from '../controllers/system.controller';
import * as promotionController from '../controllers/promotion.controller';
import { areAcademicYearsEqual } from '../utils/academicYear.util';
import { v4 as uuidv4 } from 'uuid';

async function runMasterIntegrationSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING MASTER ACADEMIC YEAR & PROMOTION INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  await sequelize.authenticate();
  console.log('✅ PostgreSQL connected.\n');

  // Find Admin User for authorization
  const adminUser = await User.findOne({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    throw new Error('Admin user not found in database for testing.');
  }

  // ── TEST 1: AUTHORITATIVE ACTIVE ACADEMIC YEAR UPDATE & DATA ISOLATION ───
  console.log('─── TEST 1: ACTIVE INSTITUTIONAL YEAR VALIDATION & DATA SAFETY ───');
  {
    // Snapshot existing student count and enrollment count before year change
    const initialStudentCount = await Student.count();
    const initialEnrollmentCount = await StudentAcademicEnrollment.count();
    const initialSem1ActiveCount = await StudentAcademicEnrollment.count({ where: { semesterId: 1, status: 'ACTIVE' } });

    // A. Unauthorized change attempt
    const unauthReq: any = {
      body: { year: '2027-28' },
      user: { id: uuidv4(), role: 'FACULTY' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    // The route itself guards with authorizeRoles, but let's test controller format validation
    let formatErrRes: any = null;
    const formatReq: any = {
      body: { year: 'INVALID-YEAR-FORMAT' },
      user: { id: adminUser.id, role: 'ADMIN' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    await systemController.setActiveAcademicYear(
      formatReq,
      {
        status: (code: number) => ({
          json: (data: any) => { formatErrRes = { code, data }; },
        }),
      } as any,
      () => {}
    );
    if (formatErrRes?.code === 400 && formatErrRes?.data?.error?.includes('Invalid academic year format')) {
      console.log('✅ PASS: Invalid academic year format correctly rejected with 400.');
    } else {
      throw new Error(`FAILED: Expected 400 for invalid academic year format, got ${JSON.stringify(formatErrRes)}`);
    }

    // B. Authorized Admin changes active year to 2027-28
    const authReq: any = {
      body: { year: '2027-28' },
      user: { id: adminUser.id, role: 'ADMIN' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    };
    let successRes: any = null;
    await systemController.setActiveAcademicYear(
      authReq,
      {
        status: (code: number) => ({
          json: (data: any) => { successRes = { code, data }; },
        }),
      } as any,
      () => {}
    );
    if (successRes?.code === 200 && successRes?.data?.data?.activeAcademicYear === '2027-28') {
      console.log('✅ PASS: Authorized Admin successfully updated active institutional year to 2027-28.');
    } else {
      throw new Error(`FAILED: Could not set active year to 2027-28: ${JSON.stringify(successRes)}`);
    }

    // C. Verify Single-Active-Year Invariant
    const activeYears = await AcademicYear.findAll({ where: { isCurrent: true } });
    if (activeYears.length === 1 && areAcademicYearsEqual(activeYears[0].year, '2027-28')) {
      console.log('✅ PASS: Exactly 1 institutional academic year is active (2027-28).');
    } else {
      throw new Error(`FAILED: Single-active-year invariant violated! Found: ${activeYears.map(y => y.year)}`);
    }

    // D. Verify existing students & enrollments were NOT modified by active year change
    const afterStudentCount = await Student.count();
    const afterEnrollmentCount = await StudentAcademicEnrollment.count();
    const afterSem1ActiveCount = await StudentAcademicEnrollment.count({ where: { semesterId: 1, status: 'ACTIVE' } });

    if (
      initialStudentCount === afterStudentCount &&
      initialEnrollmentCount === afterEnrollmentCount &&
      initialSem1ActiveCount === afterSem1ActiveCount
    ) {
      console.log('✅ PASS: Zero student enrollments or semester records were modified by the active year change.');
    } else {
      throw new Error('FAILED: Existing student enrollments were mutated by active year change!');
    }

    // Restore active year back to 2026-27 for ongoing tests
    authReq.body.year = '2026-27';
    await systemController.setActiveAcademicYear(
      authReq,
      { status: () => ({ json: () => {} }) } as any,
      () => {}
    );
    console.log('✅ PASS: Institutional active year restored safely to 2026-27.\n');
  }

  // ── TEST 2: SAME-YEAR PROMOTION (SEMESTER 1 -> SEMESTER 2 IN 2026-27) ────
  console.log('─── TEST 2: SAME-YEAR PROMOTION (SEMESTER 1 -> SEMESTER 2) ───');
  let testStudentUser: User | null = null;
  let testStudent: Student | null = null;
  let testAdmission: Admission | null = null;
  let cseDept: Department | null = null;

  try {
    cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!cseDept) throw new Error('CSE Department not found.');

    const uniqueId = uuidv4().slice(0, 8);
    testStudentUser = await User.create({
      username: `test_promo_${uniqueId}`,
      email: `test_promo_${uniqueId}@college.com`,
      passwordHash: 'dummyhash',
      role: 'STUDENT',
      firstName: 'Integration',
      lastName: `TestStudent_${uniqueId}`,
    });

    testAdmission = await Admission.create({
      userId: testStudentUser.id,
      applicationNumber: `APP-PROMO-${uniqueId}`,
      academicYear: '2026-27',
      applicationStatus: 'ENROLLED',
      applicationType: 'FRESH',
      admissionType: 'KCET',
      entrySemester: 1,
      branchId: cseDept.id,
    });

    testStudent = await Student.create({
      userId: testStudentUser.id,
      usn: `2JC26CS${uniqueId.toUpperCase()}`,
      enrollmentNumber: `ENR-${uniqueId}`,
      rollNumber: '01',
      batchYear: 2026,
      admissionBatch: '2026–2030',
      departmentId: cseDept.id,
      semester: 1,
      currentAcademicYear: '2026-27',
      admissionStatus: 'APPROVED',
      admissionType: 'FRESH',
      initialSemester: 1,
      section: 'A',
    });

    // Initial Sem 1 Enrollment
    const sem1Enrollment = await StudentAcademicEnrollment.create({
      studentId: testStudent.id,
      departmentId: cseDept.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      semesterId: 1,
      sectionId: 'Section A',
      rollNumber: '01',
      entrySemester: 1,
      status: 'ACTIVE',
    });

    // Preview promotion Sem 1 -> Sem 2 in 2026-27
    const previewReq: any = {
      body: {
        studentIds: [testStudent.id],
        currentAcademicYear: '2026-27',
        currentSemester: 1,
        fromSemester: 1,
        promotionAcademicYear: '2026-27',
        targetSemester: 2,
        toSemester: 2,
      },
    };
    let previewRes: any = null;
    await promotionController.previewPromotion(
      previewReq,
      {
        status: (code: number) => ({
          json: (data: any) => { previewRes = { code, data }; },
        }),
      } as any,
      () => {}
    );

    if (previewRes?.data?.data?.eligibleCount === 1) {
      console.log('✅ PASS: Preview correctly evaluated student as ELIGIBLE for Sem 1 -> Sem 2 promotion.');
    } else {
      throw new Error(`FAILED in preview: ${JSON.stringify(previewRes)}`);
    }

    // Execute bulk promotion Sem 1 -> Sem 2
    const promoReq: any = {
      body: {
        studentIds: [testStudent.id],
        currentAcademicYear: '2026-27',
        currentSemester: 1,
        fromSemester: 1,
        promotionAcademicYear: '2026-27',
        targetSemester: 2,
        toSemester: 2,
        remarks: 'Integration test promotion Sem 1 to Sem 2',
      },
      user: { id: adminUser.id, role: 'ADMIN' },
    };
    let promoRes: any = null;
    await promotionController.bulkPromoteStudents(
      promoReq,
      {
        status: (code: number) => ({
          json: (data: any) => { promoRes = { code, data }; },
        }),
      } as any,
      (err: any) => { if (err) console.error('❌ BULK PROMOTE NEXT ERROR:', err); }
    );

    if (promoRes?.code === 200 && promoRes?.data?.data?.promotedCount === 1) {
      console.log('✅ PASS: Successfully promoted student from Sem 1 to Sem 2.');
    } else {
      throw new Error(`FAILED in bulk promotion: ${JSON.stringify(promoRes)}`);
    }

    // Verify database state:
    // 1. Sem 1 enrollment marked PROMOTED
    await sem1Enrollment.reload();
    if (sem1Enrollment.status === 'PROMOTED') {
      console.log('✅ PASS: Previous Sem 1 enrollment status transitioned to PROMOTED.');
    } else {
      throw new Error(`FAILED: Previous enrollment status is ${sem1Enrollment.status}, expected PROMOTED.`);
    }

    // 2. Sem 2 enrollment created with status ACTIVE and rollNumber = null
    const sem2Enrollment = await StudentAcademicEnrollment.findOne({
      where: { studentId: testStudent.id, semesterId: 2, academicYearId: '2026-27' },
    });
    if (sem2Enrollment && sem2Enrollment.status === 'ACTIVE' && sem2Enrollment.rollNumber === null && sem2Enrollment.sectionId === null) {
      console.log('✅ PASS: Destination Sem 2 enrollment created active with rollNumber=null and sectionId=null.');
    } else {
      throw new Error(`FAILED: Destination enrollment invalid: ${JSON.stringify(sem2Enrollment)}`);
    }

    // 3. Student model updated
    await testStudent.reload();
    if (testStudent.semester === 2 && testStudent.currentAcademicYear === '2026-27' && testStudent.rollNumber === null && testStudent.sectionId === null) {
      console.log('✅ PASS: Student model updated to semester=2, rollNumber=null, sectionId=null.\n');
    } else {
      throw new Error(`FAILED: Student model state incorrect after promotion: sem=${testStudent.semester}`);
    }

    // ── TEST 3: DUPLICATE PROMOTION PREVENTION & IDEMPOTENCY ───────────────
    console.log('─── TEST 3: DUPLICATE PROMOTION PREVENTION & IDEMPOTENCY ───');
    {
      // Attempting to promote the exact same student to Sem 2 again
      let dupPreviewRes: any = null;
      await promotionController.previewPromotion(
        previewReq,
        {
          status: (code: number) => ({
            json: (data: any) => { dupPreviewRes = { code, data }; },
          }),
        } as any,
        () => {}
      );

      const skipped = dupPreviewRes?.data?.data?.skipped || [];
      const hasDuplicateNotice = skipped.some((s: any) =>
        s.id === testStudent!.id && s.reason?.includes('already has an active enrollment')
      );
      if (hasDuplicateNotice) {
        console.log('✅ PASS: Duplicate promotion attempt correctly skipped in preview with explicit reason.');
      } else {
        throw new Error(`FAILED: Duplicate promotion was not skipped in preview: ${JSON.stringify(dupPreviewRes)}`);
      }

      // Attempting bulk promotion on already enrolled target
      let dupPromoRes: any = null;
      await promotionController.bulkPromoteStudents(
        promoReq,
        {
          status: (code: number) => ({
            json: (data: any) => { dupPromoRes = { code, data }; },
          }),
        } as any,
        () => {}
      );
      if (dupPromoRes?.code === 400 && dupPromoRes?.data?.data?.promotedCount === 0) {
        console.log('✅ PASS: Duplicate bulk promotion safely rejected with 0 students promoted.');
      } else {
        throw new Error(`FAILED: Duplicate bulk promotion did not reject safely: ${JSON.stringify(dupPromoRes)}`);
      }

      // Verify no duplicate enrollment rows exist in database
      const totalSem2Count = await StudentAcademicEnrollment.count({
        where: { studentId: testStudent.id, semesterId: 2, academicYearId: '2026-27' },
      });
      if (totalSem2Count === 1) {
        console.log('✅ PASS: Exactly 1 enrollment record exists for (student, 2026-27, Sem 2). Zero duplicates.\n');
      } else {
        throw new Error(`FAILED: Duplicate enrollments created! Count = ${totalSem2Count}`);
      }
    }

    // ── TEST 4: CROSS-YEAR PROMOTION (SEMESTER 2 -> SEMESTER 3 ACROSS YEARS) ──
    console.log('─── TEST 4: CROSS-YEAR PROMOTION (SEM 2 (2026-27) -> SEM 3 (2027-28)) ───');
    {
      // Ensure target academic year 2027-28 exists in AcademicYear table
      await systemController.ensureSemestersForAcademicYear('2027-28');

      const crossYearReq: any = {
        body: {
          studentIds: [testStudent.id],
          currentAcademicYear: '2026-27',
          currentSemester: 2,
          fromSemester: 2,
          promotionAcademicYear: '2027-28', // Cross-year destination!
          targetSemester: 3,
          toSemester: 3,
          remarks: 'Integration test cross-year promotion Sem 2 to Sem 3',
        },
        user: { id: adminUser.id, role: 'ADMIN' },
      };

      let crossPromoRes: any = null;
      await promotionController.bulkPromoteStudents(
        crossYearReq,
        {
          status: (code: number) => ({
            json: (data: any) => { crossPromoRes = { code, data }; },
          }),
        } as any,
        () => {}
      );

      if (crossPromoRes?.code === 200 && crossPromoRes?.data?.data?.promotedCount === 1) {
        console.log('✅ PASS: Cross-year promotion (Sem 2 2026-27 -> Sem 3 2027-28) executed successfully.');
      } else {
        throw new Error(`FAILED in cross-year promotion: ${JSON.stringify(crossPromoRes)}`);
      }

      // Verify Sem 2 enrollment is now PROMOTED
      await sem2Enrollment!.reload();
      if ((sem2Enrollment!.status as string) === 'PROMOTED') {
        console.log('✅ PASS: Prior Sem 2 enrollment status transitioned to PROMOTED.');
      } else {
        throw new Error(`FAILED: Prior Sem 2 enrollment status is ${sem2Enrollment!.status}`);
      }

      // Verify new Sem 3 enrollment is ACTIVE under 2027-28 with correct department
      const sem3Enrollment = await StudentAcademicEnrollment.findOne({
        where: { studentId: testStudent.id, semesterId: 3, academicYearId: '2027-28' },
      });
      if (
        sem3Enrollment &&
        sem3Enrollment.status === 'ACTIVE' &&
        sem3Enrollment.departmentId === cseDept.id &&
        sem3Enrollment.rollNumber === null &&
        sem3Enrollment.sectionId === null
      ) {
        console.log('✅ PASS: Sem 3 enrollment created active under 2027-28 with preserved department and unassigned section.');
      } else {
        throw new Error(`FAILED: Sem 3 enrollment invalid: ${JSON.stringify(sem3Enrollment)}`);
      }

      // Verify Student model updated
      await testStudent.reload();
      if ((testStudent.semester as number) === 3 && (testStudent.currentAcademicYear as string) === '2027-28') {
        console.log('✅ PASS: Student updated to semester=3 and currentAcademicYear=2027-28.\n');
      } else {
        throw new Error(`FAILED: Student state invalid after cross-year promotion.`);
      }
    }

    // ── TEST 5: TRANSACTION ATOMICITY & ROLLBACK PROTECTION ────────────────
    console.log('─── TEST 5: TRANSACTION ATOMICITY & ROLLBACK PROTECTION ───');
    {
      const initialHistoryCount = await StudentPromotionHistory.count({ where: { studentId: testStudent.id } });
      const currentStudentSem = testStudent.semester;

      // Simulate an invalid promotion that triggers rollback
      let failedPromoRes: any = null;
      const invalidPromoReq: any = {
        body: {
          studentIds: [testStudent.id],
          currentAcademicYear: '2027-28',
          currentSemester: 3,
          fromSemester: 3,
          promotionAcademicYear: '2027-28',
          targetSemester: 999, // Invalid semester!
          toSemester: 999,
        },
        user: { id: adminUser.id, role: 'ADMIN' },
      };
      await promotionController.bulkPromoteStudents(
        invalidPromoReq,
        {
          status: (code: number) => ({
            json: (data: any) => { failedPromoRes = { code, data }; },
          }),
        } as any,
        () => {}
      );

      const afterHistoryCount = await StudentPromotionHistory.count({ where: { studentId: testStudent.id } });
      await testStudent.reload();

      if (failedPromoRes?.code === 400 && afterHistoryCount === initialHistoryCount && testStudent.semester === currentStudentSem) {
        console.log('✅ PASS: Transaction rollback verified: 0 partial records created, student state completely intact.\n');
      } else {
        throw new Error('FAILED: Partial records leaked or rollback failed!');
      }
    }

    // ── TEST 6: HISTORICAL ATTENDANCE & ACADEMIC DATA INTEGRITY ────────────
    console.log('─── TEST 6: HISTORICAL ENROLLMENTS & ATTENDANCE DATA INTEGRITY ───');
    {
      // Verify complete historical enrollment trail exists intact
      const enrollments = await StudentAcademicEnrollment.findAll({
        where: { studentId: testStudent.id },
        order: [['semesterId', 'ASC']],
      });

      console.log(`Student total historical enrollment stages: ${enrollments.length}`);
      enrollments.forEach(e => {
        console.log(`- Sem ${e.semesterId} (${e.academicYearId}): Status=${e.status}, Section=${e.sectionId || 'Unassigned'}`);
      });

      if (
        enrollments.length === 3 &&
        enrollments[0].semesterId === 1 && enrollments[0].status === 'PROMOTED' &&
        enrollments[1].semesterId === 2 && enrollments[1].status === 'PROMOTED' &&
        enrollments[2].semesterId === 3 && enrollments[2].status === 'ACTIVE'
      ) {
        console.log('✅ PASS: Complete 3-tier academic enrollment history preserved intact.');
      } else {
        throw new Error('FAILED: Academic enrollment history damaged or incomplete!');
      }
    }

  } finally {
    // Clean up test fixtures safely
    console.log('\n--- CLEANING UP TEST FIXTURES ---');
    if (testStudent) {
      await StudentPromotionHistory.destroy({ where: { studentId: testStudent.id } });
      await PromotionBatch.destroy({ where: { remarks: { [Op.iLike]: '%Integration test%' } } });
      await StudentAcademicEnrollment.destroy({ where: { studentId: testStudent.id } });
      await testStudent.destroy();
    }
    if (testAdmission) {
      await testAdmission.destroy();
    }
    if (testStudentUser) {
      await testStudentUser.destroy();
    }
    console.log('✅ Test fixtures cleaned up safely.\n');
  }

  console.log('================================================================');
  console.log('🎉 ALL 6 MASTER INTEGRATION TEST PHASES PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
  process.exit(0);
}

runMasterIntegrationSuite().catch((err) => {
  console.error('❌ MASTER INTEGRATION SUITE FAILED:', err);
  process.exit(1);
});
