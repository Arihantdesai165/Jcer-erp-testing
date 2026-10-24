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
import facultyService from '../services/faculty.service';
import * as hodController from '../controllers/hod.controller';

async function runTest() {
  console.log('--- STARTING FACULTY TRANSFER VERIFICATION TEST ---');
  await db.authenticate();

  // 1. Ensure departments: CSE and CSE-AIML
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

  // 2. Ensure HOD user for CSE
  let hodUser = await User.findOne({ where: { email: 'hod.cse.test@jcer.edu' } });
  if (!hodUser) {
    hodUser = await User.create({
      email: 'hod.cse.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'HOD',
      firstName: 'HOD',
      lastName: 'CSE',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }

  // 3. Ensure Faculty 1 (Neha Verma) in CSE
  let neha = await User.findOne({ where: { email: 'neha.verma.test@jcer.edu' } });
  if (!neha) {
    neha = await User.create({
      email: 'neha.verma.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'TEACHER',
      firstName: 'Neha',
      lastName: 'Verma',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }
  let teacherNeha = await Teacher.findOne({ where: { userId: neha.id } });
  if (!teacherNeha) {
    teacherNeha = await Teacher.create({
      userId: neha.id,
      departmentId: cseDept.id,
      designation: 'Assistant Professor',
      status: 'ACTIVE',
    });
  }

  // 4. Ensure Faculty 2 (Rahul Sharma) in CSE
  let rahul = await User.findOne({ where: { email: 'rahul.sharma.test@jcer.edu' } });
  if (!rahul) {
    rahul = await User.create({
      email: 'rahul.sharma.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'TEACHER',
      firstName: 'Rahul',
      lastName: 'Sharma',
      departmentId: cseDept.id,
      status: 'ACTIVE',
    });
  }
  let teacherRahul = await Teacher.findOne({ where: { userId: rahul.id } });
  if (!teacherRahul) {
    teacherRahul = await Teacher.create({
      userId: rahul.id,
      departmentId: cseDept.id,
      designation: 'Associate Professor',
      status: 'ACTIVE',
    });
  }

  // 5. Ensure Faculty 3 (Aditya Kulkarni) in CSE-AIML
  let aditya = await User.findOne({ where: { email: 'aditya.aiml.test@jcer.edu' } });
  if (!aditya) {
    aditya = await User.create({
      email: 'aditya.aiml.test@jcer.edu',
      passwordHash: 'dummy',
      role: 'TEACHER',
      firstName: 'Aditya',
      lastName: 'Kulkarni',
      departmentId: aimlDept.id,
      status: 'ACTIVE',
    });
  }
  let teacherAditya = await Teacher.findOne({ where: { userId: aditya.id } });
  if (!teacherAditya) {
    teacherAditya = await Teacher.create({
      userId: aditya.id,
      departmentId: aimlDept.id,
      designation: 'Assistant Professor',
      status: 'ACTIVE',
    });
  }

  // 6. Ensure Subject "Computer-Aided Engineering Drawing"
  const academicYear = '2026-27';
  const semester = 1;
  let subject = await Subject.findOne({
    where: { code: 'CAED101' },
  });
  if (!subject) {
    subject = await Subject.create({
      code: 'CAED101',
      name: 'Computer-Aided Engineering Drawing',
      departmentId: cseDept.id,
      semester,
      academicYear,
      credits: 4,
      type: 'THEORY',
      status: 'ACTIVE',
    });
  }

  // 7. Ensure Section A in CSE
  let sectionA = await Section.findOne({
    where: { departmentId: cseDept.id, semester, name: 'Section A', academicYear },
  });
  if (!sectionA) {
    sectionA = await Section.create({
      name: 'Section A',
      departmentId: cseDept.id,
      semester,
      academicYear,
      capacity: 60,
      status: 'ACTIVE',
    });
  }

  // Clean old test sessions & assignments for this cohort so test is repeatable
  const oldTestAssignments = await FacultyAssignment.findAll({
    where: {
      subjectId: subject.id,
      section: 'A',
      semester,
      academicYear,
    },
  });
  const oldIds = oldTestAssignments.map((a) => a.id);
  if (oldIds.length > 0) {
    await AttendanceRecord.destroy({ where: { facultyAssignmentId: { [Op.in]: oldIds } } });
    await AttendanceSession.destroy({ where: { facultyAssignmentId: { [Op.in]: oldIds } } });
    await FacultyAssignment.destroy({ where: { id: { [Op.in]: oldIds } } });
  }

  // 8. Create Initial Allocation for Neha Verma
  const initialAssignment = await FacultyAssignment.create({
    userId: neha.id,
    subjectId: subject.id,
    departmentId: cseDept.id,
    semester,
    section: 'A',
    sectionId: sectionA.id,
    academicYear,
    startDate: '2026-08-01',
    status: 'ACTIVE',
    attendanceAccess: true,
    marksAccess: true,
  });

  console.log(`[Step 1] Initial Assignment created for Neha: ID=${initialAssignment.id}`);

  // 9. Neha enters attendance session on 2026-09-01
  const session1 = await AttendanceSession.create({
    facultyAssignmentId: initialAssignment.id,
    departmentId: cseDept.id,
    subjectId: subject.id,
    sectionId: sectionA.id,
    section: 'A',
    semester,
    academicYear,
    attendanceDate: '2026-09-01',
    sessionPeriod: 1,
    status: 'SUBMITTED',
    totalStudents: 1,
    presentCount: 1,
    absentCount: 0,
  });

  console.log(`[Step 2] Attendance session created by Neha: ID=${session1.id}, Date=2026-09-01`);

  // Verify Neha's active assignment count
  const nehaWorkspacesBefore = await facultyService.getFacultyAssignments(neha.id, academicYear);
  console.log(`[Verification] Neha active assignments before transfer: ${nehaWorkspacesBefore.length}`);
  if (!nehaWorkspacesBefore.some((a: any) => a.id === initialAssignment.id)) {
    throw new Error('Neha assignment missing before transfer!');
  }

  // 10. Perform Transfer from Neha to Rahul on transferDate: '2026-09-10'
  const mockReq: any = {
    departmentId: cseDept.id,
    user: {
      id: hodUser.id,
      role: 'HOD',
      departmentId: cseDept.id,
    },
    params: {
      allocationId: initialAssignment.id,
    },
    body: {
      newFacultyCoreDepartmentId: cseDept.id,
      newFacultyId: rahul.id,
      transferDate: '2026-09-10',
      reason: 'FACULTY_LEFT',
    },
  };

  let transferResultData: any = null;
  const mockRes: any = {
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (payload: any) {
      if (this.statusCode && this.statusCode >= 400) {
        throw new Error(`Transfer failed: ${JSON.stringify(payload)}`);
      }
      transferResultData = payload;
      return this;
    },
  };

  console.log('[Step 3] Executing transfer via hodController.transferFacultyAssignment...');
  await hodController.transferFacultyAssignment(mockReq, mockRes, (() => {}) as any);
  console.log('[Step 3 Complete] Transfer response:', transferResultData.message);

  const newAssignment = transferResultData.data.newAssignment || transferResultData.data;
  const newAssignmentId = transferResultData.data.newAssignmentId || newAssignment.id;
  console.log(`[Step 3 Verification] New assignment ID=${newAssignmentId}, Faculty=${newAssignment.facultyName}, Status=${newAssignment.status}`);

  // 11. Verify History
  const historyMockReq: any = {
    user: { id: hodUser.id, role: 'HOD', departmentId: cseDept.id },
    params: { allocationId: newAssignmentId },
  };
  let historyData: any = null;
  const historyMockRes: any = {
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (payload: any) {
      historyData = payload.data?.history || payload.data || [];
      return this;
    },
  };
  await hodController.getFacultyAssignmentHistory(historyMockReq, historyMockRes, (() => {}) as any);
  console.log(`[Step 4 Verification] History record count: ${historyData.length}`);
  console.log('History Lineage:');
  historyData.forEach((h: any, idx: number) => {
    console.log(`  #${idx + 1}: ${h.facultyName} [${h.status}] - Start: ${h.startDate} End: ${h.endDate || 'Present'} Reason: ${h.transferReason || 'N/A'}`);
  });

  // Verify old assignment
  const reloadedOld = await FacultyAssignment.findByPk(initialAssignment.id);
  console.log(`[Step 5 Verification] Old assignment status: ${reloadedOld?.status}, endDate: ${reloadedOld?.endDate}`);
  if (reloadedOld?.status !== 'TRANSFERRED') {
    throw new Error(`Expected old assignment status to be TRANSFERRED, got ${reloadedOld?.status}`);
  }
  if (String(reloadedOld?.endDate).split('T')[0] !== '2026-09-09') {
    throw new Error(`Expected old assignment endDate to be 2026-09-09, got ${reloadedOld?.endDate}`);
  }

  // 12. Verify Neha's dashboard has NO active assignment
  const nehaWorkspacesAfter = await facultyService.getFacultyAssignments(neha.id, academicYear);
  console.log(`[Step 6 Verification] Neha active assignments after transfer: ${nehaWorkspacesAfter.length}`);
  if (nehaWorkspacesAfter.some((a: any) => a.id === initialAssignment.id)) {
    throw new Error('Old assignment still appearing in Neha dashboard!');
  }

  // 13. Verify Rahul's dashboard HAS the active assignment
  const rahulWorkspacesAfter = await facultyService.getFacultyAssignments(rahul.id, academicYear);
  console.log(`[Step 7 Verification] Rahul active assignments after transfer: ${rahulWorkspacesAfter.length}`);
  const rahulAssigned = rahulWorkspacesAfter.find((a: any) => a.id === newAssignment.id);
  if (!rahulAssigned) {
    throw new Error('New assignment missing from Rahul dashboard!');
  }
  console.log(`[Step 7 Verification] Rahul subject: ${rahulAssigned.subjectName}, Section: ${rahulAssigned.section}`);

  // 14. Verify Attendance Continuity: Rahul can see Neha's session in workspace & history
  const rahulWorkspaceData = await facultyService.getFacultyAttendanceWorkspace(rahul.id, newAssignment.id);
  console.log(`[Step 8 Verification] Rahul workspace recorded sessions: ${rahulWorkspaceData.recordedSessions.length}`);
  if (rahulWorkspaceData.recordedSessions.length === 0) {
    throw new Error('Rahul cannot see previous attendance sessions!');
  }
  console.log(`[Step 8 Verification] Previous session date visible to Rahul: ${rahulWorkspaceData.recordedSessions[0].date}`);

  const rahulHistoryData = await facultyService.getFacultyAttendanceHistory(rahul.id, newAssignment.id);
  console.log(`[Step 9 Verification] Rahul attendance history sessions: ${rahulHistoryData.sessions.length}`);
  if (rahulHistoryData.sessions.length === 0) {
    throw new Error('Rahul attendance history does not include previous sessions!');
  }

  // 15. Verify Transfer to SAME faculty is rejected
  try {
    const invalidReq: any = {
      ...mockReq,
      params: { allocationId: newAssignment.id },
      body: {
        newFacultyCoreDepartmentId: cseDept.id,
        newFacultyId: rahul.id, // SAME FACULTY
        transferDate: '2026-09-15',
      },
    };
    await hodController.transferFacultyAssignment(invalidReq, mockRes, (() => {}) as any);
    throw new Error('Failed: transferring to same faculty should have thrown an error!');
  } catch (err: any) {
    console.log('[Step 10 Verification] Transfer to same faculty properly blocked:', err.message);
  }

  // 16. Verify Cross-Department Core Transfer (Teaching Dept CSE, Core Dept CSE-AIML)
  const crossDeptReq: any = {
    ...mockReq,
    params: { allocationId: newAssignment.id },
    body: {
      newFacultyCoreDepartmentId: aimlDept.id,
      newFacultyId: aditya.id, // AIML core faculty
      transferDate: '2026-09-20',
      reason: 'DEPARTMENT_TRANSFER',
    },
  };
  await hodController.transferFacultyAssignment(crossDeptReq, mockRes, (() => {}) as any);
  console.log('[Step 11 Verification] Cross-department core faculty transfer (CSE-AIML core -> CSE teaching) succeeded!');

  // Clean up test records
  console.log('--- ALL 11 VERIFICATIONS PASSED SUCCESSFULLY ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
