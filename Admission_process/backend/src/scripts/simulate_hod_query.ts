import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import User from '../models/User';
import { Op } from 'sequelize';

async function testHodQuery() {
  try {
    await sequelize.authenticate();

    // HOD AS Department ID
    const asDept = await Department.findOne({ where: { code: 'AS' } });
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    console.log('AS Dept ID:', asDept?.id);
    console.log('CSE Dept ID:', cseDept?.id);

    // Query params passed by HOD page:
    // semester: 1, academicYear: '2026-27', branch: 'CSE'
    const semester: any = 1;
    const academicYear: any = '2026-27';
    const branch: any = 'CSE';
    const isAppliedScience = true;

    const whereClause: any = {};

    // From hod.controller.ts lines 3246-3294:
    if (isAppliedScience) {
      const targetBranch = branch?.trim();
      if (targetBranch && targetBranch !== 'ALL') {
        const branchDept = await Department.findOne({
          where: { code: { [Op.iLike]: targetBranch } },
        });
        if (branchDept) {
          whereClause.departmentId = branchDept.id;
        }
      }
    }

    if (semester && semester !== 'ALL') {
      whereClause.semester = Number(semester);
    }

    if (academicYear && academicYear !== 'ALL') {
      const ayStr = String(academicYear).trim();
      const variations = [
        ayStr,
        ayStr.replace(/(\d{4})-(\d{2})$/, (_, y1, y2) => `${y1}-20${y2}`),
        ayStr.replace(/(\d{4})-20(\d{2})$/, '$1-$2'),
        ayStr.replace(/–/g, '-'),
        ayStr.replace(/-/g, '–'),
      ];
      whereClause.academicYear = { [Op.in]: Array.from(new Set(variations)) };
    }

    console.log('WHERE CLAUSE for FacultyAssignment.findAll:', whereClause);

    const assignments = await FacultyAssignment.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits', 'cycle', 'schemeId', 'type'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
    });

    console.log(`\nQUERY FOUND ${assignments.length} ASSIGNMENTS:`);
    const mapped = assignments.map((a: any) => ({
      id: a.id,
      facultyUserId: a.userId,
      facultyName: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim() || 'Faculty',
      subjectId: a.subjectId,
      subjectName: a.subject?.name,
      subjectCode: a.subject?.code,
      subjectCycle: a.subject?.cycle,
      semester: a.semester,
      section: a.section,
      branch: a.department?.code || (a.departmentId === asDept?.id ? asDept?.code : undefined),
      departmentId: a.departmentId,
      academicYear: a.academicYear,
      status: a.status,
    }));

    for (const item of mapped) {
      console.log(item);
    }

    // Now let's simulate frontend subjectAssignmentsMap in HodFacultyAssignmentsPage.tsx:
    console.log('\n--- SIMULATING FRONTEND subjectAssignmentsMap ---');
    const selectedBranch = 'CSE';
    const map: Record<string, any[]> = {};
    mapped.forEach((a) => {
      if (a.status === 'ACTIVE' || !a.status) {
        if (isAppliedScience && selectedBranch && a.branch && a.branch.toUpperCase() !== selectedBranch.toUpperCase()) {
          console.log(`FILTERED OUT by branch mismatch! a.branch: ${a.branch}, selectedBranch: ${selectedBranch}`);
          return;
        }
        if (!map[a.subjectId]) map[a.subjectId] = [];
        map[a.subjectId].push(a);
      }
    });

    console.log('FRONTEND subjectAssignmentsMap keys:', Object.keys(map));
    for (const [subId, allocs] of Object.entries(map)) {
      console.log(`Subject ${subId}: ${allocs.length} allocations`);
      allocs.forEach(al => console.log(`   - ${al.subjectCode} (${al.subjectName}) Sec ${al.section}: ${al.facultyName}`));
    }

    // Now let's check subjects returned by hodService.getSubjects
    console.log('\n--- CHECKING SUBJECTS IN HOD VIEW ---');
    // If HOD is AS:
    const asSubjects = await Subject.findAll({
      where: { departmentId: asDept?.id, semester: 1 },
    });
    console.log(`AS Department Subjects (Semester 1): ${asSubjects.length}`);
    for (const s of asSubjects) {
      console.log(`   - ${s.code} (${s.name}): in map? ${Boolean(map[s.id])}`);
    }

    // What if subjects queried are CSE subjects?
    const cseSubjects = await Subject.findAll({
      where: { departmentId: cseDept?.id, semester: 1 },
    });
    console.log(`CSE Department Subjects (Semester 1): ${cseSubjects.length}`);
    for (const s of cseSubjects) {
      console.log(`   - ${s.code} (${s.name}): in map? ${Boolean(map[s.id])}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
testHodQuery();
