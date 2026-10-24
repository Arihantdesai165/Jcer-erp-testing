import sequelize from '../config/database';
async function run() {
  await sequelize.authenticate();
  const [rows] = await sequelize.query('SELECT * FROM hod_subject_handling_requests');
  console.log('HOD SUBJECT HANDLING REQUESTS:', rows);
  const [allSubjs] = await sequelize.query('SELECT * FROM subjects');
  console.log('ALL SUBJECTS IN DB COUNT:', allSubjs.length);
  for (const s of allSubjs as any[]) {
    console.log({ id: s.id, code: s.code, name: s.name, semester: s.semester, cycle: s.cycle, deptId: s.departmentId, credits: s.credits, type: s.type });
  }
  await sequelize.close();
}
run();
