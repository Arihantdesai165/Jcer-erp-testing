import db from '../config/database';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Teacher from '../models/Teacher';
import HOD from '../models/HOD';
import User from '../models/User';

async function check() {
  try {
    await db.authenticate();
    console.log('Connected');

    const [indexes] = await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subjects';");
    console.log('SUBJECT INDEXES:', JSON.stringify(indexes, null, 2));

    const [asSubjects] = await db.query("SELECT * FROM subjects LIMIT 10;");
    console.log('EXISTING SUBJECTS SAMPLE:', JSON.stringify(asSubjects, null, 2));

    const [teacherIndexes] = await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'teachers';");
    console.log('TEACHER INDEXES:', JSON.stringify(teacherIndexes, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
check();
