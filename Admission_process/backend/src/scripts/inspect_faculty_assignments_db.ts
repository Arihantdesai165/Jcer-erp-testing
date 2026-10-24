import sequelize from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import User from '../models/User';
import Department from '../models/Department';
import Teacher from '../models/Teacher';

async function inspectAssignments() {
  try {
    await sequelize.authenticate();
    console.log('--- INSPECTING FACULTY ASSIGNMENTS IN DB ---');

    const assignments = await FacultyAssignment.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'cycle', 'semester', 'departmentId'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    console.log(`Total assignments found in DB (recent 20): ${assignments.length}`);
    for (const a of assignments) {
      const item: any = a;
      console.log({
        id: item.id,
        facultyName: `${item.user?.firstName} ${item.user?.lastName}`,
        facultyEmail: item.user?.email,
        subjectId: item.subjectId,
        subjectName: item.subject?.name,
        subjectCode: item.subject?.code,
        semester: item.semester,
        section: item.section,
        academicYear: item.academicYear,
        assignmentDeptId: item.departmentId,
        assignmentDeptCode: item.department?.code,
        status: item.status,
      });
    }

    const depts = await Department.findAll();
    console.log('\nDepartments in DB:');
    for (const d of depts) {
      console.log(`  - ${d.code} (${d.name}) ID: ${d.id}, type: ${d.type}`);
    }

    const subjects = await Subject.findAll({ where: { semester: 1 } });
    console.log(`\nSemester 1 Subjects in DB: ${subjects.length}`);
    for (const s of subjects) {
      console.log(`  - ${s.name} (${s.code}) ID: ${s.id}, cycle: ${s.cycle}, deptId: ${s.departmentId}`);
    }
  } catch (err) {
    console.error('Error inspecting assignments:', err);
  } finally {
    await sequelize.close();
  }
}

inspectAssignments();
