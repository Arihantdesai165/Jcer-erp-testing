import sequelize from '../config/database';
import Subject from '../models/Subject';
import Department from '../models/Department';

async function s() {
  try {
    await sequelize.authenticate();
    const list = await Subject.findAll({ include: [{ model: Department, as: 'department' }] });
    console.log('TOTAL SUBJECTS:', list.length);
    for (const x of list) {
      const raw: any = x;
      console.log(JSON.stringify({ id: raw.id, code: raw.code, name: raw.name, sem: raw.semester, cycle: raw.cycle, dept: raw.department?.code, deptId: raw.departmentId, status: raw.status }));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
s();
