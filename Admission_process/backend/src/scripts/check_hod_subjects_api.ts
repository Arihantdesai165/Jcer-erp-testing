import sequelize from '../config/database';
import Subject from '../models/Subject';
import Department from '../models/Department';
import FacultyAssignment from '../models/FacultyAssignment';
import User from '../models/User';

async function checkHodSubjectsApi() {
  try {
    await sequelize.authenticate();
    const asDept = await Department.findOne({ where: { code: 'AS' } });
    console.log('AS Department ID:', asDept?.id);

    // Simulated getHodSubjects for AS HOD:
    const departmentId = asDept?.id;
    const reqQuery: any = { semester: 1, status: 'ACTIVE' };

    const whereClause: any = { departmentId };
    if (reqQuery.status && reqQuery.status !== 'ALL') {
      whereClause.status = reqQuery.status;
    }
    if (reqQuery.semester && reqQuery.semester !== 'ALL') {
      whereClause.semester = Number(reqQuery.semester);
    }

    console.log('whereClause for getHodSubjects:', whereClause);

    const subjects = await Subject.findAll({
      where: whereClause,
      order: [['semester', 'ASC'], ['code', 'ASC']],
    });

    console.log(`getHodSubjects returned ${subjects.length} subjects:`);
    for (const s of subjects) {
      console.log({ id: s.id, code: s.code, name: s.name, sem: s.semester, cycle: s.cycle, deptId: s.departmentId });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
checkHodSubjectsApi();
