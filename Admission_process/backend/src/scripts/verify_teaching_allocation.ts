import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import User from '../models/User';
import { getAcademicYearVariants } from '../services/faculty.service';
import { Op } from 'sequelize';

async function verify() {
  await sequelize.authenticate();
  console.log('--- DATABASE CONNECTION VERIFIED ---');

  // 1. Check all assignments for Semesters 1 & 2
  const assignments = await FacultyAssignment.findAll({
    where: {
      semester: { [Op.in]: [1, 2] },
      status: 'ACTIVE',
    },
    include: [
      { model: Subject, as: 'subject' },
      { model: Department, as: 'department' },
      { model: User, as: 'user', attributes: ['name', 'email'] },
    ],
  });

  console.log(`Found ${assignments.length} active assignments for Semester 1 & 2:`);
  assignments.forEach((a: any) => {
    const s = a.subject;
    const u = a.user?.name || 'Unknown Faculty';
    console.log(
      `  • [${s?.code || 'NO_CODE'}] ${s?.name || 'NO_NAME'} | Sec ${a.section} | Branch: ${a.branch} | Dept: ${a.department?.code} | Faculty: ${u} | AY: ${a.academicYear}`
    );
  });

  // 2. Check canonical AY variants resolution
  console.log('\n--- ACADEMIC YEAR VARIANTS ---');
  console.log('Variants for "2026-27":', getAcademicYearVariants('2026-27'));
  console.log('Variants for "2026-2027":', getAcademicYearVariants('2026-2027'));

  // 3. Check Applied Science department
  const asDept = await Department.findOne({
    where: {
      [Op.or]: [
        { code: 'AS' },
        { type: 'SEMESTER_HANDLING' },
      ],
    },
  });
  console.log('\n--- APPLIED SCIENCE DEPT ---');
  console.log(`ID: ${asDept?.id}, Code: ${asDept?.code}, Name: ${asDept?.name}`);

  // 4. Test simulate subject query for Semester 1, Branch CSE
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  const sem1Subjects = await Subject.findAll({
    where: {
      semester: 1,
      status: 'ACTIVE',
      [Op.or]: [
        { departmentId: asDept?.id },
        { cycle: { [Op.in]: ['P_CYCLE', 'C_CYCLE'] } },
        ...(cseDept ? [{ departmentId: cseDept.id }] : []),
      ],
    },
  });

  console.log(`\n--- SUBJECTS OFFERED FOR SEMESTER 1 (CSE/AS) --- Count: ${sem1Subjects.length}`);
  sem1Subjects.forEach((sub: any) => {
    const matchingAssignments = assignments.filter((a: any) => 
      a.subjectId === sub.id || (a.subject && a.subject.code.toUpperCase() === sub.code.toUpperCase())
    );
    console.log(
      `  • [${sub.code}] ${sub.name} (Cycle: ${sub.cycle || 'None'}) -> ${matchingAssignments.length} Assignment(s)`
    );
  });

  console.log('\n--- VERIFICATION COMPLETE ---');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
