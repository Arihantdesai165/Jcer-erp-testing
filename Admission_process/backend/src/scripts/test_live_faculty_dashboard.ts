import facultyService from '../services/faculty.service';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';

async function testLive() {
  try {
    console.log('Testing live backend facultyService.getFacultyDashboard...');
    // Find all active faculty users with assignments
    const assignments = await FacultyAssignment.findAll({
      where: { status: 'ACTIVE' },
    });
    
    const userIds = Array.from(new Set(assignments.map(a => a.userId)));
    for (const uid of userIds) {
      const u = await User.findByPk(uid);
      if (!u) continue;
      const dash = await facultyService.getFacultyDashboard(uid);
      console.log(`\nFaculty: ${u.firstName} ${u.lastName} (${u.email})`);
      console.log(`  Assigned Subjects (distinct): ${dash.stats.totalAssignments} (assignedSubjectsCount: ${dash.stats.assignedSubjectsCount})`);
      console.log(`  Attendance Courses (distinct section allocations): ${dash.stats.attendanceCoursesCount}`);
      console.log(`  Marks Courses: ${dash.stats.marksCoursesCount}`);
      console.log(`  Assignments in table (${dash.assignments.length}):`);
      dash.assignments.forEach(a => {
        console.log(`    - [${a.subjectCode}] ${a.subjectName} | Sem ${a.semester} | ${a.section}`);
      });
    }
    console.log('\n✓ Live facultyService test completed successfully.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testLive();
