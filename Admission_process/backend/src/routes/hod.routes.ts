import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import { resolveHodDepartmentScope } from '../middleware/hodScope.middleware';
import * as hodController from '../controllers/hod.controller';

const router = express.Router();

// ─── Base Security Pipeline ──────────────────────────────────────────────────
// 1. Authenticate JWT session
router.use(authMiddleware as any);
// 2. Authorize HOD / Admin / Dean / Principal roles
router.use(authorizeRoles('HOD', 'ADMIN', 'SUPER_ADMIN', 'DEAN', 'PRINCIPAL') as any);
// 3. Resolve and enforce strict departmental scope
router.use(resolveHodDepartmentScope as any);

// ─── 1. Dashboard & Overview ─────────────────────────────────────────────────
router.get('/dashboard', hodController.getHodDashboard as any);
router.get('/department', hodController.getHodDepartment as any);

// ─── 2. Students Module & Section Allocation ───────────────────────────────────
router.get('/students', hodController.getHodStudents as any);
router.get('/students/semesters', hodController.getHodStudentSemesters as any);
router.get('/students/semesters/:semesterId', hodController.getHodSemesterCohort as any);
router.get('/semesters/:semesterId/cohort', hodController.getHodSemesterCohort as any);
router.get('/students/sections', hodController.getHodStudentSections as any);
router.get('/students/:id', hodController.getHodStudentById as any);

// Section Creation & Allocation APIs (Supported under both /sections and /students/sections)
router.get('/sections/branches-overview', hodController.getHodSectionsBranchesOverview as any);
router.get('/students/sections/branches-overview', hodController.getHodSectionsBranchesOverview as any);
router.get('/sections', hodController.getHodSections as any);
router.post('/sections', hodController.createHodSection as any);
router.post('/sections/distribute', hodController.bulkDistributeStudents as any);
router.get('/sections/:sectionId', hodController.getHodSectionById as any);
router.put('/sections/:sectionId', hodController.updateHodSection as any);
router.delete('/sections/:sectionId', hodController.deleteHodSection as any);
router.get('/sections/:sectionId/students', hodController.getHodSectionStudents as any);
router.get('/sections/:sectionId/cohort', hodController.getHodSectionCohort as any);
router.post('/sections/:sectionId/students', hodController.bulkAllocateStudentsToSection as any);
router.post('/sections/:sectionId/bulk-allocate', hodController.bulkAllocateStudentsToSection as any);
router.post('/sections/:sectionId/unallocate-all', hodController.unallocateAllStudentsFromSection as any);
router.patch('/sections/:sectionId/students/:studentId/move', hodController.moveStudentSection as any);
router.delete('/sections/:sectionId/students/:studentId/remove', hodController.removeStudentFromSection as any);
router.post('/sections/:sectionId/students/:studentId/remove', hodController.removeStudentFromSection as any);

// Compatibility aliases for /students/sections/*
router.post('/students/sections', hodController.createHodSection as any);
router.post('/students/sections/distribute', hodController.bulkDistributeStudents as any);
router.get('/students/sections/:sectionId', hodController.getHodSectionById as any);
router.put('/students/sections/:sectionId', hodController.updateHodSection as any);
router.delete('/students/sections/:sectionId', hodController.deleteHodSection as any);
router.get('/students/sections/:sectionId/students', hodController.getHodSectionStudents as any);
router.get('/students/sections/:sectionId/cohort', hodController.getHodSectionCohort as any);
router.post('/students/sections/:sectionId/bulk-allocate', hodController.bulkAllocateStudentsToSection as any);
router.post('/students/sections/:sectionId/unallocate-all', hodController.unallocateAllStudentsFromSection as any);
router.patch('/students/sections/:sectionId/students/:studentId/move', hodController.moveStudentSection as any);
router.delete('/students/sections/:sectionId/students/:studentId/remove', hodController.removeStudentFromSection as any);

