import sequelize from '../config/database';

async function run() {
  try {
    await sequelize.authenticate();
    const [subjects] = await sequelize.query(`
      SELECT s.id, s.code, s.name, s.cycle, s."departmentId", d.code as dept_code 
      FROM subjects s 
      LEFT JOIN departments d ON s."departmentId" = d.id 
      ORDER BY s.code, s.name
    `);
    console.log('--- ALL SUBJECTS ---');
    console.log(JSON.stringify(subjects, null, 2));

    const [assigns] = await sequelize.query(`
      SELECT fa.id, fa."teacherId", fa."userId", fa."subjectId", fa.semester, fa.section, fa."academicYear", fa.branch, fa."departmentId", 
             d.code as dept_code, s.code as sub_code, s.name as sub_name, u."firstName", u."lastName" 
      FROM faculty_assignments fa 
      LEFT JOIN subjects s ON fa."subjectId" = s.id 
      LEFT JOIN departments d ON fa."departmentId" = d.id 
      LEFT JOIN users u ON fa."userId" = u.id 
      ORDER BY fa."createdAt" DESC
    `);
    console.log('--- ALL ASSIGNMENTS ---');
    console.log(JSON.stringify(assigns, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();
