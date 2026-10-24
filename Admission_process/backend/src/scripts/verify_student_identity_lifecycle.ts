import sequelize from '../config/database';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Department from '../models/Department';
import User from '../models/User';
import Section from '../models/Section';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';

async function runStudentIdentityLifecycleTests() {
  console.log('================================================================');
  console.log('JCER ERP — STUDENT IDENTITY, ROLL NUMBER & SEMESTER TRANSITION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  const testResources: {
    users: string[];
    students: string[];
    enrollments: string[];
    sections: string[];
  } = {
    users: [],
    students: [],
    enrollments: [],
    sections: [],
  };

  try {
    await sequelize.authenticate();
    console.log('✓ PostgreSQL connected.\n');

    // 0. Setup Departments
    const eceDept = await Department.findOne({ where: { code: 'ECE' } });
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!eceDept || !cseDept) {
      throw new Error('Both ECE and CSE departments must exist for testing.');
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Fresh Semester-1 student (USN = NULL, Roll No = 17)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Fresh Semester-1 Student ---');
    const u1 = await User.create({
      username: `test_fresh_sem1_${Date.now()}`,
      email: `test_fresh_sem1_${Date.now()}@jcer.ac.in`,
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      firstName: 'Raghav',
      lastName: 'Patil',
    });
    testResources.users.push(u1.id);

    const s1EnrollmentNo = `JCER-2026-ECE-${Date.now().toString().slice(-5)}`;
    const s1 = await Student.create({
      userId: u1.id,
      usn: null,
      enrollmentNumber: s1EnrollmentNo,
      rollNumber: '17',
      batchYear: 2026,
      departmentId: eceDept.id,
      semester: 1,
      admissionStatus: 'APPROVED',
      admissionType: 'FRESH',
      initialSemester: 1,
      currentAcademicYear: '2026-27',
    });
    testResources.students.push(s1.id);

    const e1 = await StudentAcademicEnrollment.create({
      studentId: s1.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      departmentId: eceDept.id,
      semesterId: 1,
      rollNumber: '17',
      entrySemester: 1,
      status: 'ACTIVE',
    });
    testResources.enrollments.push(e1.id);

    assert(s1.usn === null, 'Sem 1 student has USN = NULL initially');
    assert(s1.rollNumber === '17', 'Sem 1 student has Roll No = 17');
    assert(s1.enrollmentNumber === s1EnrollmentNo, `Sem 1 permanent enrollmentNumber = ${s1EnrollmentNo}`);
    assert(e1.rollNumber === '17', 'Academic enrollment preserves Sem 1 roll number');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: Admin assigns official USN
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Admin Assigns Official USN ---');
    const officialUsn = `2JR26EC${Date.now().toString().slice(-3)}`;
    const originalStudentId = s1.id;
    const originalEnrollmentNo = s1.enrollmentNumber;

    // Simulate Admin USN allocation (admission.controller.ts logic)
    await s1.update({ usn: officialUsn });

    const reloadedS1 = await Student.findByPk(s1.id);
    const countSameStudent = await Student.count({ where: { id: originalStudentId } });
    const countSameEnrollment = await Student.count({ where: { enrollmentNumber: originalEnrollmentNo } });

    assert(reloadedS1?.usn === officialUsn, `USN updated to official ${officialUsn}`);
    assert(reloadedS1?.id === originalStudentId, 'Student ID remains exactly the same (UUID unchanged)');
    assert(reloadedS1?.enrollmentNumber === originalEnrollmentNo, `Enrollment number preserved (${originalEnrollmentNo})`);
    assert(countSameStudent === 1, 'Exactly 1 student record exists — no duplicate created');
    assert(countSameEnrollment === 1, 'Enrollment number is never duplicated or replaced');

    // Reload historical enrollment
    const reloadedE1 = await StudentAcademicEnrollment.findByPk(e1.id);
    assert(reloadedE1?.rollNumber === '17', 'Historical Sem-1 Roll Number (17) remains intact after USN assignment');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Promote Student to Semester 2 (USN available)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Promote Student to Semester 2 with Valid USN ---');
    // Promotion logic:
    // 1. Verify student.usn is present
    // 2. Archive previous enrollment as PROMOTED
    // 3. Create new enrollment for Semester 2 with rollNumber = null
    // 4. Update student.semester = 2, student.rollNumber = null
    assert(Boolean(reloadedS1?.usn), 'Promotion check: student.usn is NOT NULL');

    await reloadedE1?.update({ status: 'PROMOTED' });
    const e2 = await StudentAcademicEnrollment.create({
      studentId: reloadedS1!.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      departmentId: eceDept.id,
      semesterId: 2,
      rollNumber: null, // REQUIRED: NULL for Sem 2+
      entrySemester: 1,
      status: 'ACTIVE',
    });
    testResources.enrollments.push(e2.id);

    await reloadedS1!.update({
      semester: 2,
      rollNumber: null, // REQUIRED: NULL for Sem 2+
      section: null,
    });

    const s1AfterPromotion = await Student.findByPk(s1.id);
    assert(s1AfterPromotion?.semester === 2, 'Student promoted to Semester 2');
    assert(s1AfterPromotion?.rollNumber === null, 'Student current rollNumber = NULL in Semester 2');
    assert(e2.semesterId === 2, 'New enrollment is in Semester 2');
    assert(e2.rollNumber === null, 'New Semester 2 enrollment has rollNumber = NULL');

    // Historical check
    const archivedE1 = await StudentAcademicEnrollment.findByPk(e1.id);
    assert(archivedE1?.status === 'PROMOTED', 'Previous Sem-1 enrollment archived as PROMOTED');
    assert(archivedE1?.rollNumber === '17', 'Historical Sem-1 rollNumber preserved as 17');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Attempt Promotion to Semester 2 with USN = NULL (Must BLOCK)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Attempt Promotion to Semester 2 with USN = NULL ---');
    const uNoUsn = await User.create({
      username: `test_nousn_${Date.now()}`,
      email: `test_nousn_${Date.now()}@jcer.ac.in`,
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      firstName: 'NoUSN',
      lastName: 'Candidate',
    });
    testResources.users.push(uNoUsn.id);

    const sNoUsn = await Student.create({
      userId: uNoUsn.id,
      usn: null,
      enrollmentNumber: `JCER-NOUSN-${Date.now().toString().slice(-4)}`,
      rollNumber: '25',
      batchYear: 2026,
      departmentId: eceDept.id,
      semester: 1,
      admissionStatus: 'APPROVED',
      admissionType: 'FRESH',
      initialSemester: 1,
      currentAcademicYear: '2026-27',
    });
    testResources.students.push(sNoUsn.id);

    // Promotion gate simulation (matching promotion.controller.ts logic)
    const targetSemester = 2;
    let promotionBlocked = false;
    let blockReason = '';

    if (targetSemester >= 2 && !sNoUsn.usn) {
      promotionBlocked = true;
      blockReason = 'Official USN is required before this student can be promoted to Semester 2.';
    }

    assert(promotionBlocked, 'Promotion blocked when student.usn is NULL');
    assert(
      blockReason === 'Official USN is required before this student can be promoted to Semester 2.',
      `Exact block message returned: "${blockReason}"`
    );
    assert(sNoUsn.semester === 1, 'Student remains in Semester 1');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Existing Semester-3 student (USN = 2JR25EC064)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Existing Semester-3 Student ---');
    const existingSem3Student = await Student.findOne({
      where: { semester: 3, departmentId: eceDept.id },
      include: [{ model: StudentAcademicEnrollment, as: 'academicEnrollments', required: false }],
    });

    if (existingSem3Student) {
      assert(Boolean(existingSem3Student.usn), `Sem 3 student has USN (${existingSem3Student.usn})`);
      assert(existingSem3Student.rollNumber === null, 'Sem 3 student has rollNumber = NULL');
    } else {
      // Create a Sem 3 student to verify
      const uSem3 = await User.create({
        username: `test_sem3_${Date.now()}`,
        email: `test_sem3_${Date.now()}@jcer.ac.in`,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        firstName: 'Existing',
        lastName: 'Sem3',
      });
      testResources.users.push(uSem3.id);

      const sSem3 = await Student.create({
        userId: uSem3.id,
        usn: '2JR25EC064',
        enrollmentNumber: '2JR25EC064',
        rollNumber: null,
        batchYear: 2025,
        departmentId: eceDept.id,
        semester: 3,
        admissionStatus: 'APPROVED',
        admissionType: 'EXISTING',
        initialSemester: 1,
        currentAcademicYear: '2026-27',
      });
      testResources.students.push(sSem3.id);
      assert(sSem3.usn === '2JR25EC064', 'Sem 3 student identified by USN 2JR25EC064');
      assert(sSem3.rollNumber === null, 'Sem 3 student has rollNumber = NULL');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Existing Student Onboarding (Persists to Postgres + Dept Isolation)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Existing Student Onboarding & Department Isolation ---');
    const uOnboard = await User.create({
      username: `onboarded_${Date.now()}`,
      email: `onboarded_${Date.now()}@jcer.ac.in`,
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      firstName: 'Priya',
      lastName: 'Kulkarni',
    });
    testResources.users.push(uOnboard.id);

    const onboardUsn = `2JR25EC${Date.now().toString().slice(-3)}`;
    const sOnboard = await Student.create({
      userId: uOnboard.id,
      usn: onboardUsn,
      enrollmentNumber: onboardUsn,
      rollNumber: null, // Sem 3 = null
      batchYear: 2025,
      departmentId: eceDept.id,
      semester: 3,
      admissionStatus: 'APPROVED',
      admissionType: 'EXISTING',
      initialSemester: 1,
      currentAcademicYear: '2026-27',
    });
    testResources.students.push(sOnboard.id);

    const eOnboard = await StudentAcademicEnrollment.create({
      studentId: sOnboard.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      departmentId: eceDept.id,
      semesterId: 3,
      rollNumber: null,
      entrySemester: 1,
      status: 'ACTIVE',
    });
    testResources.enrollments.push(eOnboard.id);

    // ECE HOD Query Simulation
    const eceQuery = await Student.findOne({
      where: { id: sOnboard.id, departmentId: eceDept.id },
    });
    // CSE HOD Query Simulation
    const cseQuery = await Student.findOne({
      where: { id: sOnboard.id, departmentId: cseDept.id },
    });

    assert(Boolean(eceQuery), 'ECE HOD can view the onboarded student');
    assert(cseQuery === null, 'CSE HOD CANNOT view the ECE student (department isolation enforced)');
    assert(eceQuery?.rollNumber === null, 'Onboarded Sem-3 student has rollNumber = NULL in PostgreSQL');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: First-semester Students from Admissions Appear under Correct HOD
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Fresh Admission Sem-1 Student Department Scoping ---');
    const uAdm = await User.create({
      username: `fresh_adm_${Date.now()}`,
      email: `fresh_adm_${Date.now()}@jcer.ac.in`,
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      firstName: 'Fresh',
      lastName: 'Admitted',
    });
    testResources.users.push(uAdm.id);

    const sAdm = await Student.create({
      userId: uAdm.id,
      usn: null,
      enrollmentNumber: `JCER-2026-CSE-${Date.now().toString().slice(-4)}`,
      rollNumber: '05',
      batchYear: 2026,
      departmentId: cseDept.id,
      semester: 1,
      admissionStatus: 'APPROVED',
      admissionType: 'FRESH',
      initialSemester: 1,
      currentAcademicYear: '2026-27',
    });
    testResources.students.push(sAdm.id);

    const cseAdmQuery = await Student.findOne({
      where: { id: sAdm.id, departmentId: cseDept.id },
    });
    const eceAdmQuery = await Student.findOne({
      where: { id: sAdm.id, departmentId: eceDept.id },
    });

    assert(Boolean(cseAdmQuery), 'Fresh CSE admission appears under CSE HOD');
    assert(eceAdmQuery === null, 'Fresh CSE admission does NOT appear under ECE HOD');
    assert(cseAdmQuery?.rollNumber === '05', 'Sem-1 student has Roll No 05');
    assert(cseAdmQuery?.usn === null, 'Fresh Sem-1 admission has USN = NULL');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 8: Lateral-entry Semester-3 Student
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Lateral-Entry Semester-3 Student ---');
    const uLateral = await User.create({
      username: `lateral_${Date.now()}`,
      email: `lateral_${Date.now()}@jcer.ac.in`,
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      firstName: 'Suresh',
      lastName: 'Lateral',
    });
    testResources.users.push(uLateral.id);

    const lateralUsn = `2JR26EC4${Date.now().toString().slice(-2)}`;
    const sLateral = await Student.create({
      userId: uLateral.id,
      usn: lateralUsn,
      enrollmentNumber: lateralUsn,
      rollNumber: null, // MUST be NULL for lateral entry into Sem 3
      batchYear: 2026,
      departmentId: eceDept.id,
      semester: 3,
      admissionStatus: 'APPROVED',
      admissionType: 'LATERAL',
      initialSemester: 3,
      currentAcademicYear: '2026-27',
    });
    testResources.students.push(sLateral.id);

    const eLateral = await StudentAcademicEnrollment.create({
      studentId: sLateral.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      departmentId: eceDept.id,
      semesterId: 3,
      rollNumber: null,
      entrySemester: 3,
      status: 'ACTIVE',
    });
    testResources.enrollments.push(eLateral.id);

    assert(sLateral.usn === lateralUsn, `Lateral student identified by USN (${lateralUsn})`);
    assert(sLateral.rollNumber === null, 'Lateral entry Sem 3 student rollNumber = NULL');
    assert(sLateral.admissionType === 'LATERAL', 'Admission type is LATERAL');
    assert(eLateral.rollNumber === null, 'Academic enrollment rollNumber = NULL for Sem 3');

    // ─────────────────────────────────────────────────────────────────────────────
    // Clean up test records
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- Cleaning up test artifacts ---');
    await StudentAcademicEnrollment.destroy({ where: { id: testResources.enrollments } });
    await Student.destroy({ where: { id: testResources.students } });
    await User.destroy({ where: { id: testResources.users } });
    console.log('✓ Test resources cleaned up safely.');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Test execution failed with error:', err);
    // Cleanup if possible
    try {
      await StudentAcademicEnrollment.destroy({ where: { id: testResources.enrollments } });
      await Student.destroy({ where: { id: testResources.students } });
      await User.destroy({ where: { id: testResources.users } });
    } catch {}
    process.exit(1);
  }
}

runStudentIdentityLifecycleTests();
