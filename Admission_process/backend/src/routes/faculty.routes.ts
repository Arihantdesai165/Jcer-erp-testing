import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as facultyController from '../controllers/faculty.controller';

const router = express.Router();

// Base middleware for all faculty routes
const facultyAuthGuard = [
  authMiddleware as any,
  authorizeRoles('TEACHER', 'FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN') as any,
];

// ── Faculty Dashboard & Overview ─────────────────────────────────────────────
router.get('/dashboard', ...facultyAuthGuard, facultyController.getFacultyDashboard as any);
router.get('/assignments', ...facultyAuthGuard, facultyController.getFacultyAssignments as any);

// ── Faculty Attendance Workspace & Corrections ───────────────────────────────
router.get('/attendance', ...facultyAuthGuard, facultyController.getFacultyAttendanceList as any);
router.get('/attendance/students/search', ...facultyAuthGuard, facultyController.searchFacultyStudents as any);
router.get('/attendance/students/:studentId', ...facultyAuthGuard, facultyController.getFacultyStudentAttendance as any);
router.get('/attendance/:assignmentId', ...facultyAuthGuard, facultyController.getFacultyAttendanceWorkspace as any);
router.get('/attendance/:assignmentId/export', ...facultyAuthGuard, facultyController.exportFacultyAttendanceExcel as any);
router.post('/attendance/:assignmentId', ...facultyAuthGuard, facultyController.saveFacultyAttendance as any);
router.get('/attendance/history/:assignmentId', ...facultyAuthGuard, facultyController.getFacultyAttendanceHistory as any);
router.get('/attendance/complete-history/:assignmentId', ...facultyAuthGuard, facultyController.getFacultyCompleteAttendanceHistory as any);
router.post('/attendance/schedule-session/:assignmentId', ...facultyAuthGuard, facultyController.scheduleFacultyClassSession as any);
router.post('/attendance/cancel-session/:sessionId', ...facultyAuthGuard, facultyController.cancelFacultyClassSession as any);
router.get('/attendance/session/:sessionId', ...facultyAuthGuard, facultyController.getFacultyAttendanceSessionDetail as any);
router.post('/attendance/session/:sessionId/correction', ...facultyAuthGuard, facultyController.correctFacultyAttendance as any);
router.get('/attendance/corrections/:assignmentId', ...facultyAuthGuard, facultyController.getFacultyAttendanceCorrections as any);

// ── Faculty Analytics ────────────────────────────────────────────────────────
router.get('/analytics', ...facultyAuthGuard, facultyController.getFacultyAnalytics as any);

export default router;
