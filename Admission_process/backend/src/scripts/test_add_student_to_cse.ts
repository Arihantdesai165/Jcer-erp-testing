import sequelize from '../config/database';
import Department from '../models/Department';
import User from '../models/User';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import { getHodDashboard } from '../controllers/hod.controller';
import bcrypt from 'bcryptjs';

async function testAddStudentToCSE() {
  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    const cse = await Department.findOne({ where: { code: 'CSE' } });
    if (!cse) {
      console.log('CSE Dept not found');
      return;
    }

    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await User.create({
      username: '2jr25cs001',
      email: 'aditya.sharma@jcer.ac.in',
      passwordHash,
      role: 'STUDENT',
      status: 'ACTIVE',
      firstName: 'ADITYA',
      lastName: 'SHARMA',
    }, { transaction: t });

    const student = await Student.create({
      userId: user.id,
      usn: '2JR25CS001',
      enrollmentNumber: '2JR25CS001',
      rollNumber: '2026CSE001',
      batchYear: 2025,
      departmentId: cse.id,
      semester: 3,
      currentAcademicYear: '2026-2027',
      admissionStatus: 'APPROVED',
      admissionType: 'EXISTING',
    }, { transaction: t });

    await StudentAcademicEnrollment.create({
      studentId: student.id,
      academicYearId: '2026-27',
      schemeId: '2025',
      departmentId: cse.id,
      semesterId: 3,
      sectionId: 'A',
      status: 'ACTIVE',
    }, { transaction: t });

    await t.commit();
    console.log('Successfully created test CSE student: 2JR25CS001');

    // Test getHodDashboard output for CSE
    const req: any = {
      departmentId: cse.id,
      department: cse,
      query: { academicYear: '2026-27', semester: 'ALL', section: 'ALL' }
    };

    let responseData: any = null;
    const res: any = {
      json: (d: any) => { responseData = d; return res; },
      status: (c: number) => res
    };

    await getHodDashboard(req, res, (err: any) => console.error(err));
    console.log('CSE HOD Dashboard totalStudents:', responseData?.data?.stats?.totalStudents);

    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error(err);
    process.exit(1);
  }
}

testAddStudentToCSE();
