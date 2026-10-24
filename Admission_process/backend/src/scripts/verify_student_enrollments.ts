import sequelize from '../config/database';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Department from '../models/Department';

async function verifyEnrollments() {
  await sequelize.authenticate();

  const allStudents = await Student.findAll();
  console.log('Total Student Master records:', allStudents.length);

  for (const s of allStudents as any[]) {
    const enrollments = await StudentAcademicEnrollment.findAll({ where: { studentId: s.id } });
    const dept = await Department.findByPk(s.departmentId);
    console.log(`Student ${s.usn || s.id} (${s.admissionType}): Dept: ${dept?.code} (${s.departmentId}), Sem: ${s.semester}, Enrollments count: ${enrollments.length}`);
    if (enrollments.length === 0) {
      console.error(`  ⚠️ CRITICAL: Student ${s.usn || s.id} HAS NO StudentAcademicEnrollment ROW!`);
    } else {
      for (const e of enrollments as any[]) {
        console.log(`    -> Enrollment: Dept: ${e.departmentId}, Sem: ${e.semesterId}, Status: ${e.status}, AY: ${e.academicYearId}`);
        if (e.departmentId !== s.departmentId) {
          console.error(`  ⚠️ MISMATCH: Student Dept (${s.departmentId}) != Enrollment Dept (${e.departmentId})`);
        }
      }
    }
  }

  process.exit(0);
}

verifyEnrollments();
