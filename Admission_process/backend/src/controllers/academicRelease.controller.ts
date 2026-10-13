import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import academicReleaseService from '../services/academicRelease.service';
import { AssessmentType } from '../models/AcademicRelease';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger.util';

/**
 * Audit log helper
 */
const logReleaseAudit = async (req: AuthenticatedRequest, action: string, details: any) => {
  try {
    await AuditLog.create({
      userId: req.user?.id || null,
      action,
      ipAddress: req.ip || req.headers?.['x-forwarded-for']?.toString() || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'System',
      details,
    });
  } catch (err) {
    logger.warn('[AcademicReleaseController] Audit log write failed:', err);
  }
};

/**
 * 1. Get Authorized Semesters for the HOD
 * GET /api/hod/release/semesters
 */
export const getAuthorizedSemesters = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const academicYear = (req.query.academicYear as string) || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    const semesters = await academicReleaseService.getAuthorizedSemesters({
      departmentId,
      isSemesterHandling,
      academicYear,
    });

    return res.status(200).json({
      success: true,
      academicYear,
      semesters,
    });
  } catch (err: any) {
    logger.error('[AcademicReleaseController] getAuthorizedSemesters error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch authorized semesters.' });
  }
};

/**
 * 2. Automatically Display Active Subjects for Selected Semester
 * GET /api/hod/release/semesters/:semester/subjects
 */
export const getSemesterSubjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const semester = parseInt(req.params.semester || (req.query.semester as string), 10);
    if (isNaN(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ error: 'Valid semester (1-8) is required.' });
    }

    const academicYear = (req.query.academicYear as string) || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    // If Applied Science HOD, verify semester is 1 or 2
    if (isSemesterHandling && ![1, 2].includes(semester)) {
      return res.status(403).json({
        error: 'Applied Science department is authorized only for Semester 1 and Semester 2.',
      });
    }

    const subjects = await academicReleaseService.getSubjectsWithReleaseStatus({
      departmentId,
      isSemesterHandling,
      semester,
      academicYear,
    });

    return res.status(200).json({
      success: true,
      semester,
      academicYear,
      subjects,
    });
  } catch (err: any) {
    logger.error('[AcademicReleaseController] getSemesterSubjects error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch active subjects for semester.' });
  }
};

/**
 * 3. Preview Attendance Release for a Subject
 * GET /api/hod/release/attendance/preview
 */
export const previewAttendanceRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const semester = parseInt((req.query.semester as string) || (req.body?.semester as string), 10);
    const subjectId = (req.query.subjectId as string) || (req.body?.subjectId as string);
    const academicYear = (req.query.academicYear as string) || (req.body?.academicYear as string) || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(semester) || !subjectId) {
      return res.status(400).json({ error: 'Semester and subjectId are required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(semester)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const preview = await academicReleaseService.previewAttendanceRelease({
      departmentId,
      isSemesterHandling,
      semester,
      academicYear,
      subjectId,
    });

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (err: any) {
    logger.error('[AcademicReleaseController] previewAttendanceRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to preview attendance release.' });
  }
};

/**
 * 4. Confirm Attendance Release for a Subject
 * POST /api/hod/release/attendance/confirm
 */
export const confirmAttendanceRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    const userId = req.user?.id;
    if (!departmentId || !userId) {
      return res.status(403).json({ error: 'Authorized HOD identity required.' });
    }

    const { semester, subjectId, academicYear } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(numSem) || !subjectId) {
      return res.status(400).json({ error: 'Semester and subjectId are required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(numSem)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const result = await academicReleaseService.confirmAttendanceRelease({
      departmentId,
      isSemesterHandling,
      semester: numSem,
      academicYear: cleanAY,
      subjectId,
      userId,
    });

    await logReleaseAudit(req, 'RELEASE_STUDENT_ATTENDANCE', {
      subjectId,
      semester: numSem,
      academicYear: cleanAY,
      totalStudentsCount: result.totalStudentsCount,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] confirmAttendanceRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to release attendance.' });
  }
};

/**
 * 5. Preview Marks Release for a Subject Assessment
 * GET /api/hod/release/marks/preview
 */
export const previewMarksRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const semester = parseInt((req.query.semester as string) || (req.body?.semester as string), 10);
    const subjectId = (req.query.subjectId as string) || (req.body?.subjectId as string);
    const assessmentType = (req.query.assessmentType as string) || (req.body?.assessmentType as string);
    const academicYear = (req.query.academicYear as string) || (req.body?.academicYear as string) || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(semester) || !subjectId || !assessmentType) {
      return res.status(400).json({ error: 'Semester, subjectId, and assessmentType are required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(semester)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const preview = await academicReleaseService.previewMarksRelease({
      departmentId,
      isSemesterHandling,
      semester,
      academicYear,
      subjectId,
      assessmentType: assessmentType as AssessmentType,
    });

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (err: any) {
    logger.error('[AcademicReleaseController] previewMarksRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to preview marks release.' });
  }
};

/**
 * 6. Confirm Marks Release for a Subject Assessment
 * POST /api/hod/release/marks/confirm
 */
export const confirmMarksRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    const userId = req.user?.id;
    if (!departmentId || !userId) {
      return res.status(403).json({ error: 'Authorized HOD identity required.' });
    }

    const { semester, subjectId, academicYear, assessmentType } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(numSem) || !subjectId || !assessmentType) {
      return res.status(400).json({ error: 'Semester, subjectId, and assessmentType are required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(numSem)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const result = await academicReleaseService.confirmMarksRelease({
      departmentId,
      isSemesterHandling,
      semester: numSem,
      academicYear: cleanAY,
      subjectId,
      assessmentType: assessmentType as AssessmentType,
      userId,
    });

    await logReleaseAudit(req, 'RELEASE_STUDENT_MARKS', {
      subjectId,
      semester: numSem,
      academicYear: cleanAY,
      assessmentType,
      totalStudentsCount: result.totalStudentsCount,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] confirmMarksRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to release marks.' });
  }
};

