import dotenv from 'dotenv';
dotenv.config();

import db from '../config/database';
import Subject from '../models/Subject';
import FacultyAssignment from '../models/FacultyAssignment';
import FacultyAuthorizationRequest from '../models/FacultyAuthorizationRequest';

async function run() {
  try {
    await db.authenticate();
    console.log('Database connected.');

    const subjects = await Subject.findAll();
    console.log(`Found ${subjects.length} subjects:`);
    subjects.forEach((s) => console.log(` - [${s.id}] ${s.code}: ${s.name} (Sem ${s.semester}, Dept: ${s.departmentId})`));

    if (subjects.length > 0) {
      const subjectIds = subjects.map((s) => s.id);

      // Clean up faculty assignments referencing these subjects
      const deletedAssignments = await FacultyAssignment.destroy({ where: { subjectId: subjectIds } });
      console.log(`Deleted ${deletedAssignments} faculty assignments.`);

      // Clean up authorization requests referencing these subjects
      const deletedAuthReqs = await FacultyAuthorizationRequest.destroy({ where: { subjectId: subjectIds } });
      console.log(`Deleted ${deletedAuthReqs} faculty authorization requests.`);

      // Delete subjects
      const deletedCount = await Subject.destroy({ where: { id: subjectIds } });
      console.log(`Successfully deleted ${deletedCount} subjects.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error deleting dummy subjects:', err);
    process.exit(1);
  }
}

run();
