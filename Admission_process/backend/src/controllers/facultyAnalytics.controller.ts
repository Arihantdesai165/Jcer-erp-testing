import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import facultyAnalyticsService from '../services/facultyAnalytics.service';
import logger from '../utils/logger.util';

/**
 * GET /api/faculty/analytics/semesters
 * Retrieves assigned semesters with KPI summary for authenticated faculty
 */
export const getFacultyAnalyticsSemesters = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const academicYear = req.query.academicYear as string;
    const semesters = await facultyAnalyticsService.getAnalyticsSemesters(userId, academicYear);

    return res.json({
      success: true,
      data: semesters,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ANALYTICS_SEMESTERS_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve analytics semesters.' });
  }
};

/**
 * GET /api/faculty/analytics/subjects
 * Retrieves assigned subjects for a specific semester for authenticated faculty
 */
export const getFacultyAnalyticsSubjects = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const semester = parseInt(req.query.semester as string, 10);
    const academicYear = req.query.academicYear as string;

    if (isNaN(semester)) {
      return res.status(400).json({ error: 'Valid semester number is required.' });
    }

    const subjects = await facultyAnalyticsService.getAnalyticsSubjects(userId, semester, academicYear);

    return res.json({
      success: true,
      data: subjects,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ANALYTICS_SUBJECTS_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve analytics subjects.' });
  }
};

/**
 * GET /api/faculty/analytics/attendance
 * Retrieves deep attendance analytics for a subject and section
 */
export const getFacultyAnalyticsAttendance = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const section = req.query.section as string;
    const academicYear = req.query.academicYear as string;
    const dateRange = req.query.dateRange as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester number are required.' });
    }

    const analytics = await facultyAnalyticsService.getAnalyticsAttendance(userId, {
      subjectId,
      semester,
      section,
      academicYear,
      dateRange,
    });

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ANALYTICS_ATTENDANCE_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to retrieve attendance analytics.' });
  }
};

/**
 * GET /api/faculty/analytics/marks
 * Retrieves deep academic marks analytics for a subject and section
 */
export const getFacultyAnalyticsMarks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const section = req.query.section as string;
    const academicYear = req.query.academicYear as string;
    const assessmentType = req.query.assessmentType as 'CIE1' | 'CIE2' | 'SEE';

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester number are required.' });
    }

    const analytics = await facultyAnalyticsService.getAnalyticsMarks(userId, {
      subjectId,
      semester,
      section,
      academicYear,
      assessmentType,
    });

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ANALYTICS_MARKS_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to retrieve academic marks analytics.' });
  }
};
