import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import bitwiseMarksService from '../services/bitwiseMarks.service';
import bitwiseMarksBackupQueueService from '../services/bitwiseMarksBackupQueue.service';
import logger from '../utils/logger.util';

/**
 * GET /api/faculty/marks/semesters
 * Retrieves assigned semesters for faculty with real progress stats
 */
export const getAssignedSemesters = async (
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
    const semesters = await bitwiseMarksService.getAuthorizedSemesters(userId, academicYear);

    return res.json({
      success: true,
      data: semesters,
    });
  } catch (error: any) {
    logger.error('GET_ASSIGNED_SEMESTERS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to retrieve semesters.' });
  }
};

/**
 * GET /api/faculty/marks/semesters/:semester/subjects
 * Retrieves assigned subjects in a semester for the faculty
 */
export const getAssignedSubjects = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const semester = parseInt(req.params.semester, 10);
    if (isNaN(semester)) {
      return res.status(400).json({ error: 'Invalid semester parameter.' });
    }

    const academicYear = req.query.academicYear as string;
    const subjects = await bitwiseMarksService.getAuthorizedSubjectsForSemester(userId, semester, academicYear);

    return res.json({
      success: true,
      data: subjects,
    });
  } catch (error: any) {
    logger.error('GET_ASSIGNED_SUBJECTS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to retrieve subjects.' });
  }
};

/**
 * GET /api/faculty/marks/config
 * Retrieves assessment question pattern configuration (CIE1 or CIE2)
 */
export const getAssessmentConfiguration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const assessmentType = (req.query.assessmentType as 'CIE1' | 'CIE2') || 'CIE1';
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const config = await bitwiseMarksService.getAssessmentConfiguration(
      userId,
      subjectId,
      semester,
      assessmentType,
      academicYear
    );

    return res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    logger.error('GET_ASSESSMENT_CONFIG_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Unauthorized or failed to load configuration.' });
  }
};

/**
 * POST /api/faculty/marks/config
 * Saves/Updates assessment question pattern configuration
 */
export const saveAssessmentConfiguration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, assessmentType, questionPattern, attemptRules, maximumMarks, confirmIncompatibleChange, academicYear } = req.body;

    if (!subjectId || !semester || !assessmentType) {
      return res.status(400).json({ error: 'subjectId, semester, and assessmentType are required.' });
    }

    const result = await bitwiseMarksService.saveAssessmentConfiguration(
      userId,
      subjectId,
      parseInt(semester, 10),
      assessmentType,
      {
        questionPattern,
        attemptRules,
        maximumMarks,
        confirmIncompatibleChange,
      },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_ASSESSMENT_CONFIG_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save assessment configuration.' });
  }
};

/**
 * GET /api/faculty/marks/workspace
 * Retrieves question-wise marks grid for consolidated students
 */
export const getMarksWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const assessmentType = (req.query.assessmentType as 'CIE1' | 'CIE2') || 'CIE1';
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const workspace = await bitwiseMarksService.getQuestionWiseMarksWorkspace(
      userId,
      subjectId,
      semester,
      assessmentType,
      academicYear
    );

    return res.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    logger.error('GET_MARKS_WORKSPACE_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to load marks workspace.' });
  }
};

/**
 * POST /api/faculty/marks/save
 * Saves student marks (Draft or Authoritative)
 */
export const saveQuestionWiseMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, assessmentType, marks, isDraft, academicYear } = req.body;

    if (!subjectId || !semester || !assessmentType || !Array.isArray(marks)) {
      return res.status(400).json({ error: 'Invalid payload parameters.' });
    }

    const result = await bitwiseMarksService.saveQuestionWiseMarks(
      userId,
      subjectId,
      parseInt(semester, 10),
      assessmentType,
      {
        marks,
        isDraft: Boolean(isDraft),
      },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_MARKS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save marks.' });
  }
};

/**
 * GET /api/faculty/marks/assignments
 * Retrieves Assignment configuration and marks workspace
 */
export const getAssignmentWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const workspace = await bitwiseMarksService.getAssignmentMarksWorkspace(
      userId,
      subjectId,
      semester,
      academicYear
    );

    return res.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    logger.error('GET_ASSIGNMENT_WORKSPACE_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to load assignment workspace.' });
  }
};

/**
 * POST /api/faculty/marks/assignments/config
 * Saves assignment pattern / components configuration
 */
export const saveAssignmentConfiguration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, components, confirmPatternChange, academicYear } = req.body;

    if (!subjectId || !semester || !Array.isArray(components)) {
      return res.status(400).json({ error: 'subjectId, semester, and components array are required.' });
    }

    const result = await bitwiseMarksService.saveAssignmentConfiguration(
      userId,
      subjectId,
      parseInt(semester, 10),
      {
        components,
        confirmPatternChange: Boolean(confirmPatternChange),
      },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_ASSIGNMENT_CONFIG_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save assignment configuration.' });
  }
};

