import { Op } from 'sequelize';
import sequelize from './src/config/database';
import Section from './src/models/Section';
import Subject from './src/models/Subject';
import Department from './src/models/Department';
import FacultyAssignment from './src/models/FacultyAssignment';
import Student from './src/models/Student';
import User from './src/models/User';

async function main() {
  await sequelize.authenticate();

  console.log('=== 1. DEPARTMENTS ===');
  const depts = await Department.findAll();
  console.log(JSON.stringify(depts.map(d => ({ id: d.id, name: d.name, code: d.code, type: d.type })), null, 2));

  console.log('=== TEST EXACT CLEAN SECTION MATCHING ===');
  const calculusAssignments = await FacultyAssignment.findAll({
    where: { subjectId: 'd590d547-54f9-491a-8aa5-f99458399217' },
    include: [{ model: Subject, as: 'subject' }, { model: Department, as: 'department' }],
  });

  for (const a of calculusAssignments) {
    const cleanSec = a.section.replace(/^(Section|Sec|Division|Div)\s+/i, '').trim().toUpperCase();
    const deptCode = (a as any).department?.code;
    const isSemHandling = (a as any).department?.type === 'SEMESTER_HANDLING' || deptCode === 'AS';

    // Find all sections in this semester
    const branchCodes = deptCode ? [deptCode, deptCode === 'CSE-AIML' ? 'AIML' : deptCode, `CSE-${deptCode}`] : [];
    if (a.branch) branchCodes.push(a.branch);

    const candidateSections = await Section.findAll({
      where: {
        semester: a.semester,
        [Op.or]: [
          { departmentId: a.departmentId },
          ...(branchCodes.length > 0 ? [{ branch: { [Op.in]: branchCodes } }] : []),
        ],
      },
    });

    // Match exact section by clean code ('D' === 'D', 'E' === 'E')
    const matchedSection = candidateSections.find((sec) => {
      const sCode = sec.name.replace(/^(Section|Sec|Division|Div)\s+/i, '').trim().toUpperCase();
      return sCode === cleanSec || sec.name.trim().toUpperCase() === a.section.trim().toUpperCase();
    });

    console.log(`Assignment: ${a.id} | Section: "${a.section}" (clean: "${cleanSec}") -> Matched DB Section:`, matchedSection?.id, `"${matchedSection?.name}"`, matchedSection?.branch);

    // Query students allocated to this section
    const targetDeptId = isSemHandling && a.branch && a.branch !== 'ALL'
      ? (await Department.findOne({ where: { code: a.branch } }))?.id || a.departmentId
      : a.departmentId;

    const studentOrConditions: any[] = [];
    if (matchedSection) {
      studentOrConditions.push({ sectionId: matchedSection.id });
      studentOrConditions.push({ section: matchedSection.name });
    }
    // Also include standard variants of this clean section
    studentOrConditions.push({ section: cleanSec });
    studentOrConditions.push({ section: `Section ${cleanSec}` });
    studentOrConditions.push({ section: `Section  ${cleanSec}` });

    const students = await Student.findAll({
      where: {
        departmentId: targetDeptId,
        semester: a.semester,
        section: { [Op.ne]: null as any },
        [Op.or]: studentOrConditions,
      },
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName'] },
      ],
      order: [['usn', 'ASC'], ['enrollmentNumber', 'ASC']],
    });

    console.log(`-> Student count found for ${a.section}: ${students.length}`);
    if (students.length > 0) {
      console.log(`   Sample student: USN=${students[0].usn}, Name=${students[0].user?.firstName} ${students[0].user?.lastName}, SectionId=${students[0].sectionId}, Section="${students[0].section}"`);
    }
  }

  console.log('=== 5. STUDENTS COUNT BY SECTION IN DB ===');
  const [studentSections] = await sequelize.query('SELECT DISTINCT "section", "departmentId", "semester", COUNT(*) as count FROM students GROUP BY "section", "departmentId", "semester"');
  console.log(JSON.stringify(studentSections, null, 2));

  console.log('=== 6. CHECK STUDENT COLUMNS ===');
  const [cols] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students'");
  console.log(JSON.stringify(cols, null, 2));

  console.log('=== 7. CHECK ALL TABLES IN DB ===');
  const [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(JSON.stringify(tables, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
