import db from '../config/database';
import Student from '../models/Student';
import User from '../models/User';

async function main() {
  try {
    await db.authenticate();
    const allStudents = await Student.findAll({
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }]
    });
    console.log(`Total Students in DB: ${allStudents.length}`);
    allStudents.forEach((s: any) => {
      console.log(`- ${s.user?.firstName} ${s.user?.lastName}, USN: ${s.usn}, Sem: ${s.semester}, Sec: ${s.section}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
