import db from '../config/database';
import Section from '../models/Section';
import Student from '../models/Student';
import Department from '../models/Department';
import { Op } from 'sequelize';
import { sectionAllocationService } from '../services/sectionAllocation.service';

async function testBranchesOverview() {
  await db.authenticate();
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  if (!cseDept) return;

  console.log('--- TEST CSE HOD Branches Overview for Sem 1 ---');
  const sem1Num = 1;
  const rawCode = cseDept.code;
  const displayCode = rawCode === 'CSE-AIML' ? 'AIML' : rawCode;
  const branchCodes = [rawCode, displayCode, `CSE-${displayCode}`, cseDept.name];

  const totalStudents = await Student.count({
    where: {
      departmentId: cseDept.id,
      semester: sem1Num,
    },
  });

  const sections = await Section.findAll({
    where: {
      semester: sem1Num,
      status: 'ACTIVE',
      [Op.or]: [
        { departmentId: cseDept.id },
        { branch: { [Op.in]: branchCodes } },
      ],
    },
  });

  const secIds = sections.map((s) => s.id);
  const secNames = sections.map((s) => s.name);

  const allocatedStudents = await Student.count({
    where: {
      departmentId: cseDept.id,
      semester: sem1Num,
      [Op.or]: [
        { sectionId: { [Op.in]: secIds } },
        { section: { [Op.in]: secNames } },
      ],
    },
  });

  console.log('Total CSE Sem 1 students:', totalStudents);
  console.log('Found sections:', sections.map(s => ({ id: s.id, name: s.name, branch: s.branch })));
  console.log('Allocated count:', allocatedStudents);
  console.log('Unallocated count:', totalStudents - allocatedStudents);

  await db.close();
}
testBranchesOverview();
