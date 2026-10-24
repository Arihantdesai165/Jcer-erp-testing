import db from '../config/database';
import Student from '../models/Student';
import Department from '../models/Department';
import AttendanceRecord from '../models/AttendanceRecord';

async function main() {
  try {
    await db.authenticate();
    const studentsSem3 = await Student.findAll({
      where: { semester: 3 },
      limit: 10,
      attributes: ['id', 'usn', 'enrollmentNumber', 'rollNumber', 'semester', 'section']
    });
    console.log(`\n=== SEMESTER 3 STUDENTS (Sample of ${studentsSem3.length}) ===`);
    studentsSem3.forEach(s => {
      console.log(`Student ID: ${s.id}, USN: ${s.usn}, Enroll: ${s.enrollmentNumber}, Roll: ${s.rollNumber}, Sem: ${s.semester}, Sec: ${s.section}`);
    });

    const totalStudentsSem3 = await Student.count({ where: { semester: 3 } });
    console.log(`Total Sem 3 Students: ${totalStudentsSem3}`);

    const attendanceRecords = await AttendanceRecord.findAll({ limit: 5 });
    console.log(`\n=== ATTENDANCE RECORDS COUNT ===`, await AttendanceRecord.count());
    attendanceRecords.forEach(a => {
      console.log(`Attendance: Student ${a.studentId}, Sub ${a.subjectId}, Date: ${a.date}, Status: ${a.status}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
