import db from '../config/database';
import { getHodDepartmentStudents } from '../controllers/hod.controller';

async function test() {
  try {
    await db.authenticate();
    const cseDeptId = '3160138d-6777-439a-89f6-efc49b6c043c'; // CSE
    const asDeptId = '40143d08-f3ac-4cb6-9b1b-e4844d48dd60'; // AS

    console.log('--- TEST: CSE HOD getHodDepartmentStudents with semester=1, section=Section A ---');
    const resCSE = await getHodDepartmentStudents({
      departmentId: cseDeptId,
      semester: 1,
      section: 'Section A',
      isSemesterHandling: false
    });
    console.log('CSE HOD student count for sem 1, sec A:', resCSE.count, 'rows count:', resCSE.rows.length);

    console.log('\n--- TEST: CSE HOD getHodDepartmentStudents with semester=1, no section filter ---');
    const resCSEAllSem1 = await getHodDepartmentStudents({
      departmentId: cseDeptId,
      semester: 1,
      isSemesterHandling: false
    });
    console.log('CSE HOD sem 1 total count:', resCSEAllSem1.count);

    console.log('\n--- TEST: AS HOD getHodDepartmentStudents with semester=1, section=Section A, branch=CSE ---');
    const resAS = await getHodDepartmentStudents({
      departmentId: asDeptId,
      semester: 1,
      section: 'Section A',
      branch: 'CSE',
      isSemesterHandling: true
    });
    console.log('AS HOD student count for sem 1, sec A, branch CSE:', resAS.count, 'rows count:', resAS.rows.length);

  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
    process.exit(0);
  }
}
test();
