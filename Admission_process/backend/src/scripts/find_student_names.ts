import sequelize from '../config/database';

async function findStudents() {
  try {
    await sequelize.authenticate();
    const [students] = await sequelize.query(`
      SELECT s.id, s.usn, s."enrollmentNumber", s.semester, s.section, s."sectionId", s."departmentId",
             u."firstName", u."lastName", d.code as "deptCode"
      FROM students s
      JOIN users u ON s."userId" = u.id
      JOIN departments d ON s."departmentId" = d.id
      WHERE u."firstName" ILIKE '%Asha%' OR u."lastName" ILIKE '%Badnaik%'
         OR u."firstName" ILIKE '%Charanraj%' OR u."lastName" ILIKE '%Jadhav%'
         OR s."enrollmentNumber" ILIKE '%00269%'
         OR s.usn ILIKE '%00269%';
    `);
    console.log('STUDENTS FOUND:', students);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
findStudents();
