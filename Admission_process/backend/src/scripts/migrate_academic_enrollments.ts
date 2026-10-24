import sequelize from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import bcrypt from 'bcryptjs';

export async function runMigration() {
  try {
    await sequelize.authenticate();
    console.log('[MIGRATION] Authenticated database connection.');

    // 1. Ensure table exists
    await StudentAcademicEnrollment.sync();
    console.log('[MIGRATION] Synced student_academic_enrollments table.');

    // 2. Resolve ECE Department
    let eceDept = await Department.findOne({ where: { code: 'ECE' } });
    if (!eceDept) {
      eceDept = await Department.create({ name: 'Electronics & Communication Engineering', code: 'ECE' });
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    const onboardedStudentsToRepair = [
      {
        usn: '2JR25EC064',
        name: 'RAGHAV ANAND PATIL',
        email: 'raghav.patil@jcer.ac.in',
        phone: '9876543210',
        semester: 3,
        academicYear: '2026-27',
        scheme: '2025',
      },
      {
        usn: '2JR25EC065',
        name: 'PRIYA SURESH KULKARNI',
        email: 'priya.kulkarni@jcer.ac.in',
        phone: '9876543212',
        semester: 3,
        academicYear: '2026-27',
        scheme: '2025',
      }
    ];

    for (const item of onboardedStudentsToRepair) {
      const nameParts = item.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Student';

      let user = await User.findOne({ where: { email: item.email } });
      if (!user) {
        user = await User.create({
          username: item.usn.toLowerCase(),
          email: item.email,
          passwordHash: defaultPasswordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          firstName,
          lastName,
          phone: item.phone,
          mustChangePassword: true,
        });
      }

      let student = await Student.findOne({ where: { usn: item.usn } });
      if (!student) {
        student = await Student.create({
          userId: user.id,
          usn: item.usn,
          enrollmentNumber: item.usn,
          batchYear: 2025,
          scheme: item.scheme,
          departmentId: eceDept.id,
          semester: item.semester,
          currentAcademicYear: item.academicYear,
          initialSemester: 1,
          admissionStatus: 'APPROVED',
          admissionType: 'EXISTING',
          fatherName: nameParts.slice(1).join(' ') || null,
        });
      } else {
        await student.update({
          departmentId: eceDept.id,
          semester: item.semester,
          currentAcademicYear: item.academicYear,
          admissionStatus: 'APPROVED',
          admissionType: 'EXISTING',
        });
      }

      // Create or update active academic enrollment
      let enrollment = await StudentAcademicEnrollment.findOne({
        where: { studentId: student.id, academicYearId: item.academicYear, status: 'ACTIVE' }
      });

      if (!enrollment) {
        await StudentAcademicEnrollment.create({
          studentId: student.id,
          academicYearId: item.academicYear,
          schemeId: item.scheme,
          departmentId: eceDept.id,
          semesterId: item.semester,
          entrySemester: 1,
          status: 'ACTIVE',
        });
        console.log(`[MIGRATION] Created academic enrollment for ${item.name} (${item.usn}).`);
      } else {
        await enrollment.update({
          departmentId: eceDept.id,
          semesterId: item.semester,
          schemeId: item.scheme,
          status: 'ACTIVE',
        });
        console.log(`[MIGRATION] Updated academic enrollment for ${item.name} (${item.usn}).`);
      }
    }

    // 3. Populate missing enrollments for all other existing students in Student table
    const allStudents = await Student.findAll();
    for (const st of allStudents) {
      const existingEnc = await StudentAcademicEnrollment.findOne({
        where: { studentId: st.id, status: 'ACTIVE' }
      });

      if (!existingEnc) {
        await StudentAcademicEnrollment.create({
          studentId: st.id,
          departmentId: st.departmentId,
          academicYearId: st.currentAcademicYear || '2026-27',
          schemeId: st.scheme || '2025',
          semesterId: st.semester || 1,
          sectionId: st.sectionId || null,
          rollNumber: st.rollNumber || null,
          entrySemester: st.initialSemester || 1,
          status: 'ACTIVE',
        });
        console.log(`[MIGRATION] Created missing enrollment for student ID: ${st.id}`);
      }
    }

    console.log('[MIGRATION] Data repair complete.');
  } catch (error) {
    console.error('[MIGRATION_ERROR]', error);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}
