import sequelize from '../config/database';
import Admission from '../models/Admission';
import Student from '../models/Student';
import User from '../models/User';
import Department from '../models/Department';

async function checkAdmissions() {
  await sequelize.authenticate();
  
  const admissions = await Admission.findAll({ raw: true });
  console.log('--- ALL ADMISSIONS IN DB ---', admissions.length);
  for (const a of admissions as any[]) {
    console.log(`Admission ID: ${a.id}, AppNum: ${a.applicationNumber}, Name: ${a.candidateName}, Dept: ${a.branchApplied}, Sem: ${a.entrySemester}, Type: ${a.admissionType}, Status: ${a.applicationStatus}`);
  }

  const users = await User.findAll({ where: { role: 'STUDENT' }, raw: true });
  console.log('--- ALL STUDENT USERS IN DB ---', users.length);
  for (const u of users as any[]) {
    console.log(`User ID: ${u.id}, Email: ${u.email}, Name: ${u.firstName} ${u.lastName}`);
  }

  const depts = await Department.findAll({ raw: true });
  console.log('--- DEPARTMENTS IN DB ---');
  for (const d of depts as any[]) {
    console.log(`Dept ID: ${d.id}, Code: ${d.code}, Name: ${d.name}`);
  }

  process.exit(0);
}

checkAdmissions();
