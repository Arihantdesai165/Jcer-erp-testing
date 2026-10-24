import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import User from '../models/User';
import Department from '../models/Department';
import { Op } from 'sequelize';

async function testTeachingAllocationQuery() {
  try {
    await sequelize.authenticate();
    console.log('--- TESTING TEACHING ALLOCATION QUERY & AGGREGATION ---');

    const asDept = await Department.findOne({ where: { code: 'AS' } });
    const cseDept = await Department.findOne({ where: { code: 'CSE' } });
    if (!asDept || !cseDept) {
      throw new Error('Required departments AS or CSE not found.');
    }

    console.log(`AS Dept ID: ${asDept.id}`);
    console.log(`CSE Dept ID: ${cseDept.id}`);

    // Simulate backend query executed by getHodFacultyAssignments when AS HOD views CSE branch for AY 2026-2027 / 2026-27, Semester 1
    const targetBranch = 'CSE';
    const semester = 1;
    const academicYear = '2026-27'; // frontend passed 2026-27

    const ayStr = String(academicYear).trim();
    const variations = [
      ayStr,
      ayStr.replace(/(\d{4})-(\d{2})$/, (_, y1, y2) => `${y1}-20${y2}`),
      ayStr.replace(/(\d{4})-20(\d{2})$/, '$1-$2'),
      ayStr.replace(/–/g, '-'),
      ayStr.replace(/-/g, '–'),
    ];

    const whereClause: any = {
      departmentId: cseDept.id,
      semester: Number(semester),
      academicYear: { [Op.in]: Array.from(new Set(variations)) },
    };

    const assignments = await FacultyAssignment.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'],
        },
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code', 'credits', 'cycle', 'schemeId', 'type'],
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
        },
      ],
      order: [['semester', 'ASC'], ['section', 'ASC']],
    });

    console.log(`Found ${assignments.length} assignments for CSE Semester 1:`);
    const mapped = assignments.map((a: any) => ({
      id: a.id,
      facultyUserId: a.userId,
      facultyName: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim() || 'Faculty',
      facultyEmail: a.user?.email,
      subjectId: a.subjectId,
      subjectName: a.subject?.name,
      subjectCode: a.subject?.code,
      subjectCycle: a.subject?.cycle,
      subjectType: a.subject?.type,
      semester: a.semester,
      section: a.section,
      branch: a.department?.code,
      academicYear: a.academicYear,
      status: a.status,
    }));

    console.log(JSON.stringify(mapped, null, 2));

    if (mapped.length < 2) {
      throw new Error(`Expected at least 2 assignments for Physics, but got ${mapped.length}`);
    }

    // Check physics subject matching
    const physicsSubj = await Subject.findOne({ where: { code: '1BPLC202K' } });
    if (!physicsSubj) throw new Error('Physics subject 1BPLC202K not found');

    const physicsAssignments = mapped.filter((a) => a.subjectId === physicsSubj.id);
    console.log(`\nPhysics (${physicsSubj.name}, ${physicsSubj.code}) Assignment Count: ${physicsAssignments.length}`);
    if (physicsAssignments.length !== 2) {
      throw new Error(`Physics assignments count mismatch: expected 2, got ${physicsAssignments.length}`);
    }

    console.log('✓ Section Allocations:');
    physicsAssignments.forEach((pa) => {
      console.log(`  - Section ${pa.section} (${pa.branch}): ${pa.facultyName} (${pa.facultyEmail})`);
    });

    console.log('\n========================================================');
    console.log('ALL TEACHING ALLOCATION QUERY & DISPLAY TESTS PASSED 100%!');
    console.log('========================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

testTeachingAllocationQuery();
