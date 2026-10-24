import sequelize from '../config/database';
import Department from '../models/Department';
import Subject from '../models/Subject';
import FacultyAssignment from '../models/FacultyAssignment';
import User from '../models/User';
import { Op } from 'sequelize';

async function testBothApis() {
  try {
    await sequelize.authenticate();
    const asDept = await Department.findOne({ where: { code: 'AS' } });
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });

    console.log('AS Dept ID:', asDept?.id);
    console.log('CSE Dept ID:', cseDept?.id);

    // Call 1: getHodSubjects as AS HOD
    // req.departmentId = asDept.id
    // req.query = { semester: 1, status: 'ACTIVE' }
    const subWhere: any = { departmentId: asDept?.id, status: 'ACTIVE', semester: 1 };
    const asSubjects = await Subject.findAll({
      where: subWhere,
      order: [['semester', 'ASC'], ['code', 'ASC']]
    });

    console.log(`\n=== 1. getHodSubjects for AS HOD returned ${asSubjects.length} subjects ===`);
    for (const s of asSubjects) {
      console.log(`ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Cycle: ${s.cycle} | Sem: ${s.semester} | DeptId: ${s.departmentId}`);
    }

    // Call 1b: getHodSubjects as CSE HOD
    const cseSubjects = await Subject.findAll({
      where: { departmentId: cseDept?.id, status: 'ACTIVE', semester: 1 },
      order: [['semester', 'ASC'], ['code', 'ASC']]
    });
    console.log(`\n=== 1b. getHodSubjects for CSE HOD returned ${cseSubjects.length} subjects ===`);
    for (const s of cseSubjects) {
      console.log(`ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Cycle: ${s.cycle} | Sem: ${s.semester} | DeptId: ${s.departmentId}`);
    }

    // Call 2: getHodFacultyAssignments as AS HOD with branch=CSE, academicYear='2026-27', semester=1
    const assignWhere: any = {};
    const branchDept = await Department.findOne({ where: { code: { [Op.iLike]: 'CSE' } } });
    assignWhere.departmentId = branchDept?.id;
    assignWhere.semester = 1;
    const ayStr = '2026-27';
    const variations = [
      ayStr,
      ayStr.replace(/(\d{4})-(\d{2})$/, (_, y1, y2) => `${y1}-20${y2}`),
      ayStr.replace(/(\d{4})-20(\d{2})$/, '$1-$2'),
      ayStr.replace(/–/g, '-'),
      ayStr.replace(/-/g, '–'),
    ];
    assignWhere.academicYear = { [Op.in]: Array.from(new Set(variations)) };

    const assignments = await FacultyAssignment.findAll({
      where: assignWhere,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] },
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits', 'cycle'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ]
    });

    console.log(`\n=== 2. getHodFacultyAssignments (branch=CSE, sem=1, AY=2026-27) returned ${assignments.length} assignments ===`);
    for (const a of assignments as any[]) {
      console.log(`ID: ${a.id} | SubjectId: ${a.subjectId} | Code: ${a.subject?.code} | Name: ${a.subject?.name} | Sec: ${a.section} | Faculty: ${a.user?.firstName} ${a.user?.lastName} | AY: ${a.academicYear} | Branch: ${a.department?.code} | Status: ${a.status}`);
    }

    // Check intersection: which of asSubjects or cseSubjects are in assignments?
    console.log('\n=== MATCHING FOR AS SUBJECTS ===');
    for (const s of asSubjects) {
      const matched = assignments.filter((a: any) => a.subjectId === s.id);
      console.log(`AS Subject ${s.code} (${s.name}) [${s.id}] -> ${matched.length} assignments`);
    }

    console.log('\n=== MATCHING FOR CSE SUBJECTS ===');
    for (const s of cseSubjects) {
      const matched = assignments.filter((a: any) => a.subjectId === s.id);
      console.log(`CSE Subject ${s.code} (${s.name}) [${s.id}] -> ${matched.length} assignments`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

testBothApis();
