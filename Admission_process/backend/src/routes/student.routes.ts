import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as studentController from '../controllers/student.controller';

const router = express.Router();

// Strict security: Authenticate JWT session & Authorize STUDENT role
// (Admin and Dean can also be permitted if inspecting in student mode)
router.use(authMiddleware as any);
router.use(authorizeRoles('STUDENT', 'ADMIN', 'SUPER_ADMIN', 'DEAN') as any);

// ── 1. Student Academic Overview ──────────────────────────────────────────────
router.get('/overview', studentController.getStudentOverview as any);

// ── 2. Attendance Summary & History ───────────────────────────────────────────
router.get('/attendance/summary', studentController.getStudentAttendanceSummary as any);
router.get('/attendance/history', studentController.getStudentAttendanceHistory as any);

// ── 3. Published CIE Marks ────────────────────────────────────────────────────
router.get('/marks', studentController.getStudentMarks as any);

// ── 4. Read-Only Admission Profile ────────────────────────────────────────────
router.get('/profile', studentController.getStudentProfile as any);

export default router;
