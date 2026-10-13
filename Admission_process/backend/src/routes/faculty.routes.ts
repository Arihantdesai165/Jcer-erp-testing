import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as facultyController from '../controllers/faculty.controller';
import * as facultyAnalyticsController from '../controllers/facultyAnalytics.controller';

const router = express.Router();

// Base middleware for all faculty routes
const facultyAuthGuard = [
  authMiddleware as any,
  authorizeRoles('TEACHER', 'FACULTY', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN') as any,
];

// ── Faculty Dashboard & Overview ─────────────────────────────────────────────
router.get('/dashboard', ...facultyAuthGuard, facultyController.getFacultyDashboard as any);
router.get('/assignments', ...facultyAuthGuard, facultyController.getFacultyAssignments as any);
router.get('/teaching-profile', ...facultyAuthGuard, facultyController.getFacultyTeachingProfile as any);

// ── Faculty Attendance Workspace & Corrections ───────────────────────────────
router.get('/all-subject-attendance/cohorts', ...facultyAuthGuard, facultyController.getFacultyAllSubjectAttendanceCohorts as any);
router.get('/all-subject-attendance/register', ...facultyAuthGuard, facultyController.getFacultyAllSubjectAttendanceRegister as any);
router.get('/all-subject-attendance/export', ...facultyAuthGuard, facultyController.exportFacultyAllSubjectAttendanceExcel as any);
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
router.get('/analytics/semesters', ...facultyAuthGuard, facultyAnalyticsController.getFacultyAnalyticsSemesters as any);
router.get('/analytics/subjects', ...facultyAuthGuard, facultyAnalyticsController.getFacultyAnalyticsSubjects as any);
router.get('/analytics/attendance', ...facultyAuthGuard, facultyAnalyticsController.getFacultyAnalyticsAttendance as any);
router.get('/analytics/marks', ...facultyAuthGuard, facultyAnalyticsController.getFacultyAnalyticsMarks as any);
router.get('/analytics', ...facultyAuthGuard, facultyController.getFacultyAnalytics as any);

export default router;
