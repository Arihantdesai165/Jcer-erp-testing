import db from '../config/database';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';

async function resetTestData() {
  await db.authenticate();
  const deletedRecords = await AttendanceRecord.destroy({
    where: { date: '2026-10-02' },
  });
  const deletedSessions = await AttendanceSession.destroy({
    where: { attendanceDate: '2026-10-02' },
  });
  console.log(`Reset test data: deleted ${deletedSessions} sessions and ${deletedRecords} records.`);
  process.exit(0);
}

resetTestData().catch((e) => {
  console.error(e);
  process.exit(1);
});