/**
 * POST /api/faculty/marks/assignments
 * Saves assignment configuration and student assignment marks
 */
export const saveAssignmentMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, components, maximumMarks, calculationPolicy, marks, isDraft, academicYear } = req.body;

    if (!subjectId || !semester || !Array.isArray(marks)) {
      return res.status(400).json({ error: 'Invalid assignment payload.' });
    }

    const result = await bitwiseMarksService.saveAssignmentMarks(
      userId,
      subjectId,
      parseInt(semester, 10),
      {
        components,
        maximumMarks,
        calculationPolicy,
        marks,
        isDraft: Boolean(isDraft),
      },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_ASSIGNMENT_MARKS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save assignment marks.' });
  }
};

/**
 * GET /api/faculty/marks/final-internal
 * Retrieves Final Internal Marks sheet
 */
export const getFinalInternalMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const workspace = await bitwiseMarksService.getFinalInternalMarksWorkspace(
      userId,
      subjectId,
      semester,
      academicYear
    );

    return res.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    logger.error('GET_FINAL_INTERNAL_MARKS_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to load final internal marks.' });
  }
};

/**
 * POST /api/faculty/marks/final-internal
 * Saves or Finalizes Final Internal Marks
 */
export const saveFinalInternalMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, finalize, policy, academicYear } = req.body;

    if (!subjectId || !semester) {
      return res.status(400).json({ error: 'Subject ID and semester are required.' });
    }

    const result = await bitwiseMarksService.saveFinalInternalMarks(
      userId,
      subjectId,
      parseInt(semester, 10),
      { finalize: Boolean(finalize), policy },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_FINAL_INTERNAL_MARKS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save final internal marks.' });
  }
};

/**
 * GET /api/faculty/marks/external
 * Retrieves External Examination Marks
 */
export const getExternalMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const workspace = await bitwiseMarksService.getExternalMarksWorkspace(
      userId,
      subjectId,
      semester,
      academicYear
    );

    return res.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    logger.error('GET_EXTERNAL_MARKS_ERROR:', error);
    return res.status(403).json({ error: error.message || 'Failed to load external examination marks.' });
  }
};

/**
 * POST /api/faculty/marks/external
 * Saves External Examination Marks
 */
export const saveExternalMarks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, maximumMarks, marks, academicYear } = req.body;

    if (!subjectId || !semester || !Array.isArray(marks)) {
      return res.status(400).json({ error: 'Invalid payload parameters.' });
    }

    const result = await bitwiseMarksService.saveExternalMarks(
      userId,
      subjectId,
      parseInt(semester, 10),
      {
        maximumMarks,
        marks,
      },
      academicYear
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('SAVE_EXTERNAL_MARKS_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to save external examination marks.' });
  }
};

/**
 * GET /api/faculty/marks/export
 * Downloads the complete multi-sheet Bitwise Marks Excel workbook
 */
export const exportMarksExcel = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const subjectId = req.query.subjectId as string;
    const semester = parseInt(req.query.semester as string, 10);
    const academicYear = req.query.academicYear as string;

    if (!subjectId || isNaN(semester)) {
      return res.status(400).json({ error: 'Subject ID and valid semester are required.' });
    }

    const { buffer, filename } = await bitwiseMarksService.exportSubjectMarksExcel(
      userId,
      subjectId,
      semester,
      academicYear
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error: any) {
    logger.error('EXPORT_MARKS_EXCEL_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to export marks spreadsheet.' });
  }
};

/**
 * POST /api/faculty/marks/sync-retry
 * Retries Google Drive synchronization
 */
export const retryDriveSync = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Session missing.' });
    }

    const { subjectId, semester, academicYear } = req.body;
    if (!subjectId || !semester) {
      return res.status(400).json({ error: 'Subject ID and semester are required.' });
    }

    const { departmentId } = await bitwiseMarksService.verifyFacultySubjectAuthorization(
      userId,
      subjectId,
      parseInt(semester, 10),
      academicYear
    );

    const job = await bitwiseMarksBackupQueueService.queueMarksBackup(
      subjectId,
      parseInt(semester, 10),
      academicYear || '2026-27',
      departmentId,
      'SYNC'
    );

    return res.json({
      success: true,
      message: 'Drive synchronization queued successfully.',
      data: { jobId: job?.id },
    });
  } catch (error: any) {
    logger.error('RETRY_DRIVE_SYNC_ERROR:', error);
    return res.status(400).json({ error: error.message || 'Failed to queue sync retry.' });
  }
};
