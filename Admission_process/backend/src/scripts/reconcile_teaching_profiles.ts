import db from '../config/database';
import HOD from '../models/HOD';
import Teacher from '../models/Teacher';
import User from '../models/User';
import Department from '../models/Department';
import logger from '../utils/logger.util';

/**
 * Reconciles teaching profiles for all existing HODs, Dean, and Principal.
 * Idempotent: can be executed multiple times without creating duplicate records.
 */
export async function reconcileTeachingProfiles() {
  await db.authenticate();
  console.log('--- RECONCILING TEACHING PROFILES ---');

  // 1. Reconcile Active HODs
  const activeHods = await HOD.findAll({
    where: { isActive: true },
    include: [{ model: User, as: 'user' }],
  });

  console.log(`Found ${activeHods.length} active HOD record(s) to check.`);

  for (const hod of activeHods) {
    if (!hod.departmentId) {
      console.warn(`WARNING: HOD record ${hod.id} (user ${hod.userId}) has no departmentId. Skipping.`);
      continue;
    }

    const dept = await Department.findByPk(hod.departmentId);
    if (!dept) {
      console.warn(`WARNING: Department ${hod.departmentId} for HOD ${hod.id} not found. Skipping.`);
      continue;
    }

    const existingTeacher = await Teacher.findOne({ where: { userId: hod.userId } });

    if (existingTeacher) {
      if (existingTeacher.departmentId !== hod.departmentId || existingTeacher.status !== 'ACTIVE') {
        await existingTeacher.update({
          departmentId: hod.departmentId,
          status: 'ACTIVE',
        });
        console.log(`Updated existing teacher record for HOD user ${hod.userId} to dept ${dept.code}.`);
      } else {
        console.log(`HOD user ${hod.userId} already has active teacher record in dept ${dept.code}.`);
      }
    } else {
      await Teacher.create({
        userId: hod.userId,
        departmentId: hod.departmentId,
        designation: 'Professor & Head of Department',
        joiningDate: hod.tenureStartDate || new Date(),
        status: 'ACTIVE',
      });
      console.log(`Created linked teacher profile for HOD user ${hod.userId} in dept ${dept.code}.`);
    }
  }

  // 2. Report on Dean and Principal
  const deans = await User.findAll({ where: { role: 'DEAN', status: 'ACTIVE' } });
  for (const d of deans) {
    const t = await Teacher.findOne({ where: { userId: d.id } });
    console.log(`Dean user ${d.email}: ${t ? `Linked to dept ${t.departmentId}` : 'No teaching profile configured yet'}.`);
  }

  const principals = await User.findAll({ where: { role: 'PRINCIPAL', status: 'ACTIVE' } });
  for (const p of principals) {
    const t = await Teacher.findOne({ where: { userId: p.id } });
    console.log(`Principal user ${p.email}: ${t ? `Linked to dept ${t.departmentId}` : 'No teaching profile configured yet'}.`);
  }

  console.log('--- RECONCILIATION COMPLETE ---');
}

if (require.main === module) {
  reconcileTeachingProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reconciliation failed:', err);
      process.exit(1);
    });
}
