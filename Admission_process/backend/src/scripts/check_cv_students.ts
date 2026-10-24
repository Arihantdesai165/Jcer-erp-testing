import sequelize from '../config/database';

async function checkCvAdmissions() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(`
      SELECT a.id, a."applicationNumber", a."academicYear", a."branchId", d.code as "deptCode",
             p."firstName", p."lastName"
      FROM admissions a
      LEFT JOIN admission_personal_details p ON a.id = p."admissionId"
      LEFT JOIN departments d ON a."branchId" = d.id
      WHERE a."applicationNumber" IN (
        'JCER-2026-CV-00269',
        'JCER-2026-CV-00005',
        'JCER-2026-CV-00016',
        'JCER-2026-CV-00097',
        'JCER-2026-CV-00013'
      );
    `);
    console.log('ADMISSIONS FOR SCREENSHOT 1 STUDENTS:', rows);

    // Also let's check students created from those admissions:
    const [studs] = await sequelize.query(`
      SELECT s.id, s.usn, s."enrollmentNumber", s.semester, s.section, s."sectionId", s."departmentId",
             u."firstName", u."lastName"
      FROM students s
      JOIN users u ON s."userId" = u.id
      WHERE s."enrollmentNumber" IN (
        'JCER-2026-CV-00269',
        'JCER-2026-CV-00005',
        'JCER-2026-CV-00016',
        'JCER-2026-CV-00097',
        'JCER-2026-CV-00013'
      ) OR s.usn IN (
        'JCER-2026-CV-00269',
        'JCER-2026-CV-00005',
        'JCER-2026-CV-00016',
        'JCER-2026-CV-00097',
        'JCER-2026-CV-00013'
      );
    `);
    console.log('STUDENTS FOR SCREENSHOT 1:', studs);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
checkCvAdmissions();
