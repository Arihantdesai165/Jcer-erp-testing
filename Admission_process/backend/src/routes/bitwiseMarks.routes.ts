import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as bitwiseMarksController from '../controllers/bitwiseMarks.controller';

const router = express.Router();

const facultyAuthGuard = [
  authMiddleware as any,
  authorizeRoles('TEACHER', 'FACULTY', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN') as any,
];

// ── 1. Semester & Subject Navigation ──────────────────────────────────────────
router.get('/semesters', ...facultyAuthGuard, bitwiseMarksController.getAssignedSemesters as any);
router.get('/semesters/:semester/subjects', ...facultyAuthGuard, bitwiseMarksController.getAssignedSubjects as any);

// ── 2. Assessment Configuration (CIE-1 & CIE-2) ──────────────────────────────
router.get('/config', ...facultyAuthGuard, bitwiseMarksController.getAssessmentConfiguration as any);
router.post('/config', ...facultyAuthGuard, bitwiseMarksController.saveAssessmentConfiguration as any);

// ── 3. Question-wise Marks Entry Grid ─────────────────────────────────────────
router.get('/workspace', ...facultyAuthGuard, bitwiseMarksController.getMarksWorkspace as any);
router.post('/save', ...facultyAuthGuard, bitwiseMarksController.saveQuestionWiseMarks as any);

// ── 4. Assignment Marks Entry ─────────────────────────────────────────────────
router.get('/assignments', ...facultyAuthGuard, bitwiseMarksController.getAssignmentWorkspace as any);
router.post('/assignments/config', ...facultyAuthGuard, bitwiseMarksController.saveAssignmentConfiguration as any);
router.post('/assignments', ...facultyAuthGuard, bitwiseMarksController.saveAssignmentMarks as any);

// ── 5. Final Internal Marks Sheet ────────────────────────────────────────────
router.get('/final-internal', ...facultyAuthGuard, bitwiseMarksController.getFinalInternalMarks as any);
router.post('/final-internal', ...facultyAuthGuard, bitwiseMarksController.saveFinalInternalMarks as any);

// ── 6. External Examination Marks ────────────────────────────────────────────
router.get('/external', ...facultyAuthGuard, bitwiseMarksController.getExternalMarks as any);
router.post('/external', ...facultyAuthGuard, bitwiseMarksController.saveExternalMarks as any);

// ── 7. Excel Export & Drive Sync Retry ────────────────────────────────────────
router.get('/export', ...facultyAuthGuard, bitwiseMarksController.exportMarksExcel as any);
router.post('/sync-retry', ...facultyAuthGuard, bitwiseMarksController.retryDriveSync as any);

// ── 8. Assessment Workflow (Submit & Status) ──────────────────────────────────
import * as assessmentWorkflowController from '../controllers/assessmentWorkflow.controller';
router.post('/assessments/:id/submit', ...facultyAuthGuard, assessmentWorkflowController.facultySubmitAssessment as any);
router.get('/assessments/:id/status', ...facultyAuthGuard, assessmentWorkflowController.getFacultyAssessmentStatus as any);

export default router;
