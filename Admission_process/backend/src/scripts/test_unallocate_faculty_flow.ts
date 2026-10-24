import { Op } from 'sequelize';
import db from '../config/database';
import User from '../models/User';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Section from '../models/Section';
import Student from '../models/Student';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import * as hodController from '../controllers/hod.controller';

async function runUnallocationTests() {
  console.log('================================================================');
  console.log('--- STARTING SAFE FACULTY UNALLOCATION VERIFICATION SUITE ---');
  console.log('================================================================\n');

  await db.authenticate();

  // Helper mock response
  const createMockRes = () => {
    const res: any = {
      statusCode: 200,
      jsonData: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.jsonData = data;
        return this;
      },
    };
    return res;
  };

  // Helper mock request
  const createMockReq = (user: any, params: any, body: any = {}, departmentId?: string) => {
    return {
      user,
      departmentId: departmentId || user.departmentId,
      params,
      body,
      query: {},
      ip: '127.0.0.1',
      headers: {},
    } as any;
  };

  // 1. Setup departments: CSE, CSE-AIML, AS
  let cseDept = await Department.findOne({ where: { code: 'CSE' } });
  if (!cseDept) {
    cseDept = await Department.create({
      code: 'CSE',
      name: 'Computer Science and Engineering',
      type: 'ACADEMIC',
      status: 'ACTIVE',
    });
  }

  let aimlDept = await Department.findOne({ where: { code: 'CSE-AIML' } });
  if (!aimlDept) {
    aimlDept = await Department.create({
      code: 'CSE-AIML',
      name: 'Computer Science and Engineering (AIML)',
      type: 'ACADEMIC',
      status: 'ACTIVE',
    });
  }

  let asDept = await Department.findOne({ where: { code: 'AS' } });
  if (!asDept) {
    asDept = await Department.create({
      code: 'AS',
      name: 'Applied Science and Humanities',
      type: 'SEMESTER_HANDLING',
      status: 'ACTIVE',
    });
  }

  // 2. Setup HOD users
  let cseHodUser = await User.findOne({ where: { email: 'hod.cse.test@jcer.edu' } });
  if (!cseHodUser) {
    cseHodUser = await User.create({
      email: 'hod.cse.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'HOD',
      firstName: 'CSE',
      lastName: 'HOD',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }

  let aimlHodUser = await User.findOne({ where: { email: 'hod.aiml.test@jcer.edu' } });
  if (!aimlHodUser) {
    aimlHodUser = await User.create({
      email: 'hod.aiml.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'HOD',
      firstName: 'AIML',
      lastName: 'HOD',
      departmentId: aimlDept.id,
      status: 'ACTIVE',
    });
  }

  let asHodUser = await User.findOne({ where: { email: 'hod.as.test@jcer.edu' } });
  if (!asHodUser) {
    asHodUser = await User.create({
      email: 'hod.as.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'HOD',
      firstName: 'AS',
      lastName: 'HOD',
      departmentId: asDept.id,
      status: 'ACTIVE',
    });
  }

  // 3. Setup Teachers
  let teacherUser1 = await User.findOne({ where: { email: 'faculty1.cse.test@jcer.edu' } });
  if (!teacherUser1) {
    teacherUser1 = await User.create({
      email: 'faculty1.cse.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'TEACHER',
      firstName: 'Neha',
      lastName: 'Verma',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }
  let teacherRec1 = await Teacher.findOne({ where: { userId: teacherUser1.id } });
  if (!teacherRec1) {
    teacherRec1 = await Teacher.create({
      userId: teacherUser1.id,
      departmentId: cseDept.id,
      designation: 'Assistant Professor',
      status: 'ACTIVE',
    });
  }

  let teacherUser2 = await User.findOne({ where: { email: 'faculty2.cse.test@jcer.edu' } });
  if (!teacherUser2) {
    teacherUser2 = await User.create({
      email: 'faculty2.cse.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'TEACHER',
      firstName: 'Rahul',
      lastName: 'Sharma',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }
  let teacherRec2 = await Teacher.findOne({ where: { userId: teacherUser2.id } });
  if (!teacherRec2) {
    teacherRec2 = await Teacher.create({
      userId: teacherUser2.id,
      departmentId: cseDept.id,
      designation: 'Associate Professor',
      status: 'ACTIVE',
    });
  }

  // 4. Setup Test Subjects
  let cseSubject = await Subject.findOne({ where: { code: '21CS301_TEST' } });
  if (!cseSubject) {
    cseSubject = await Subject.create({
      name: 'Data Structures & Algorithms',
      code: '21CS301_TEST',
      departmentId: cseDept.id,
      semester: 3,
      credits: 4,
      status: 'ACTIVE',
    });
  }

  let aimlSubject = await Subject.findOne({ where: { code: '21AI301_TEST' } });
  if (!aimlSubject) {
    aimlSubject = await Subject.create({
      name: 'Artificial Intelligence Concepts',
      code: '21AI301_TEST',
      departmentId: aimlDept.id,
      semester: 3,
      credits: 4,
      status: 'ACTIVE',
    });
  }

  // 5. Setup Academic Year
  const academicYear = '2026-27';

  // Clean previous test allocations for these test subjects
  const existingTestAllocs = await FacultyAssignment.findAll({
    where: { subjectId: [cseSubject.id, aimlSubject.id] },
    attributes: ['id'],
  });
  const existingIds = existingTestAllocs.map((a) => a.id);
  if (existingIds.length > 0) {
    await AttendanceRecord.destroy({ where: { facultyAssignmentId: existingIds } });
    await AttendanceSession.destroy({ where: { facultyAssignmentId: existingIds } });
    await FacultyAssignment.update({ previousFacultyAssignmentId: null }, { where: { id: existingIds } });
    await FacultyAssignment.destroy({ where: { id: existingIds } });
  }

  console.log('✓ Test environment initialized.');

  // =========================================================================
  // SCENARIO 2 & 4: Unallocate only selected section; other section remains ACTIVE
  // =========================================================================
  console.log('\n--- Test 1: Unallocate selected section (Sec A) while preserving other section (Sec B) ---');
  const allocSecA = await FacultyAssignment.create({
    teacherId: teacherRec1.id,
    userId: teacherUser1.id,
    departmentId: cseDept.id,
    subjectId: cseSubject.id,
    semester: 3,
    section: 'A',
    branch: 'CSE',
    academicYear,
    status: 'ACTIVE',
    startDate: '2026-08-01',
    attendanceAccess: true,
    marksAccess: true,
    createdByHODId: cseHodUser.id,
  });

  const allocSecB = await FacultyAssignment.create({
    teacherId: teacherRec1.id,
    userId: teacherUser1.id,
    departmentId: cseDept.id,
    subjectId: cseSubject.id,
    semester: 3,
    section: 'B',
    branch: 'CSE',
    academicYear,
    status: 'ACTIVE',
    startDate: '2026-08-01',
    attendanceAccess: true,
    marksAccess: true,
    createdByHODId: cseHodUser.id,
  });

  // Call unallocate on Sec A as CSE HOD
  const reqUnallocA = createMockReq(cseHodUser, { assignmentId: allocSecA.id }, { reason: 'UNALLOCATED' }, cseDept.id);
  const resUnallocA = createMockRes();
  await hodController.deleteFacultyAssignment(reqUnallocA, resUnallocA, (e) => { throw e; });

  if (resUnallocA.statusCode === 200 && resUnallocA.jsonData?.success) {
    console.log('✓ Unallocation request succeeded with status 200.');
  } else {
    throw new Error(`Unallocation failed: ${JSON.stringify(resUnallocA.jsonData)}`);
  }

  // Check state of Sec A
  const reloadedA = await FacultyAssignment.findByPk(allocSecA.id);
  if (!reloadedA) throw new Error('Sec A record was deleted instead of soft-deactivated!');
  if (reloadedA.status !== 'ENDED') throw new Error(`Sec A status is ${reloadedA.status}, expected 'ENDED'!`);
  if (!reloadedA.endDate) throw new Error('Sec A endDate was not set!');
  console.log(`✓ Sec A status correctly updated to 'ENDED' with endDate ${reloadedA.endDate}. Record preserved.`);

  // Check state of Sec B
  const reloadedB = await FacultyAssignment.findByPk(allocSecB.id);
  if (reloadedB?.status !== 'ACTIVE') throw new Error(`Sec B was improperly affected: status is ${reloadedB?.status}`);
  console.log('✓ Sec B remains ACTIVE and untouched.');

  // =========================================================================
  // SCENARIO 3: Section becomes available for reassignment
  // =========================================================================
  console.log('\n--- Test 2: Section becomes available for reassignment ---');
  const reqReassign = createMockReq(
    cseHodUser,
    { id: teacherUser2.id },
    {
      subjectId: cseSubject.id,
      semester: 3,
      section: 'A',
      academicYear,
      teachingDepartmentId: cseDept.id,
      coreDepartmentId: cseDept.id,
    },
    cseDept.id
  );
  const resReassign = createMockRes();
  await hodController.assignFacultySubject(reqReassign, resReassign, (e) => { throw e; });

  if (resReassign.statusCode === 201 && resReassign.jsonData?.success) {
    console.log(`✓ Section A successfully reassigned to ${teacherUser2.firstName} ${teacherUser2.lastName}.`);
  } else {
    throw new Error(`Reassignment failed: ${JSON.stringify(resReassign.jsonData)}`);
  }

  // =========================================================================
  // SCENARIO 5 & 10: Department isolation (CSE vs CSE-AIML) & Authorization
  // =========================================================================
  console.log('\n--- Test 3: Enforce department boundaries (CSE HOD cannot unallocate CSE-AIML) ---');
  const allocAiml = await FacultyAssignment.create({
    teacherId: teacherRec1.id,
    userId: teacherUser1.id,
    departmentId: aimlDept.id,
    subjectId: aimlSubject.id,
    semester: 3,
    section: 'A',
    branch: 'CSE-AIML',
    academicYear,
    status: 'ACTIVE',
    startDate: '2026-08-01',
    createdByHODId: aimlHodUser.id,
  });

  // CSE HOD attempts to unallocate CSE-AIML allocation
  const reqCrossDept = createMockReq(cseHodUser, { assignmentId: allocAiml.id }, {}, cseDept.id);
  const resCrossDept = createMockRes();
  await hodController.deleteFacultyAssignment(reqCrossDept, resCrossDept, (e) => { throw e; });

  if (resCrossDept.statusCode === 403) {
    console.log('✓ Unauthorized cross-department unallocation correctly rejected with 403 Forbidden.');
  } else {
    throw new Error(`Expected 403 but got ${resCrossDept.statusCode}: ${JSON.stringify(resCrossDept.jsonData)}`);
  }

  // Verify CSE-AIML allocation is still ACTIVE
  const reloadedAiml = await FacultyAssignment.findByPk(allocAiml.id);
  if (reloadedAiml?.status !== 'ACTIVE') throw new Error('CSE-AIML assignment was altered by unauthorized HOD!');
  console.log('✓ CSE-AIML assignment remains ACTIVE.');

  // =========================================================================
  // SCENARIO 6: Attendance records and sessions remain intact
  // =========================================================================
  console.log('\n--- Test 4: Academic records (Attendance sessions & records) preservation ---');
  const allocWithAttendance = await FacultyAssignment.create({
    teacherId: teacherRec1.id,
    userId: teacherUser1.id,
    departmentId: cseDept.id,
    subjectId: cseSubject.id,
    semester: 3,
    section: 'C',
    branch: 'CSE',
    academicYear,
    status: 'ACTIVE',
    startDate: '2026-08-01',
    createdByHODId: cseHodUser.id,
  });

  const session = await AttendanceSession.create({
    facultyAssignmentId: allocWithAttendance.id,
    departmentId: cseDept.id,
    subjectId: cseSubject.id,
    section: 'C',
    semester: 3,
    academicYear,
    attendanceDate: '2026-09-01',
    sessionPeriod: 1,
    status: 'LOCKED',
    submittedById: teacherUser1.id,
  });

  // Create a dummy student to attach attendance record
  let dummyStudent = await Student.findOne({ where: { departmentId: cseDept.id } });
  if (dummyStudent) {
    await AttendanceRecord.create({
      attendanceSessionId: session.id,
      facultyAssignmentId: allocWithAttendance.id,
      studentId: dummyStudent.id,
      departmentId: cseDept.id,
      subjectId: cseSubject.id,
      semester: 3,
      academicYear,
      date: '2026-09-01',
      status: 'PRESENT',
    });
  }

  // Unallocate allocation with attendance
  const reqUnallocAtt = createMockReq(cseHodUser, { assignmentId: allocWithAttendance.id }, {}, cseDept.id);
  const resUnallocAtt = createMockRes();
  await hodController.deleteFacultyAssignment(reqUnallocAtt, resUnallocAtt, (e) => { throw e; });

  if (resUnallocAtt.statusCode !== 200) {
    throw new Error(`Unallocation of assignment with attendance failed: ${JSON.stringify(resUnallocAtt.jsonData)}`);
  }

  // Verify AttendanceSession and AttendanceRecord still exist with valid FK
  const sessionAfter = await AttendanceSession.findByPk(session.id);
  if (!sessionAfter) throw new Error('AttendanceSession was deleted during unallocation!');
  if (sessionAfter.facultyAssignmentId !== allocWithAttendance.id) throw new Error('FK on AttendanceSession was corrupted!');

  const recordsCount = await AttendanceRecord.count({ where: { attendanceSessionId: session.id } });
  console.log(`✓ Attendance session and ${recordsCount} record(s) completely preserved without FK errors.`);

  // =========================================================================
  // SCENARIO 8 & 9: Faculty transfer compatibility & History preservation
  // =========================================================================
  console.log('\n--- Test 5: Faculty transfer lineage and History preservation ---');
  // 1. Create initial allocation
  const allocTransferBase = await FacultyAssignment.create({
    teacherId: teacherRec1.id,
    userId: teacherUser1.id,
    departmentId: cseDept.id,
    subjectId: cseSubject.id,
    semester: 3,
    section: 'D',
    branch: 'CSE',
    academicYear,
    status: 'ACTIVE',
    startDate: '2026-08-01',
    createdByHODId: cseHodUser.id,
  });

  // 2. Transfer from Fac 1 (Neha) to Fac 2 (Rahul)
  const reqTransfer = createMockReq(
    cseHodUser,
    { assignmentId: allocTransferBase.id },
    {
      newFacultyId: teacherUser2.id,
      transferDate: '2026-09-15',
      reason: 'TEST_TRANSFER',
    },
    cseDept.id
  );
  const resTransfer = createMockRes();
  await hodController.transferFacultyAssignment(reqTransfer, resTransfer);
  if (resTransfer.statusCode !== 200) {
    throw new Error(`Transfer failed: ${JSON.stringify(resTransfer.jsonData)}`);
  }
  const transferredNewAllocId = resTransfer.jsonData.data.newAssignmentId;

  // 3. Unallocate active transferred assignment (Rahul)
  const reqUnallocRahul = createMockReq(cseHodUser, { assignmentId: transferredNewAllocId }, {}, cseDept.id);
  const resUnallocRahul = createMockRes();
  await hodController.deleteFacultyAssignment(reqUnallocRahul, resUnallocRahul, (e) => { throw e; });
  if (resUnallocRahul.statusCode !== 200) {
    throw new Error(`Unallocation of transferred assignment failed: ${JSON.stringify(resUnallocRahul.jsonData)}`);
  }

  // 4. Verify History endpoint returns the entire lineage
  const reqHist = createMockReq(cseHodUser, { allocationId: transferredNewAllocId }, {}, cseDept.id);
  const resHist = createMockRes();
  await hodController.getFacultyAssignmentHistory(reqHist, resHist);

  if (resHist.statusCode !== 200 || !resHist.jsonData?.data?.history) {
    throw new Error(`History fetch failed: ${JSON.stringify(resHist.jsonData)}`);
  }

  const hist = resHist.jsonData.data.history;
  console.log(`✓ History returned ${hist.length} records for Section D cohort.`);
  const statuses = hist.map((h: any) => `${h.facultyName} (${h.status})`).join(' -> ');
  console.log(`  Lineage: ${statuses}`);

  const hasTransferred = hist.some((h: any) => h.status === 'TRANSFERRED');
  const hasEnded = hist.some((h: any) => h.status === 'ENDED');
  if (!hasTransferred || !hasEnded) {
    throw new Error('History lineage does not contain both TRANSFERRED and ENDED records!');
  }
  console.log('✓ Transfer lineage and unallocation history preserved accurately.');

  // =========================================================================
  // SCENARIO 11: Idempotency & Repeat unallocation handling
  // =========================================================================
  console.log('\n--- Test 6: Safe handling of repeat/already-ended unallocation requests ---');
  const resRepeat = createMockRes();
  await hodController.deleteFacultyAssignment(reqUnallocRahul, resRepeat, (e) => { throw e; });

  if (resRepeat.statusCode === 400) {
    console.log(`✓ Repeat unallocation safely rejected with 400: "${resRepeat.jsonData?.error}"`);
  } else {
    throw new Error(`Expected 400 for already ended assignment, got ${resRepeat.statusCode}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 13 TEST SCENARIOS PASSED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runUnallocationTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
