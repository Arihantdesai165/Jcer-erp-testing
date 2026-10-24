/**
 * Test script to verify the 5 scenarios specified in the requirements:
 * 1. One subject assigned to two sections -> Assigned Subjects: 1, Attendance Courses: 2
 * 2. One subject assigned to three sections -> Assigned Subjects: 1, Attendance Courses: 3
 * 3. Two subjects assigned to two sections each -> Assigned Subjects: 2, Attendance Courses: 4
 * 4. Three different subjects, one section each -> Assigned Subjects: 3, Attendance Courses: 3
 * 5. Duplicate API records for the same allocation -> Count once per unique allocation
 */

interface AllocationItem {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  section: string;
  normalizedSection?: string;
  academicYear: string;
  departmentId: string;
  attendanceAccess: boolean;
  marksAccess: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

function calculateMetrics(assignments: AllocationItem[]) {
  // 1. Assigned Subjects: Count distinct subjects using stable subjectId
  const distinctSubjectIds = new Set<string>();
  assignments.forEach((a) => {
    if (a.status === 'ACTIVE') {
      const sid = a.subjectId || a.subjectCode;
      if (sid) distinctSubjectIds.add(String(sid));
    }
  });
  const assignedSubjects = distinctSubjectIds.size;

  // 2. Attendance Courses: Count distinct active section-level allocations with attendance access
  const uniqueAttendanceAllocations = new Set<string>();
  assignments.forEach((a) => {
    if (a.status === 'ACTIVE' && a.attendanceAccess) {
      const normSec = a.normalizedSection || (a.section ? String(a.section).trim().toUpperCase() : '');
      const allocKey = `${a.subjectId || a.subjectCode}_${normSec}_${a.semester}_${a.academicYear}_${a.departmentId}`;
      uniqueAttendanceAllocations.add(allocKey);
    }
  });
  const attendanceCourses = uniqueAttendanceAllocations.size;

  return { assignedSubjects, attendanceCourses };
}

function runTests() {
  console.log('=== VERIFYING DASHBOARD METRIC COUNTING SCENARIOS ===\n');

  // Scenario 1: One subject assigned to two sections
  const scenario1: AllocationItem[] = [
    {
      id: 'alloc-1',
      subjectId: 'sub-ced-103',
      subjectCode: '1BCEDS103',
      subjectName: 'Computer-Aided Engineering Drawing',
      semester: 1,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
    {
      id: 'alloc-2',
      subjectId: 'sub-ced-103',
      subjectCode: '1BCEDS103',
      subjectName: 'Computer-Aided Engineering Drawing',
      semester: 1,
      section: 'Section B',
      normalizedSection: 'B',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
  ];
  const res1 = calculateMetrics(scenario1);
  console.log('Scenario 1: One subject assigned to two sections');
  console.log(`  Assigned Subjects: ${res1.assignedSubjects} (Expected: 1)`);
  console.log(`  Attendance Courses: ${res1.attendanceCourses} (Expected: 2)`);
  if (res1.assignedSubjects !== 1 || res1.attendanceCourses !== 2) throw new Error('Scenario 1 failed!');
  console.log('  ✓ PASSED\n');

  // Scenario 2: One subject assigned to three sections
  const scenario2: AllocationItem[] = [
    ...scenario1,
    {
      id: 'alloc-3',
      subjectId: 'sub-ced-103',
      subjectCode: '1BCEDS103',
      subjectName: 'Computer-Aided Engineering Drawing',
      semester: 1,
      section: 'Section C',
      normalizedSection: 'C',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
  ];
  const res2 = calculateMetrics(scenario2);
  console.log('Scenario 2: One subject assigned to three sections');
  console.log(`  Assigned Subjects: ${res2.assignedSubjects} (Expected: 1)`);
  console.log(`  Attendance Courses: ${res2.attendanceCourses} (Expected: 3)`);
  if (res2.assignedSubjects !== 1 || res2.attendanceCourses !== 3) throw new Error('Scenario 2 failed!');
  console.log('  ✓ PASSED\n');

  // Scenario 3: Two subjects assigned to two sections each
  const scenario3: AllocationItem[] = [
    ...scenario1, // sub-ced-103 in A and B
    {
      id: 'alloc-4',
      subjectId: 'sub-dsa-201',
      subjectCode: '21CS301',
      subjectName: 'Data Structures & Algorithms',
      semester: 3,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
    {
      id: 'alloc-5',
      subjectId: 'sub-dsa-201',
      subjectCode: '21CS301',
      subjectName: 'Data Structures & Algorithms',
      semester: 3,
      section: 'Section B',
      normalizedSection: 'B',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
  ];
  const res3 = calculateMetrics(scenario3);
  console.log('Scenario 3: Two subjects assigned to two sections each');
  console.log(`  Assigned Subjects: ${res3.assignedSubjects} (Expected: 2)`);
  console.log(`  Attendance Courses: ${res3.attendanceCourses} (Expected: 4)`);
  if (res3.assignedSubjects !== 2 || res3.attendanceCourses !== 4) throw new Error('Scenario 3 failed!');
  console.log('  ✓ PASSED\n');

  // Scenario 4: Three different subjects, one section each
  const scenario4: AllocationItem[] = [
    {
      id: 'alloc-s1',
      subjectId: 'sub-1',
      subjectCode: 'CODE1',
      subjectName: 'Subject 1',
      semester: 1,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
    {
      id: 'alloc-s2',
      subjectId: 'sub-2',
      subjectCode: 'CODE2',
      subjectName: 'Subject 2',
      semester: 3,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
    {
      id: 'alloc-s3',
      subjectId: 'sub-3',
      subjectCode: 'CODE3',
      subjectName: 'Subject 3',
      semester: 5,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
  ];
  const res4 = calculateMetrics(scenario4);
  console.log('Scenario 4: Three different subjects, one section each');
  console.log(`  Assigned Subjects: ${res4.assignedSubjects} (Expected: 3)`);
  console.log(`  Attendance Courses: ${res4.attendanceCourses} (Expected: 3)`);
  if (res4.assignedSubjects !== 3 || res4.attendanceCourses !== 3) throw new Error('Scenario 4 failed!');
  console.log('  ✓ PASSED\n');

  // Scenario 5: Duplicate API records for the same allocation
  const scenario5: AllocationItem[] = [
    ...scenario1, // sub-ced-103 in A and B
    // Duplicate of Section A allocation (e.g. legacy duplicate row in DB or API payload)
    {
      id: 'alloc-1-duplicate',
      subjectId: 'sub-ced-103',
      subjectCode: '1BCEDS103',
      subjectName: 'Computer-Aided Engineering Drawing',
      semester: 1,
      section: 'Section A',
      normalizedSection: 'A',
      academicYear: '2026-27',
      departmentId: 'dept-cse',
      attendanceAccess: true,
      marksAccess: true,
      status: 'ACTIVE',
    },
  ];
  const res5 = calculateMetrics(scenario5);
  console.log('Scenario 5: Duplicate API records for the same allocation');
  console.log(`  Assigned Subjects: ${res5.assignedSubjects} (Expected: 1)`);
  console.log(`  Attendance Courses: ${res5.attendanceCourses} (Expected: 2)`);
  if (res5.assignedSubjects !== 1 || res5.attendanceCourses !== 2) throw new Error('Scenario 5 failed!');
  console.log('  ✓ PASSED\n');

  console.log('ALL 5 SCENARIOS VERIFIED SUCCESSFULLY!');
}

runTests();
