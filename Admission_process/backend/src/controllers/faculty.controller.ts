import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import facultyService from '../services/faculty.service';
import logger from '../utils/logger.util';

/**
 * GET /api/faculty/dashboard
 * Retrieves summary statistics and assigned courses for the logged-in faculty
 */
export const getFacultyDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const academicYear = req.query.academicYear as string;
    const semester = req.query.semester as string;
    const dashboard = await facultyService.getFacultyDashboard(userId, academicYear, semester);
    return res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_DASHBOARD_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/faculty/assignments
 * Retrieves all active teaching assignments for the logged-in faculty
 */
export const getFacultyAssignments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const academicYear = req.query.academicYear as string;
    const assignments = await facultyService.getFacultyAssignments(userId, academicYear);
    return res.json({
      success: true,
      data: assignments,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ASSIGNMENTS_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/faculty/attendance
 * Retrieves attendance-authorized assignments with real calculations
 */
export const getFacultyAttendanceList = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const semester = req.query.semester as string;
    const academicYear = req.query.academicYear as string;
    const courses = await facultyService.getFacultyAttendanceList(userId, semester, academicYear);

    return res.json({
      success: true,
      data: courses,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ATTENDANCE_LIST_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/faculty/attendance/:assignmentId
 * Retrieves detailed attendance workspace for a single authorized assignment
 */
export const getFacultyAttendanceWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.assignmentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }

    const workspace = await facultyService.getFacultyAttendanceWorkspace(userId, assignmentId);
    return res.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ATTENDANCE_WORKSPACE_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Unauthorized attendance access.' });
  }
};



/**
 * GET /api/faculty/analytics
 * Retrieves assignment-scoped analytics for the authenticated faculty
 */
export const getFacultyAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const academicYear = req.query.academicYear as string;
    const analytics = await facultyService.getFacultyAnalytics(userId, academicYear);
    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ANALYTICS_ERROR:', error);
    return next(error);
  }
};

/**
 * POST /api/faculty/attendance/:assignmentId
 * Records or updates attendance session for assigned cohort
 */
export const saveFacultyAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.assignmentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }

    const { date, sessionPeriod, records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid attendance records array.' });
    }

    const updatedWorkspace = await facultyService.saveFacultyAttendance(userId, assignmentId, {
      date,
      sessionPeriod,
      records,
    });

    return res.json({
      success: true,
      message: 'Attendance recorded successfully.',
      data: updatedWorkspace,
    });
  } catch (error: any) {
    logger.error('SAVE_FACULTY_ATTENDANCE_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to record attendance.' });
  }
};



/**
 * GET /api/faculty/attendance/:assignmentId/export
 * Generates and downloads the official Class-wise Attendance Register Excel spreadsheet
 */
export const exportFacultyAttendanceExcel = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.assignmentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }

    const { buffer, filename } = await facultyService.exportFacultyAttendanceExcel(userId, assignmentId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error: any) {
    logger.error('EXPORT_FACULTY_ATTENDANCE_EXCEL_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to export attendance report.' });
  }
};

/**
 * GET /api/faculty/attendance/history/:assignmentId
 * Retrieves past attendance sessions history for an assignment
 */
export const getFacultyAttendanceHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.assignmentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }

    const history = await facultyService.getFacultyAttendanceHistory(userId, assignmentId);
    return res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ATTENDANCE_HISTORY_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to load attendance history.' });
  }
};

/**
 * GET /api/faculty/attendance/session/:sessionId
 * Retrieves detailed session data with student records for correction workspace
 */
export const getFacultyAttendanceSessionDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.sessionId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const detail = await facultyService.getFacultyAttendanceSessionDetail(userId, sessionId);
    return res.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ATTENDANCE_SESSION_DETAIL_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to load session details.' });
  }
};

/**
 * POST /api/faculty/attendance/session/:sessionId/correction
 * Corrects attendance records for a conducted session with audit logging
 */
export const correctFacultyAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.sessionId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const { changes } = req.body;
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty changes array.' });
    }

    const reqMeta = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    };

    const updatedDetail = await facultyService.correctFacultyAttendance(userId, sessionId, { changes }, reqMeta);

    return res.json({
      success: true,
      message: 'Attendance corrected successfully.',
      data: updatedDetail,
    });
  } catch (error: any) {
    logger.error('CORRECT_FACULTY_ATTENDANCE_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to correct attendance.' });
  }
};

/**
 * GET /api/faculty/attendance/corrections/:assignmentId
 * Retrieves all attendance correction audit logs for an assignment
 */
export const getFacultyAttendanceCorrections = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.assignmentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }

    const corrections = await facultyService.getFacultyAssignmentCorrections(userId, assignmentId);
    return res.json({
      success: true,
      data: corrections,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_ATTENDANCE_CORRECTIONS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to load correction history.' });
  }
};

/**
 * GET /api/faculty/attendance/students/search
 * Searches students authorized under the logged-in faculty's active assignments
 */
export const searchFacultyStudents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const query = (req.query.q as string) || '';
    const academicYear = req.query.academicYear as string;
    const semester = req.query.semester as string;

    const results = await facultyService.searchFacultyStudents(userId, query, academicYear, semester);
    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('SEARCH_FACULTY_STUDENTS_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/faculty/attendance/students/:studentId
 * Retrieves student details and authorized subject attendance
 */
export const getFacultyStudentAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const studentId = req.params.studentId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    const academicYear = req.query.academicYear as string;
    const attendanceData = await facultyService.getFacultyStudentAttendance(userId, studentId, academicYear);

    return res.json({
      success: true,
      data: attendanceData,
    });
  } catch (error: any) {
    logger.error('GET_FACULTY_STUDENT_ATTENDANCE_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to retrieve student attendance.' });
  }
};



