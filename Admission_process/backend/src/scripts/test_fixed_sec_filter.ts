import db from '../config/database';
import Section from '../models/Section';
import Student from '../models/Student';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import User from '../models/User';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import sequelize from '../config/database';
import { Op } from 'sequelize';

async function testSectionFilter() {
  await db.authenticate();
  const cseDeptId = '3160138d-6777-439a-89f6-efc49b6c043c';
  const dept = await Department.findByPk(cseDeptId);
  const deptCode = dept?.code || '';
  const displayCode = deptCode === 'CSE-AIML' ? 'AIML' : deptCode;

  const rawSec = 'Section A';
  const cleanLetter = 'A';
  const sectionOrConditions: any[] = [
    { name: rawSec },
    { name: `Section ${cleanLetter}` },
    { name: { [Op.iLike]: `%${cleanLetter}%` } },
  ];

  const matchedSections = await Section.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: [
            { departmentId: cseDeptId },
            { branch: deptCode },
            { branch: displayCode },
            { branch: `CSE-${displayCode}` },
            { branch: displayCode.replace(/^CSE-/, '') },
          ],
        },
        {
          [Op.or]: sectionOrConditions,
        },
      ],
    },
    attributes: ['id', 'name'],
  });

  const possibleSectionUuids = Array.from(
    new Set([
      ...matchedSections.map((s) => s.id),
    ])
  ).filter(Boolean);

  const possibleSectionNames = Array.from(
    new Set([
      rawSec,
      cleanLetter,
      `Section ${cleanLetter}`,
      `Sec ${cleanLetter}`,
      cleanLetter.toUpperCase(),
      cleanLetter.toLowerCase(),
      ...matchedSections.map((s) => s.name),
    ])
  ).filter(Boolean);

  const possibleSectionIds = Array.from(
    new Set([
      ...possibleSectionUuids,
      ...possibleSectionNames,
    ])
  );

  console.log('Possible Section IDs for CSE HOD Section A:', possibleSectionIds);

  const saeWhere: any = {
    status: { [Op.notIn]: ['INACTIVE', 'DROPPED'] },
    semesterId: 1,
    sectionId: { [Op.in]: possibleSectionIds },
  };

  const studentWhere: any = {
    departmentId: cseDeptId,
    semester: 1,
  };

  const { count, rows } = await Student.findAndCountAll({
    where: studentWhere,
    include: [
      {
        model: StudentAcademicEnrollment,
        as: 'academicEnrollments',
        where: saeWhere,
        required: true,
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName'],
        required: false,
      },
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'name', 'code'],
        required: false,
      },
    ],
    distinct: true,
    subQuery: false,
  });

  console.log('CSE HOD Section A count with fixed logic:', count, 'rows:', rows.length);
  console.log('First student:', rows[0]?.user?.firstName, rows[0]?.user?.lastName);

  await db.close();
}
testSectionFilter();