/**
 * 7. Global Semester Attendance Release
 * POST /api/hod/release/semester/attendance/confirm
 */
export const confirmSemesterAttendanceRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    const userId = req.user?.id;
    if (!departmentId || !userId) {
      return res.status(403).json({ error: 'Authorized HOD identity required.' });
    }

    const { semester, academicYear } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(numSem)) {
      return res.status(400).json({ error: 'Valid semester is required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(numSem)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const result = await academicReleaseService.confirmSemesterAttendanceRelease({
      departmentId,
      isSemesterHandling,
      semester: numSem,
      academicYear: cleanAY,
      userId,
    });

    await logReleaseAudit(req, 'RELEASE_SEMESTER_ATTENDANCE', {
      semester: numSem,
      academicYear: cleanAY,
      releasedCount: result.releasedCount,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] confirmSemesterAttendanceRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to release semester attendance.' });
  }
};

/**
 * 8. Revoke Semester Attendance Release
 * POST /api/hod/release/semester/attendance/revoke
 */
export const revokeSemesterAttendanceRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const { semester, academicYear } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';

    if (isNaN(numSem)) {
      return res.status(400).json({ error: 'Valid semester is required.' });
    }

    const result = await academicReleaseService.revokeSemesterAttendanceRelease({
      departmentId,
      semester: numSem,
      academicYear: cleanAY,
    });

    await logReleaseAudit(req, 'REVOKE_SEMESTER_ATTENDANCE', {
      semester: numSem,
      academicYear: cleanAY,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] revokeSemesterAttendanceRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to revoke semester attendance.' });
  }
};

/**
 * 9. Global Semester Marks Release
 * POST /api/hod/release/semester/marks/confirm
 */
export const confirmSemesterMarksRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    const userId = req.user?.id;
    if (!departmentId || !userId) {
      return res.status(403).json({ error: 'Authorized HOD identity required.' });
    }

    const { semester, academicYear, assessmentType } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';
    const isSemesterHandling = Boolean(req.isSemesterHandling);

    if (isNaN(numSem)) {
      return res.status(400).json({ error: 'Valid semester is required.' });
    }

    if (isSemesterHandling && ![1, 2].includes(numSem)) {
      return res.status(403).json({ error: 'Scope violation: HOD can only manage Semesters 1 and 2.' });
    }

    const result = await academicReleaseService.confirmSemesterMarksRelease({
      departmentId,
      isSemesterHandling,
      semester: numSem,
      academicYear: cleanAY,
      assessmentType: assessmentType || 'ALL',
      userId,
    });

    await logReleaseAudit(req, 'RELEASE_SEMESTER_MARKS', {
      semester: numSem,
      academicYear: cleanAY,
      assessmentType: assessmentType || 'ALL',
      releasedCount: result.releasedCount,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] confirmSemesterMarksRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to release semester marks.' });
  }
};

/**
 * 10. Revoke Semester Marks Release
 * POST /api/hod/release/semester/marks/revoke
 */
export const revokeSemesterMarksRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const { semester, academicYear, assessmentType } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';

    if (isNaN(numSem)) {
      return res.status(400).json({ error: 'Valid semester is required.' });
    }

    const result = await academicReleaseService.revokeSemesterMarksRelease({
      departmentId,
      semester: numSem,
      academicYear: cleanAY,
      assessmentType: assessmentType || 'ALL',
    });

    await logReleaseAudit(req, 'REVOKE_SEMESTER_MARKS', {
      semester: numSem,
      academicYear: cleanAY,
      assessmentType: assessmentType || 'ALL',
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] revokeSemesterMarksRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to revoke semester marks.' });
  }
};

/**
 * 11. Revoke Subject Attendance Release
 * POST /api/hod/release/attendance/revoke
 */
export const revokeAttendanceRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const { semester, subjectId, academicYear } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';

    if (isNaN(numSem) || !subjectId) {
      return res.status(400).json({ error: 'Semester and subjectId are required.' });
    }

    const result = await academicReleaseService.revokeSubjectAttendanceRelease({
      departmentId,
      semester: numSem,
      academicYear: cleanAY,
      subjectId,
    });

    await logReleaseAudit(req, 'REVOKE_STUDENT_ATTENDANCE', {
      subjectId,
      semester: numSem,
      academicYear: cleanAY,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] revokeAttendanceRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to revoke subject attendance.' });
  }
};

/**
 * 12. Revoke Subject Marks Release
 * POST /api/hod/release/marks/revoke
 */
export const revokeMarksRelease = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.departmentId;
    if (!departmentId) {
      return res.status(403).json({ error: 'Department context is required.' });
    }

    const { semester, subjectId, academicYear, assessmentType } = req.body;
    const numSem = parseInt(semester, 10);
    const cleanAY = academicYear || '2026-27';

    if (isNaN(numSem) || !subjectId) {
      return res.status(400).json({ error: 'Semester and subjectId are required.' });
    }

    const result = await academicReleaseService.revokeSubjectMarksRelease({
      departmentId,
      semester: numSem,
      academicYear: cleanAY,
      subjectId,
      assessmentType: assessmentType || 'ALL',
    });

    await logReleaseAudit(req, 'REVOKE_STUDENT_MARKS', {
      subjectId,
      semester: numSem,
      academicYear: cleanAY,
      assessmentType: assessmentType || 'ALL',
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('[AcademicReleaseController] revokeMarksRelease error:', err);
    return res.status(400).json({ error: err.message || 'Failed to revoke subject marks.' });
  }
};

