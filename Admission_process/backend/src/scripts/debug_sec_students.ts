import db from '../config/database';
import Section from '../models/Section';
import Student from '../models/Student';
import Department from '../models/Department';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import User from '../models/User';
import { Op } from 'sequelize';

async function main() {
  try {
    await db.authenticate();
    console.log('--- DEPARTMENTS ---');
    const depts = await Department.findAll({ raw: true });
    console.log(JSON.stringify(depts.map(d => ({ id: d.id, name: d.name, code: d.code, type: d.type })), null, 2));

    console.log('--- SECTIONS ---');
    const sections = await Section.findAll({ raw: true });
    console.log(JSON.stringify(sections.map(s => ({ id: s.id, name: s.name, branch: s.branch, semester: s.semester, academicYear: s.academicYear, departmentId: s.departmentId, capacity: s.capacity })), null, 2));

    console.log('--- ALLOCATED STUDENTS IN SEM 1 ---');
    const allocated = await Student.findAll({
      where: {
        semester: 1,
        [Op.or]: [
          { sectionId: { [Op.ne]: null } },
          { section: { [Op.ne]: null } }
        ]
      },
      attributes: ['id', 'departmentId', 'semester', 'section', 'sectionId', 'rollNumber', 'enrollmentNumber', 'usn'],
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName'] },
        { model: Department, as: 'department', attributes: ['code'] }
      ]
    });
    console.log('Total allocated students in Sem 1:', allocated.length);
    console.log('Sample 5 allocated students:', JSON.stringify(allocated.slice(0, 5), null, 2));

    // Also check student academic enrollments
    const saes = await StudentAcademicEnrollment.findAll({
      where: { semesterId: 1, sectionId: { [Op.ne]: null } },
      attributes: ['id', 'studentId', 'departmentId', 'semesterId', 'sectionId', 'academicYearId', 'rollNumber']
    });
    console.log('Total SAE records with sectionId in Sem 1:', saes.length);
    console.log('Sample 5 SAEs:', JSON.stringify(saes.slice(0, 5), null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
    process.exit(0);
  }
}
main();
