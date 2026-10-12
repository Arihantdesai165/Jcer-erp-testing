import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import assessmentWorkflowService from '../services/assessmentWorkflow.service';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import logger from '../utils/logger.util';

// ─── HOD ENDPOINTS ─────────────────────────────────────────────────────────────

/**
 * GET /api/hod/assessments/overview
 * Real database-backed statistics for HOD dashboard
 */
export const getHodOverviewStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const stats = await assessmentWorkflowService.getHodAssessmentOverviewStats(userId);
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    logger.error('GET_HOD_ASSESSMENT_STATS_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to fetch overview stats.' });
  }
};

/**
 * GET /api/hod/assessments
 * List assessment submissions matching authorized semester and department scope
 */
export const getHodSubmissions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const {
      academicYear,
      semester,
      departmentId,
      subjectId,
      assessmentType,
      status,
      search,
    } = req.query;

    const result = await assessmentWorkflowService.getHodAssessmentSubmissions(userId, {
      academicYear: academicYear as string,
      semester: semester ? Number(semester) : undefined,
      departmentId: departmentId as string,
      subjectId: subjectId as string,
      assessmentType: assessmentType as string,
      status: status as string,
      search: search as string,
    });

    return res.json({ success: true, data: result.submissions, scope: result.scope });
  } catch (err: any) {
    logger.error('GET_HOD_SUBMISSIONS_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to fetch submissions.' });
  }
};

/**
 * GET /api/hod/assessments/:id
 * Retrieve detailed marks roster and review history for an assessment
 */
export const getHodReviewDetail = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const assessmentId = req.params.id;
    if (!assessmentId) {
      return res.status(400).json({ success: false, error: 'Assessment ID is required.' });
    }

    const detail = await assessmentWorkflowService.getAssessmentReviewDetail(userId, assessmentId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    logger.error('GET_HOD_REVIEW_DETAIL_ERROR:', err);
    return res.status(403).json({ success: false, error: err.message || 'Failed to fetch assessment review detail.' });
  }
};

/**
 * POST /api/hod/assessments/:id/approve-publish
 * Approve and publish assessment marks
 */
export const approveAndPublishAssessment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const assessmentId = req.params.id;
    const { publishNow } = req.body;

    const result = await assessmentWorkflowService.approveAndPublishAssessment(userId, assessmentId, {
      publishNow: publishNow !== false,
    });

    return res.json({
      success: true,
      message: result.message,
      data: result.assessment,
    });
  } catch (err: any) {
    logger.error('APPROVE_PUBLISH_ASSESSMENT_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to approve and publish assessment.' });
  }
};

/**
 * POST /api/hod/assessments/:id/return
 * Return assessment for correction with mandatory comments
 */
export const returnAssessmentForCorrection = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const assessmentId = req.params.id;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a clear correction comment (minimum 5 characters) explaining what needs revision.',
      });
    }

    const result = await assessmentWorkflowService.returnAssessmentForCorrection(userId, assessmentId, comment);

    return res.json({
      success: true,
      message: result.message,
      data: result.assessment,
    });
  } catch (err: any) {
    logger.error('RETURN_ASSESSMENT_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to return assessment.' });
  }
};

// ─── FACULTY ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * POST /api/faculty/marks/assessments/:id/submit
 * Faculty submits or resubmits marks for HOD review
 */
export const facultySubmitAssessment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing.' });
    }

    const assessmentId = req.params.id;
    const result = await assessmentWorkflowService.submitAssessment(userId, assessmentId);

    return res.json({
      success: true,
      message: result.message,
      data: result.assessment,
    });
  } catch (err: any) {
    logger.error('FACULTY_SUBMIT_ASSESSMENT_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to submit assessment.' });
  }
};

/**
 * GET /api/faculty/marks/assessments/:id/status
 * Faculty checks submission status, lock state, and HOD correction comments
 */
export const getFacultyAssessmentStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const assessmentId = req.params.id;
    const assessment = await AssessmentConfiguration.findByPk(assessmentId);

    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found.' });
    }

    const isLocked = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(assessment.status);
    const isReturned = assessment.status === 'RETURNED';

    return res.json({
      success: true,
      data: {
        id: assessment.id,
        status: assessment.status,
        isLocked,
        isReturned,
        submittedAt: assessment.submittedAt,
        hodReviewComment: assessment.hodReviewComment,
        reviewedAt: assessment.reviewedAt,
        approvedAt: assessment.approvedAt,
        isPublished: assessment.isPublished,
        publishedAt: assessment.publishedAt,
      },
    });
  } catch (err: any) {
    logger.error('GET_FACULTY_ASSESSMENT_STATUS_ERROR:', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to fetch assessment status.' });
  }
};
