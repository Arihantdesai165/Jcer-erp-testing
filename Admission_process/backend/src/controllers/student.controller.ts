import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import studentDashboardService from '../services/studentDashboard.service';
import logger from '../utils/logger.util';

/**
 * GET /api/student/overview
 * Authenticated student's academic overview
 */
export const getStudentOverview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Student session missing.' });
    }

    const data = await studentDashboardService.getStudentOverview(userId);
    return res.json({ success: true, data });
  } catch (err: any) {
    logger.error('GET_STUDENT_OVERVIEW_ERROR:', err);
    return res.status(404).json({ success: false, error: err.message || 'Failed to load student overview.' });
  }
};

/**
 * GET /api/student/attendance/summary
 * Authenticated student's overall & subject-wise attendance breakdown
 */
export const getStudentAttendanceSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Student session missing.' });
    }

    const data = await studentDashboardService.getStudentAttendanceSummary(userId);
    return res.json({ success: true, data });
  } catch (err: any) {
    logger.error('GET_STUDENT_ATTENDANCE_SUMMARY_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to load attendance summary.' });
  }
};

/**
 * GET /api/student/attendance/history
 * Authenticated student's date-wise session attendance history
 */
export const getStudentAttendanceHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Student session missing.' });
    }

    const { subjectId, startDate, endDate } = req.query;

    const data = await studentDashboardService.getStudentAttendanceHistory(userId, {
      subjectId: subjectId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    logger.error('GET_STUDENT_ATTENDANCE_HISTORY_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to load attendance history.' });
  }
};

/**
 * GET /api/student/marks
 * Authenticated student's published CIE marks (STRICTLY published only)
 */
export const getStudentMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Student session missing.' });
    }

    const semester = req.query.semester ? Number(req.query.semester) : undefined;
    const data = await studentDashboardService.getStudentPublishedMarks(userId, semester);
    return res.json({ success: true, data });
  } catch (err: any) {
    logger.error('GET_STUDENT_MARKS_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to load marks.' });
  }
};

/**
 * GET /api/student/profile
 * Authenticated student's read-only admission profile (NO document download/preview)
 */
export const getStudentProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Student session missing.' });
    }

    const data = await studentDashboardService.getStudentProfile(userId);
    return res.json({ success: true, data });
  } catch (err: any) {
    logger.error('GET_STUDENT_PROFILE_ERROR:', err);
    return res.status(404).json({ success: false, error: err.message || 'Failed to load student profile.' });
  }
};
