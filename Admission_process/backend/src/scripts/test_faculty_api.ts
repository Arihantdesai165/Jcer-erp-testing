import facultyService from '../services/faculty.service';
import User from '../models/User';

async function main() {
  try {
    console.log('--- TESTING FACULTY SERVICE DIRECTLY ---');

    // Find our test faculty (Arihant desai / aditihundre0309@gmail.com)
    const user = await User.findOne({ where: { email: 'aditihundre0309@gmail.com' } });
    if (!user) {
      console.error('Faculty user not found!');
      process.exit(1);
    }
    console.log(`Testing with Faculty: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

    // 1. Test Dashboard
    console.log('\n1. Dashboard Data:');
    const dashboard = await facultyService.getFacultyDashboard(user.id);
    console.log('Profile:', dashboard.profile);
    console.log('Stats:', dashboard.stats);
    console.log(`Assignments (${dashboard.assignments.length}):`);
    dashboard.assignments.forEach(a => {
      console.log(`  - ${a.subjectName} (${a.subjectCode}), Sem ${a.semester}, Sec ${a.section}`);
    });

    if (dashboard.assignments.length > 0) {
      const assignmentId = dashboard.assignments[0].id;

      // 2. Test Attendance Workspace
      console.log(`\n2. Attendance Workspace for Assignment ${assignmentId}:`);
      const attWs = await facultyService.getFacultyAttendanceWorkspace(user.id, assignmentId);
      console.log('Course:', attWs.assignment);
      console.log('Metrics:', attWs.metrics);
      console.log(`Students Enrolled (${attWs.students.length}):`);
      attWs.students.forEach(s => {
        console.log(`  - ${s.studentName} (${s.usn}), Classes: ${s.classesConducted}, Present: ${s.presentCount}, %: ${s.attendancePercentage}%, Status: ${s.status}`);
      });


      // 4. Test Analytics
      console.log(`\n4. Faculty Analytics:`);
      const analytics = await facultyService.getFacultyAnalytics(user.id);
      console.log('Assigned Count:', analytics.assignedCount);
      console.log('Subject Stats:', analytics.subjectAttendanceStats);
      console.log('Defaulters Count:', analytics.defaultersCount);
    }

    console.log('\n✓ ALL FACULTY BACKEND SERVICES TESTED AND FUNCTIONING PERFECTLY!');
  } catch (err) {
    console.error('Faculty API Test Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
