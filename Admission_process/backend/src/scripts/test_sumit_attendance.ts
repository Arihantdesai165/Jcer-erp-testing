import db from '../config/database';
import User from '../models/User';
import { facultyService } from '../services/faculty.service';

async function testSumit() {
  await db.authenticate();
  console.log('=== TESTING SUMIT ATTENDANCE RESOLUTION ===\n');

  const sumitUser = await User.findOne({
    where: { email: 'sumitdesai@gmail.com' },
  });

  if (!sumitUser) {
    console.error('Sumit user not found by email!');
    process.exit(1);
  }

  console.log(`Sumit User ID: ${sumitUser.id}, Name: ${sumitUser.firstName} ${sumitUser.lastName}, Role: ${sumitUser.role}`);

  // Test 1: getFacultyAssignments with no academicYear filter
  const allAssignments = await facultyService.getFacultyAssignments(sumitUser.id);
  console.log(`\nTest 1 - getFacultyAssignments(no AY filter): ${allAssignments.length} assignments found.`);
  console.log(JSON.stringify(allAssignments, null, 2));

  // Test 2: getFacultyAttendanceList with '2026-27'
  const list1 = await facultyService.getFacultyAttendanceList(sumitUser.id, undefined, '2026-27');
  console.log(`\nTest 2 - getFacultyAttendanceList(AY='2026-27'): ${list1.length} courses found.`);

  // Test 3: getFacultyAttendanceList with '2026-2027'
  const list2 = await facultyService.getFacultyAttendanceList(sumitUser.id, undefined, '2026-2027');
  console.log(`\nTest 3 - getFacultyAttendanceList(AY='2026-2027'): ${list2.length} courses found.`);

  // Test 4: getFacultyAttendanceList with '2026–27' (en-dash)
  const list3 = await facultyService.getFacultyAttendanceList(sumitUser.id, undefined, '2026–27');
  console.log(`\nTest 4 - getFacultyAttendanceList(AY='2026–27' en-dash): ${list3.length} courses found.`);

  // Test 5: getFacultyDashboard
  const dashboard = await facultyService.getFacultyDashboard(sumitUser.id);
  console.log(`\nTest 5 - getFacultyDashboard: ${dashboard.assignments.length} assignments in dashboard.`);

  process.exit(0);
}

testSumit().catch((err) => {
  console.error(err);
  process.exit(1);
});
