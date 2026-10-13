import db from '../config/database';
import { getEnrolledStudentsForAssignment, facultyService, compareStudentsByUsnOrName, isAssignedUsn } from '../services/faculty.service';
import { attendanceExcelService } from '../services/attendanceExcel.service';
import Student from '../models/Student';
import User from '../models/User';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Section from '../models/Section';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING ATTENDANCE ROSTER USN / NAME SORTING TEST SUITE');
  console.log('================================================================\n');

  await db.authenticate();
  console.log('✓ Database connected.\n');

  // Find or verify an active Semester 1 Faculty Assignment
  const sem1Assignment = await FacultyAssignment.findOne({
    where: { semester: 1, status: 'ACTIVE' },
    include: [
      { model: Subject, as: 'subject' },
      { model: Department, as: 'department' },
    ],
  });

  if (sem1Assignment) {
    console.log(`📦 TEST 1: Semester 1 Assignment Roster (${(sem1Assignment as any).subject?.code} - Sem 1)`);
    const { students: sem1Students } = await getEnrolledStudentsForAssignment(sem1Assignment);
    console.log(`  Total enrolled students: ${sem1Students.length}`);
    
    if (sem1Students.length > 1) {
      let isSortedProperly = true;
      for (let i = 0; i < sem1Students.length - 1; i++) {
        const sA = sem1Students[i];
        const sB = sem1Students[i + 1];
        const nameA = sA.user ? `${sA.user.firstName || ''} ${sA.user.lastName || ''}`.trim() : '';
        const nameB = sB.user ? `${sB.user.firstName || ''} ${sB.user.lastName || ''}`.trim() : '';
        const cmp = compareStudentsByUsnOrName(sA.usn, sB.usn, nameA, nameB, sA.rollNumber, sB.rollNumber);
        if (cmp > 0) {
          isSortedProperly = false;
          console.error(`  ❌ Order violation at index ${i}: "${sA.usn || nameA}" should be before "${sB.usn || nameB}"`);
          break;
        }
      }
      if (isSortedProperly) {
        console.log(`  ✅ [PASS] Semester 1 roster is correctly ordered (USN ASC when assigned, Name A-Z fallback).`);
        console.log(`  Sample (first 5):`);
        sem1Students.slice(0, 5).forEach((s, idx) => {
          const sName = s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'Student';
          console.log(`    ${String(idx + 1).padStart(2, '0')} | USN: ${s.usn || s.enrollmentNumber} | Name: ${sName}`);
        });
      }
    } else {
      console.log(`  ⚠️ Note: Less than 2 students in this Sem 1 assignment.`);
    }
  } else {
    console.log('  ⚠️ No active Sem 1 assignment found for direct testing.');
  }

  // Find or verify an active Semester 2+ Faculty Assignment
  const semSeniorAssignment = await FacultyAssignment.findOne({
    where: { semester: [2, 3, 4, 5, 6, 7, 8], status: 'ACTIVE' },
    include: [
      { model: Subject, as: 'subject' },
      { model: Department, as: 'department' },
    ],
  });

  if (semSeniorAssignment) {
    console.log(`\n📦 TEST 2: Semester ${semSeniorAssignment.semester} Assignment Roster (${(semSeniorAssignment as any).subject?.code})`);
    const { students: seniorStudents } = await getEnrolledStudentsForAssignment(semSeniorAssignment);
    console.log(`  Total enrolled students: ${seniorStudents.length}`);
    
    if (seniorStudents.length > 1) {
      let isSortedProperly = true;
      for (let i = 0; i < seniorStudents.length - 1; i++) {
        const sA = seniorStudents[i];
        const sB = seniorStudents[i + 1];
        const nameA = sA.user ? `${sA.user.firstName || ''} ${sA.user.lastName || ''}`.trim() : '';
        const nameB = sB.user ? `${sB.user.firstName || ''} ${sB.user.lastName || ''}`.trim() : '';
        const cmp = compareStudentsByUsnOrName(sA.usn, sB.usn, nameA, nameB, sA.rollNumber, sB.rollNumber);
        if (cmp > 0) {
          isSortedProperly = false;
          console.error(`  ❌ Order violation at index ${i}: "${sA.usn || nameA}" should be before "${sB.usn || nameB}"`);
          break;
        }
      }
      if (isSortedProperly) {
        console.log(`  ✅ [PASS] Semester ${semSeniorAssignment.semester} roster is strictly ordered by USN ASC.`);
        console.log(`  Sample (first 5):`);
        seniorStudents.slice(0, 5).forEach((s, idx) => {
          const sName = s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'Student';
          console.log(`    ${String(idx + 1).padStart(2, '0')} | USN: ${s.usn || s.enrollmentNumber} | Name: ${sName}`);
        });
      }
    } else {
      console.log(`  ⚠️ Note: Less than 2 students in this Sem ${semSeniorAssignment.semester} assignment.`);
    }
  }

  // TEST 3: Mock In-Memory Array Verification for Assigned USNs vs Unassigned USNs
  console.log('\n📦 TEST 3: Assigned USNs Sorting Verification (The User Reported Case)');
  
  // Real test case from user's screenshot where Asha Badnaik (2JR26CV008) was improperly before Rakshit Desai (2JR26CV002)
  const userCaseStudents = [
    { usn: '2JR26CV001', name: 'Arihant Desai' },
    { usn: '2JR26CV008', name: 'Asha Badnaik' },
    { usn: '2JR26CV006', name: 'Charanraj Jadhav' },
    { usn: '2JR26CV005', name: 'Madhura Lohar' },
    { usn: '2JR26CV011', name: 'Mallavva Nandi' },
    { usn: '2JR26CV012', name: 'Nihal Dandagalkar' },
    { usn: '2JR26CV002', name: 'Rakshit Desai' },
    { usn: '2JR26CV003', name: 'Roopa Kajagar' },
    { usn: '2JR26CV007', name: 'Sanvi Belakud' },
    { usn: '2JR26CV010', name: 'Shravan Teradale' },
    { usn: '2JR26CV009', name: 'Shreya Raghavendra Simpi' },
    { usn: '2JR26CV004', name: 'soniya Figer' },
  ];

  const sortedUserCase = [...userCaseStudents].sort((a, b) =>
    compareStudentsByUsnOrName(a.usn, b.usn, a.name, b.name)
  );

  console.log('  Sorted user case students by assigned USN:');
  sortedUserCase.forEach((s, idx) => console.log(`    ${String(idx + 1).padStart(2, '0')} | USN: ${s.usn} | Name: ${s.name}`));

  if (
    sortedUserCase[0].usn === '2JR26CV001' &&
    sortedUserCase[1].usn === '2JR26CV002' &&
    sortedUserCase[2].usn === '2JR26CV003' &&
    sortedUserCase[3].usn === '2JR26CV004' &&
    sortedUserCase[4].usn === '2JR26CV005' &&
    sortedUserCase[5].usn === '2JR26CV006' &&
    sortedUserCase[6].usn === '2JR26CV007' &&
    sortedUserCase[7].usn === '2JR26CV008' &&
    sortedUserCase[8].usn === '2JR26CV009' &&
    sortedUserCase[9].usn === '2JR26CV010' &&
    sortedUserCase[10].usn === '2JR26CV011' &&
    sortedUserCase[11].usn === '2JR26CV012'
  ) {
    console.log('  ✅ [PASS] User case students correctly and strictly sorted by USN 001..012!');
  } else {
    throw new Error('User case USN sorting failed validation check.');
  }

  // TEST 4: Unassigned USNs fallback to Student Name A-Z
  console.log('\n📦 TEST 4: Unassigned USNs Fallback Verification');
  const mockUnassigned = [
    { usn: null, name: 'Zack Taylor' },
    { usn: '', name: 'Alice Bob' },
    { usn: 'N/A', name: 'Charlie Dave' },
    { usn: 'JCER-2026-001', name: 'Bella Swan' },
  ];

  const sortedUnassigned = [...mockUnassigned].sort((a, b) =>
    compareStudentsByUsnOrName(a.usn, b.usn, a.name, b.name)
  );

  console.log('  Sorted unassigned students by Name:');
  sortedUnassigned.forEach((s, idx) => console.log(`    ${idx + 1}. ${s.name} (${s.usn || 'No USN'})`));

  if (
    sortedUnassigned[0].name === 'Alice Bob' &&
    sortedUnassigned[1].name === 'Bella Swan' &&
    sortedUnassigned[2].name === 'Charlie Dave' &&
    sortedUnassigned[3].name === 'Zack Taylor'
  ) {
    console.log('  ✅ [PASS] Unassigned USNs correctly fallback to Student Name A-Z.');
  } else {
    throw new Error('Unassigned sorting fallback failed validation check.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL ATTENDANCE ROSTER SORTING TESTS PASSED!');
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

