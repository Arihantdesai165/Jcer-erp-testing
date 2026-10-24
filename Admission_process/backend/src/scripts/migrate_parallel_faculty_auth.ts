import db from '../config/database';
import FacultyAuthorizationRequest from '../models/FacultyAuthorizationRequest';
import User from '../models/User';

async function runMigration() {
  try {
    await db.authenticate();
    console.log('Database connected.');

    // 1. Add new columns to faculty_authorization_requests
    await db.query(`
      ALTER TABLE faculty_authorization_requests
      ADD COLUMN IF NOT EXISTS "firstApprovedByUserId" UUID DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "firstApprovedByName" VARCHAR(150) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "firstApprovedRole" VARCHAR(100) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "firstApprovedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "overallStatus" VARCHAR(50) DEFAULT 'PENDING_APPROVAL';
    `);
    console.log('Added parallel approval columns to faculty_authorization_requests.');

    // 2. Unlock any LOCKED requests to PENDING
    const [unlockResult] = await db.query(`
      UPDATE faculty_authorization_requests
      SET status = 'PENDING', "sequence" = 1
      WHERE status = 'LOCKED';
    `);
    console.log('Unlocked locked records:', unlockResult);

    // 3. For any faculty who has a DEAN request but NO PRINCIPAL request, create a parallel PRINCIPAL request
    const deanRequests = await FacultyAuthorizationRequest.findAll({
      where: { authority: 'DEAN' },
    });

    for (const dReq of deanRequests) {
      const princReq = await FacultyAuthorizationRequest.findOne({
        where: {
          facultyUserId: dReq.facultyUserId,
          authority: 'PRINCIPAL',
        },
      });

      if (!princReq) {
        await FacultyAuthorizationRequest.create({
          facultyUserId: dReq.facultyUserId,
          departmentId: dReq.departmentId,
          subjectId: dReq.subjectId,
          semester: dReq.semester,
          section: dReq.section,
          academicYear: dReq.academicYear || '2026-27',
          designation: dReq.designation || 'Assistant Professor',
          createdByHODId: dReq.createdByHODId,
          authority: 'PRINCIPAL',
          sequence: 1,
          status: 'PENDING',
          overallStatus: dReq.status === 'APPROVED' ? 'AUTHORIZED' : 'PENDING_APPROVAL',
          firstApprovedByName: dReq.status === 'APPROVED' ? dReq.decidedByName : null,
          firstApprovedRole: dReq.status === 'APPROVED' ? 'Dean Academics' : null,
          firstApprovedAt: dReq.status === 'APPROVED' ? dReq.decidedAt : null,
        });
        console.log(`Created parallel PRINCIPAL request for faculty ${dReq.facultyUserId}`);
      }
    }

    // 4. Update overallStatus for existing records
    await db.query(`
      UPDATE faculty_authorization_requests
      SET "overallStatus" = 'AUTHORIZED'
      WHERE status = 'APPROVED';
    `);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
