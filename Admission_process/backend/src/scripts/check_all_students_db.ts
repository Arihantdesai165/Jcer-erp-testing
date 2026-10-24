import sequelize from '../config/database';
import Student from '../models/Student';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import User from '../models/User';
import Admission from '../models/Admission';

async function checkAllStudents() {
  await sequelize.authenticate();
  const students = await Student.findAll({
    include: [
      { model: User, as: 'user' },
      { model: Department, as: 'department' },
      { model: StudentAcademicEnrollment, as: 'academicEnrollments' },
      { model: Admission, as: 'admission' },
    ]
  });

  console.log(`Total Student records in DB: ${students.length}`);
  for (const s of students as any[]) {
    console.log(`- Student ID: ${s.id}, USN: ${s.usn}, Dept: ${s.department?.code} (${s.departmentId}), User: ${s.user?.firstName} ${s.user?.lastName}, Enrollments Count: ${s.academicEnrollments?.length}`);
    if (s.academicEnrollments && s.academicEnrollments.length > 0) {
      s.academicEnrollments.forEach((e: any) => {
        console.log(`    Enrollment ID: ${e.id}, DeptID: ${e.departmentId}, Sem: ${e.semesterId}, Sec: ${e.sectionId}, AY: ${e.academicYearId}, Status: ${e.status}`);
      });
    }
  }

  process.exit(0);
}

checkAllStudents();
