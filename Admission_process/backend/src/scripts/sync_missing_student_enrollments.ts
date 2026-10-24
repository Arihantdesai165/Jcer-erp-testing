import sequelize from '../config/database';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';

async function syncEnrollments() {
  await sequelize.authenticate();
  const students = await Student.findAll();
  console.log(`Checking ${students.length} students for missing enrollments...`);

  let createdCount = 0;
  for (const s of students as any[]) {
    const existing = await StudentAcademicEnrollment.findOne({ where: { studentId: s.id } });
    if (!existing) {
      await StudentAcademicEnrollment.create({
        studentId: s.id,
        academicYearId: s.currentAcademicYear || '2026-27',
        schemeId: s.scheme || '2025',
        departmentId: s.departmentId,
        semesterId: s.semester || 1,
        sectionId: s.section || null,
        rollNumber: s.rollNumber || null,
        entrySemester: s.initialSemester || 1,
        status: 'ACTIVE',
      });
      console.log(`Created StudentAcademicEnrollment for student USN: ${s.usn || s.id}`);
      createdCount++;
    }
  }

  console.log(`Synced ${createdCount} missing enrollments.`);
  process.exit(0);
}

syncEnrollments();
