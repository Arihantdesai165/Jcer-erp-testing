import sequelize from '../config/database';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';

async function run() {
  await sequelize.authenticate();
  const totalStudents = await Student.count();
  const totalEnrollments = await StudentAcademicEnrollment.count();

  console.log('Total students in DB:', totalStudents);
  console.log('Total enrollments in DB:', totalEnrollments);

  const enrollmentsByAY = await StudentAcademicEnrollment.findAll({
    attributes: ['academicYearId', 'semesterId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['academicYearId', 'semesterId'],
    raw: true,
  });
  console.log('Enrollments breakdown:', enrollmentsByAY);

  const studentsByCurrentAY = await Student.findAll({
    attributes: ['currentAcademicYear', 'semester', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['currentAcademicYear', 'semester'],
    raw: true,
  });
  console.log('Students by currentAcademicYear & semester:', studentsByCurrentAY);

  // Check how many students have no enrollment
  const allStudents = await Student.findAll({
    include: [{ model: StudentAcademicEnrollment, as: 'academicEnrollments' }],
  });
  const noEnrollment = allStudents.filter((s: any) => !s.academicEnrollments || s.academicEnrollments.length === 0);
  console.log('Students with 0 enrollments count:', noEnrollment.length);
  if (noEnrollment.length > 0) {
    console.log('Sample students with 0 enrollments:', noEnrollment.slice(0, 5).map((s: any) => ({
      id: s.id,
      semester: s.semester,
      currentAcademicYear: s.currentAcademicYear,
      departmentId: s.departmentId,
    })));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
