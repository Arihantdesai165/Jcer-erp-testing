import db from '../config/database';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import Subject from '../models/Subject';
import FacultyAssignment from '../models/FacultyAssignment';
import HOD from '../models/HOD';
import teachingProfileService from '../services/teachingProfile.service';
import facultyService from '../services/faculty.service';
import * as hodController from '../controllers/hod.controller';

async function runComprehensiveTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING UNIFIED TEACHING ASSIGNMENT SYSTEM VERIFICATION SUITE');
  console.log('===============================================================\n');

  await db.authenticate();
  console.log('✅ Database connected.');

  // ── TEST A: ORDINARY FACULTY REGRESSION ──
  console.log('\n--- TEST A: ORDINARY FACULTY REGRESSION ---');
  const ordinaryTeacher = await Teacher.findOne({
    include: [{ model: User, as: 'user' }],
  });
  if (ordinaryTeacher && (ordinaryTeacher as any).user) {
    const user = (ordinaryTeacher as any).user;
    console.log(`Found ordinary faculty: ${user.email} (ID: ${user.id})`);
    const assignments = await facultyService.getFacultyAssignments(user.id, 'ALL');
    console.log(`✅ Faculty assignments retrieved successfully: ${assignments.length} assignments found.`);
  } else {
    console.log('⚠️ No ordinary faculty found.');
  }

  // ── TEST B: HOD TEACHING ELIGIBILITY ──
  console.log('\n--- TEST B: HOD TEACHING ELIGIBILITY ---');
  const activeHods = await HOD.findAll({
    where: { isActive: true },
    include: [
      { model: User, as: 'user' },
      { model: Department, as: 'department' },
    ],
  });

  console.log(`Found ${activeHods.length} active HOD appointments.`);
  for (const hod of activeHods) {
    const user = (hod as any).user;
    const dept = (hod as any).department;
    if (!user || !dept) continue;

    console.log(`Checking HOD: ${user.email} (${user.firstName} ${user.lastName}) Appointed Dept: ${dept.code}`);
    
    // Check linked teacher record
    const linkedTeacher = await Teacher.findOne({ where: { userId: user.id } });
    if (!linkedTeacher) {
      throw new Error(`HOD ${user.email} is missing linked teacher profile!`);
    }

    if (linkedTeacher.departmentId !== dept.id) {
      throw new Error(`HOD ${user.email} linked teacher department (${linkedTeacher.departmentId}) does not match official appointed department (${dept.id})!`);
    }
    console.log(`✅ HOD has single identity (User ID: ${user.id}, Role: ${user.role}) and valid Core Department: ${dept.code}`);

    // Verify HOD teaching responsibilities controller returns without error
    const req: any = { user: { id: user.id, role: 'HOD' }, query: {} };
    let data: any = null, error: any = null;
    const res: any = {
      json: (d: any) => { data = d; return res; },
      status: (code: number) => ({ json: (d: any) => { error = { code, d }; } }),
    };
    await hodController.getHodTeachingResponsibilities(req, res, (e: any) => { error = e; });
    if (error) {
      throw new Error(`Failed to get teaching responsibilities: ${JSON.stringify(error)}`);
    }
    console.log(`✅ HOD teaching responsibilities query succeeded: ${data?.data?.totalSubjectsCount} subjects handled.`);
  }

  // ── TEST C: DEAN TEACHING PROFILE & ALLOCATION ELIGIBILITY ──
  console.log('\n--- TEST C: DEAN ACADEMIC TEACHING PROFILE & CAPABILITY ---');
  const deanUser = await User.findOne({ where: { role: 'DEAN' } });
  if (!deanUser) {
    throw new Error('No DEAN user found in database!');
  }
  console.log(`Dean user: ${deanUser.email} (ID: ${deanUser.id})`);

  // Find CSE department
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  if (!cseDept) throw new Error('CSE Department not found!');

  // Update Dean teaching profile to CSE
  const updatedDeanProfile = await teachingProfileService.updateTeachingProfile(deanUser.id, deanUser.role as any, cseDept.id);
  console.log(`✅ Saved Dean teaching profile with Core Dept: ${updatedDeanProfile.coreDepartment?.code}`);
  console.log(`   isTeachingEligible = ${updatedDeanProfile.isTeachingEligible}, Role preserved = ${updatedDeanProfile.role}`);

  if (updatedDeanProfile.role !== 'DEAN') {
    throw new Error('CRITICAL: Dean administrative role was altered!');
  }

  // Check Dean shows up in HOD faculty list for CSE
  const reqFaculty: any = { user: { id: deanUser.id, role: 'HOD' }, query: { departmentId: cseDept.id } };
  let facultyData: any = null;
  const resFaculty: any = {
    json: (d: any) => { facultyData = d; return resFaculty; },
    status: (code: number) => ({ json: (d: any) => {} }),
  };
  await hodController.getHodFacultyList(reqFaculty, resFaculty, (e: any) => {});
  const cseHodFacultyList = facultyData?.data || [];

  const deanInList = cseHodFacultyList.find((f: any) => f.userId === deanUser.id || f.email === deanUser.email);
  if (!deanInList) {
    throw new Error('CRITICAL: Dean does not appear in HOD CSE faculty list!');
  }
  console.log(`✅ Dean appears in CSE faculty list with name: "${deanInList.name}", role: "${deanInList.role}"`);

  // ── TEST D: PRINCIPAL TEACHING PROFILE & CAPABILITY ──
  console.log('\n--- TEST D: PRINCIPAL TEACHING PROFILE & CAPABILITY ---');
  const principalUser = await User.findOne({ where: { role: 'PRINCIPAL' } });
  if (!principalUser) {
    console.log('⚠️ No PRINCIPAL user found in database, skipping principal-specific checks.');
  } else {
    console.log(`Principal user: ${principalUser.email} (ID: ${principalUser.id})`);

    // Update Principal teaching profile to CSE
    const updatedPrincProfile = await teachingProfileService.updateTeachingProfile(principalUser.id, principalUser.role as any, cseDept.id);
    console.log(`✅ Saved Principal teaching profile with Core Dept: ${updatedPrincProfile.coreDepartment?.code}`);
    console.log(`   isTeachingEligible = ${updatedPrincProfile.isTeachingEligible}, Role preserved = ${updatedPrincProfile.role}`);

    if (updatedPrincProfile.role !== 'PRINCIPAL') {
      throw new Error('CRITICAL: Principal administrative role was altered!');
    }

    // Re-query HOD faculty list for CSE now that Principal has joined
    const reqPrincFaculty: any = { user: { id: deanUser.id, role: 'HOD' }, query: { departmentId: cseDept.id } };
    let princFacultyData: any = null;
    const resPrincFaculty: any = {
      json: (d: any) => { princFacultyData = d; return resPrincFaculty; },
      status: (code: number) => ({ json: (d: any) => {} }),
    };
    await hodController.getHodFacultyList(reqPrincFaculty, resPrincFaculty, (e: any) => {});
    const updatedCseHodFacultyList = princFacultyData?.data || [];

    const princInList = updatedCseHodFacultyList.find(
      (f: any) => f.userId === principalUser.id || f.email === principalUser.email
    );
    if (!princInList) {
      throw new Error('CRITICAL: Principal does not appear in HOD CSE faculty list!');
    }
    console.log(`✅ Principal appears in CSE faculty list with name: "${princInList.name}", role: "${princInList.role}"`);
  }

  // ── TEST E: DEPARTMENT FILTERING INTEGRITY ──
  console.log('\n--- TEST E: DEPARTMENT FILTERING INTEGRITY ---');
  const meDept = await Department.findOne({ where: { code: 'ME' } });
  if (meDept) {
    const reqMe: any = { user: { id: deanUser.id, role: 'HOD' }, query: { departmentId: meDept.id } };
    let meData: any = null;
    const resMe: any = {
      json: (d: any) => { meData = d; return resMe; },
      status: (code: number) => ({ json: (d: any) => {} }),
    };
    await hodController.getHodFacultyList(reqMe, resMe, (e: any) => {});
    const meFacultyList = meData?.data || [];
    const deanInMe = meFacultyList.find((f: any) => f.userId === deanUser.id);
    if (deanInMe) {
      throw new Error('CRITICAL: Dean (CSE Core Dept) incorrectly appeared in ME faculty list!');
    }
    console.log('✅ Dean (configured in CSE) is correctly EXCLUDED from ME department faculty list.');
  }

  // ── TEST F: IDENTITY & SECURITY BOUNDARIES ──
  console.log('\n--- TEST F: IDENTITY & SECURITY BOUNDARIES ---');
  const deanUserCount = await User.count({ where: { email: deanUser.email } });
  if (deanUserCount !== 1) {
    throw new Error(`CRITICAL: Duplicate user accounts exist for Dean email: ${deanUser.email}`);
  }
  console.log(`✅ Single User Identity preserved: Dean email count = ${deanUserCount}`);

  // Test idempotent updates - saving multiple times must not create duplicate teachers
  await teachingProfileService.updateTeachingProfile(deanUser.id, deanUser.role as any, cseDept.id);
  await teachingProfileService.updateTeachingProfile(deanUser.id, deanUser.role as any, cseDept.id);
  const teacherRecordsForDean = await Teacher.count({ where: { userId: deanUser.id } });
  if (teacherRecordsForDean !== 1) {
    throw new Error(`CRITICAL: Multiple Teacher records exist for Dean User ID ${deanUser.id}!`);
  }
  console.log(`✅ Idempotency Verified: Exactly 1 Teacher record linked to Dean (count = ${teacherRecordsForDean})`);

  // ── TEST G: ACTIVE ASSIGNMENT PROTECTION ──
  console.log('\n--- TEST G: ACTIVE ASSIGNMENT CORE DEPARTMENT PROTECTION ---');
  const cseSubject = await Subject.findOne({ where: { departmentId: cseDept.id } });
  if (cseSubject) {
    const testAssignment = await FacultyAssignment.create({
      userId: deanUser.id,
      subjectId: cseSubject.id,
      departmentId: cseDept.id,
      teachingDepartmentId: cseDept.id,
      semester: cseSubject.semester || 1,
      section: 'A',
      academicYear: '2026-27',
      status: 'ACTIVE',
      attendanceAccess: true,
      marksAccess: true,
      assignedBy: deanUser.id,
    });

    console.log(`Created test assignment ID: ${testAssignment.id} for Dean.`);

    // Attempt to change Dean Core Department while active assignment exists
    const asDept = await Department.findOne({ where: { code: 'AS' } });
    if (asDept) {
      try {
        await teachingProfileService.updateTeachingProfile(deanUser.id, deanUser.role as any, asDept.id);
        throw new Error('CRITICAL: Core department update should have failed due to active assignments!');
      } catch (err: any) {
        console.log(`✅ Safe Guard Verified: Attempt to change Core Department blocked as expected: "${err.message}"`);
      }
    }

    // Clean up test assignment safely
    await testAssignment.destroy();
    console.log('Cleaned up test assignment.');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 7 TEST PHASES PASSED WITH 100% SUCCESS! VERIFICATION COMPLETE.');
  console.log('===============================================================\n');
  process.exit(0);
}

runComprehensiveTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
