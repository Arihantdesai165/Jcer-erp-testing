import db from '../config/database';
import Section from '../models/Section';
import Department from '../models/Department';
import { Op } from 'sequelize';

async function testSectionMatching() {
  await db.authenticate();
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  const asDept = await Department.findOne({ where: { code: 'AS' } });

  console.log('CSE Dept ID:', cseDept?.id);
  console.log('AS Dept ID:', asDept?.id);

  const rawSec = 'Section A';
  const cleanLetter = 'A';
  const sectionOrConditions: any[] = [
    { name: rawSec },
    { name: `Section ${cleanLetter}` },
    { name: { [Op.iLike]: `%${cleanLetter}%` } },
  ];

  // Old query for CSE Dept:
  const oldSections = await Section.findAll({
    where: {
      departmentId: cseDept?.id,
      [Op.or]: sectionOrConditions,
    }
  });
  console.log('Old query found sections for CSE:', oldSections.map(s => ({ id: s.id, name: s.name, branch: s.branch, sem: s.semester })));

  // New query for CSE Dept:
  const newSections = await Section.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: [
            { departmentId: cseDept?.id },
            { branch: 'CSE' },
            { branch: { [Op.in]: ['CSE', 'CSE-CSE'] } }
          ]
        },
        {
          [Op.or]: sectionOrConditions
        }
      ]
    }
  });
  console.log('New query found sections for CSE:', newSections.map(s => ({ id: s.id, name: s.name, branch: s.branch, sem: s.semester, deptId: s.departmentId })));

  await db.close();
}
testSectionMatching();
