import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import assessmentWorkflowService from '../services/assessmentWorkflow.service';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import logger from '../utils/logger.util';



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