// ─── 3. Faculty Management & Authorization Module ────────────────────────────
router.get('/departments', hodController.getHodDepartments as any);
router.get('/faculty', hodController.getHodFacultyList as any);
router.post('/faculty', (_req, res) => {
  return res.status(403).json({
    error: 'Faculty creation by HOD has been discontinued. Faculty members are created globally by the Dean.'
  });
});
router.get('/faculty/assignments', hodController.getHodFacultyAssignments as any);
router.get('/faculty-assignments', hodController.getHodFacultyAssignments as any);
router.get('/faculty/:id', hodController.getHodFacultyDetail as any);
router.post('/faculty/:id/assignment', hodController.assignFacultySubject as any);
router.post('/faculty/assign', hodController.assignFacultySubject as any);
router.delete('/faculty/assignment/:assignmentId', hodController.deleteFacultyAssignment as any);
router.delete('/faculty/:id/assignment/:assignmentId', hodController.deleteFacultyAssignment as any);
router.post('/faculty/assignment/:assignmentId/unallocate', hodController.deleteFacultyAssignment as any);
router.delete('/teaching-allocations/:allocationId', hodController.deleteFacultyAssignment as any);
router.post('/teaching-allocations/:allocationId/unallocate', hodController.deleteFacultyAssignment as any);
router.patch('/faculty/:id', hodController.updateFacultyAssignment as any);
router.put('/faculty/:id/assignment', hodController.updateFacultyAssignment as any);
router.put('/faculty/assignment/:id', hodController.updateFacultyAssignment as any);
router.patch('/faculty/:id/assignment', hodController.updateFacultyAssignment as any);
router.patch('/faculty/:id/access', hodController.toggleFacultyAccess as any);
router.post('/faculty/:id/reset-password', hodController.resetFacultyPassword as any);
router.patch('/faculty/:id/status', hodController.toggleFacultyStatus as any);
router.post('/faculty/:id/deactivate', hodController.deactivateFaculty as any);
router.post('/faculty/:id/remove-from-department', hodController.removeFacultyFromTeachingDepartment as any);
router.post('/faculty/assignment/:assignmentId/transfer', hodController.transferFacultyAssignment as any);
router.get('/faculty/assignment/:assignmentId/history', hodController.getFacultyAssignmentHistory as any);
router.post('/teaching-allocations/:allocationId/transfer', hodController.transferFacultyAssignment as any);
router.get('/teaching-allocations/:allocationId/history', hodController.getFacultyAssignmentHistory as any);
router.post('/:allocationId/transfer', hodController.transferFacultyAssignment as any);
router.get('/:allocationId/history', hodController.getFacultyAssignmentHistory as any);



// ─── 4. Subjects & Academic Scheme Module ──────────────────────────────────
router.get('/scheme', hodController.getHodDepartmentScheme as any);
router.put('/scheme', hodController.updateHodDepartmentScheme as any);
router.post('/scheme', hodController.updateHodDepartmentScheme as any);
router.get('/department/scheme', hodController.getHodDepartmentScheme as any);
router.put('/department/scheme', hodController.updateHodDepartmentScheme as any);

router.get('/subjects', hodController.getHodSubjects as any);
router.post('/subjects', hodController.createHodSubject as any);
router.get('/subjects/:id/deletion-check', hodController.checkSubjectDeletion as any);
router.put('/subjects/:id', hodController.updateHodSubject as any);
router.patch('/subjects/:id', hodController.updateHodSubject as any);
router.delete('/subjects/:id', hodController.deleteHodSubject as any);
router.post('/subjects/assign', hodController.assignHodSubject as any);
router.get('/subjects/assignments', hodController.getHodSubjectAssignments as any);
router.get('/subjects/semesters', hodController.getHodSubjectSemesters as any);

// ─── 5. Attendance Module ────────────────────────────────────────────────────
router.get('/attendance', hodController.getHodAttendanceOverview as any);
router.get('/attendance/overview', hodController.getHodAttendanceOverview as any);
router.get('/attendance/semester', hodController.getHodAttendanceSemester as any);
router.get('/attendance/subject', hodController.getHodAttendanceSubject as any);
router.get('/attendance/section', hodController.getHodAttendanceSection as any);
router.get('/attendance/defaulters', hodController.getHodAttendanceDefaulters as any);
router.get('/attendance/sessions', hodController.getHodAttendanceSessions as any);
router.get('/attendance/consolidated-report', hodController.getConsolidatedAttendanceReport as any);
router.post('/attendance/consolidated-sync', hodController.syncConsolidatedAttendance as any);
router.get('/attendance/consolidated-download', hodController.downloadConsolidatedAttendance as any);

// ─── 6. Academics Module ─────────────────────────────────────────────────────
router.get('/academics', hodController.getHodAcademicsOverview as any);
router.get('/academics/overview', hodController.getHodAcademicsOverview as any);
router.get('/academics/subjects', hodController.getHodAcademicsSubjects as any);
router.get('/academics/bitwise', hodController.getHodBitwiseAnalysis as any);
router.get('/academics/students', hodController.getHodStudentPerformance as any);
router.get('/academics/performance', hodController.getHodStudentPerformance as any);


// ─── 7. Reports & Settings Module ────────────────────────────────────────────
router.get('/reports', hodController.getHodReports as any);
router.get('/settings', hodController.getHodSettings as any);
router.patch('/settings', hodController.updateHodSettings as any);
router.put('/settings/profile', hodController.updateHodProfile as any);
router.put('/settings/password', hodController.updateHodPassword as any);
router.post('/profile/change-password', hodController.updateHodPassword as any);

// ─── 9. Subject Handling Requests (Teaching Responsibilities) ────────────────
router.get('/subject-handling/teaching-responsibilities', hodController.getHodTeachingResponsibilities as any);
router.get('/subject-handling/available-subjects', hodController.getAvailableSubjectsForHandling as any);
router.post('/subject-handling/requests', hodController.createSubjectHandlingRequest as any);
router.get('/subject-handling/requests', hodController.getHodSubjectHandlingRequests as any);

export default router;

