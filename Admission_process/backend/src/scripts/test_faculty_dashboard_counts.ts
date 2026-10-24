import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import User from '../models/User';
import facultyService from '../services/faculty.service';

async function run() {
  try {
    const activeAssigns = await FacultyAssignment.findAll({
      where: { status: 'ACTIVE' },
      include: [{ model: Subject, as: 'subject' }, { model: User, as: 'user' }]
    });

    console.log(`Found ${activeAssigns.length} active assignments in DB:`);
    const usersMap = new Map<string, any[]>();
    for (const a of activeAssigns) {
      const u = (a as any).user;
      const uid = u ? u.id : a.userId;
      if (!usersMap.has(uid)) usersMap.set(uid, []);
      usersMap.get(uid)?.push(a);
    }

    for (const [uid, arr] of usersMap.entries()) {
      const u = (arr[0] as any).user || await User.findByPk(uid);
      console.log(`User: ${u?.firstName} ${u?.lastName} (${u?.email}, ID: ${uid}) - ${arr.length} active assignments:`);
      arr.forEach((a: any) => {
        console.log(`  - Subject: ${a.subject?.name} (${a.subject?.code}), Sec: ${a.section}, Sem: ${a.semester}, AY: ${a.academicYear}`);
      });
      const dash = await facultyService.getFacultyDashboard(uid);
      console.log(`  Current Dashboard Stats:`, dash.stats);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
