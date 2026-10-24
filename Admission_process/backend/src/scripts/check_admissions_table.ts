import sequelize from '../config/database';

async function checkAdmissions() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(`
      SELECT a.id, a."applicationNumber", a."admissionNumber", a."registrationNumber",
             p."studentName", p."firstName", p."lastName", a."branch", a."allocatedSection"
      FROM admissions a
      LEFT JOIN admission_personal_details p ON a.id = p."admissionId"
      WHERE p."studentName" ILIKE '%Asha%' OR p."firstName" ILIKE '%Asha%'
         OR a."admissionNumber" ILIKE '%00269%' OR a."registrationNumber" ILIKE '%00269%'
         OR a."applicationNumber" ILIKE '%00269%';
    `);
    console.log('ADMISSIONS FOUND:', rows);

    const [allAdmissions] = await sequelize.query(`
      SELECT count(*) FROM admissions;
    `);
    console.log('TOTAL ADMISSIONS:', allAdmissions);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
checkAdmissions();
