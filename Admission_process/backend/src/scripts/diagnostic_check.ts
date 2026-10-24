import sequelize from '../config/database';
import Teacher from '../models/Teacher';
import User from '../models/User';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import AcademicYear from '../models/AcademicYear';
import HOD from '../models/HOD';
import HodSubjectHandlingRequest from '../models/HodSubjectHandlingRequest';
import { Op } from 'sequelize';

async function runDiagnostics() {
  try {
    await sequelize.authenticate();
    console.log('=== DATABASE CONNECTION: OK ===');

    const academicYears = await AcademicYear.findAll();
    console.log('\nAcademic Years:', academicYears.map(y => ({ id: y.id, year: y.year, isCurrent: y.isCurrent, status: y.status })));

    const departments = await Department.findAll();
    console.log('\nDepartments count:', departments.length);
    for (const d of departments) {
      console.log(`- Dept [${d.id}] ${d.code} (${d.name}) type=${(d as any).type}`);
    }

    const hods = await HOD.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] }],
    });
    console.log('\nHODs count:', hods.length);
    for (const h of hods) {
      console.log(`- HOD [${h.id}] deptId=${h.departmentId} active=${h.isActive} user=${(h as any).user?.email}`);
    }

    const teachers = await Teacher.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'status'] },
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
      ],
    });
    console.log('\nTeachers count:', teachers.length);
    for (const t of teachers) {
      console.log(`- Teacher [${t.id}] userId=${t.userId} deptId=${t.departmentId} status=${t.status} userEmail=${(t as any).user?.email} dept=${(t as any).department?.code}`);
    }

    // Check Faculty Assignments
    const assignments = await FacultyAssignment.findAll();
    console.log('\nFaculty Assignments count:', assignments.length);

    // Check HOD Subject Handling Requests
    const hodReqs = await HodSubjectHandlingRequest.findAll();
    console.log('\nHOD Subject Handling Requests count:', hodReqs.length);

    // Test exact getFacultyList logic
    const search: string | undefined = undefined;
    const departmentId: string | undefined = 'ALL';
    const status: string | undefined = 'ALL';

    const whereUser: any = {};
    if (search) {
      whereUser[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (status && status !== 'ALL' && status !== 'ARCHIVED') {
      whereUser.status = status;
    }

    const whereTeacher: any = {
      ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
    };

    if (status === 'ARCHIVED') {
      whereTeacher.status = 'ARCHIVED';
    } else {
      whereTeacher.status = { [Op.ne]: 'ARCHIVED' };
    }

    console.log('\nTesting Teacher.findAll with whereTeacher:', JSON.stringify(whereTeacher), 'whereUser:', JSON.stringify(whereUser));
    const queriedTeachers = await Teacher.findAll({
      where: whereTeacher,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status', 'createdAt'],
          where: whereUser,
          required: false,
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    console.log('Queried teachers result count:', queriedTeachers.length);

  } catch (err: any) {
    console.error('Diagnostics FAILED with error:', err);
  } finally {
    await sequelize.close();
  }
}

runDiagnostics();
