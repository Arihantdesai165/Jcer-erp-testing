import sequelize from '../config/database';
import Student from '../models/Student';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function verifyFix() {
  try {
    await sequelize.authenticate();
    console.log('[VERIFICATION] Database connected successfully.');

    // 1. Resolve ECE Department
    const eceDept = await Department.findOne({ where: { code: 'ECE' } });
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });

    if (!eceDept || !cseDept) {
      console.error('[VERIFICATION_FAIL] ECE or CSE department missing in DB.');
      process.exit(1);
    }

    console.log(`[VERIFICATION] ECE Dept ID: ${eceDept.id}, CSE Dept ID: ${cseDept.id}`);

    // 2. Query StudentAcademicEnrollment for the 2 ECE students
    const eceEnrollments = await StudentAcademicEnrollment.findAll({
      where: { departmentId: eceDept.id, semesterId: 3, status: 'ACTIVE' },
      include: [{ model: Student, as: 'student' }],
    });

    console.log(`[VERIFICATION] Active Semester 3 ECE enrollments count: ${eceEnrollments.length}`);

    for (const enc of eceEnrollments) {
      console.log(` - Student: ${(enc as any).student?.usn}, Dept: ${enc.departmentId}, AY: ${enc.academicYearId}, Sem: ${enc.semesterId}, Scheme: ${enc.schemeId}, Status: ${enc.status}`);
    }

    // 3. Test getHodDepartmentStudents helper for ECE HOD
    const eceResult = await getHodDepartmentStudents({
      departmentId: eceDept.id,
      semesterId: 3,
      academicYearId: '2026-27',
    });

    console.log(`[VERIFICATION] getHodDepartmentStudents for ECE HOD returned ${eceResult.count} students.`);

    // 4. Test getHodDepartmentStudents helper for CSE HOD
    const cseResult = await getHodDepartmentStudents({
      departmentId: cseDept.id,
      semesterId: 3,
      academicYearId: '2026-27',
    });

    console.log(`[VERIFICATION] getHodDepartmentStudents for CSE HOD returned ${cseResult.count} ECE students (Expect 0 ECE students under CSE).`);

    if (eceResult.count >= 2 && cseResult.rows.every((s: any) => s.departmentId !== eceDept.id)) {
      console.log('[VERIFICATION_SUCCESS] Architecture fix verified completely!');
    } else {
      console.error('[VERIFICATION_FAIL] Counts or department isolation mismatch.');
    }
  } catch (err) {
    console.error('[VERIFICATION_ERROR]', err);
  } finally {
    process.exit(0);
  }
}

verifyFix();
