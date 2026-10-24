import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as adminController from '../controllers/admin.controller';
import * as userManagementController from '../controllers/user-management.controller';
import * as onboardingController from '../controllers/onboarding.controller';
import * as existingOnboardingController from '../controllers/existing-student-onboarding.controller';
import multer from 'multer';

import { handbookUpload } from '../middleware/upload.middleware';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Existing Student Onboarding Template (Blank standard spreadsheet format - publicly accessible asset)
router.get('/onboarding/existing-students/template', existingOnboardingController.downloadExistingStudentsTemplate);

router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN', 'ADMINISTRATOR', 'PRINCIPAL'));

// Dashboard & Stats
router.get('/dashboard', adminController.getDashboardData);
router.get('/user-stats', adminController.getUserStats);
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAnalyticsData);
router.get('/profile', adminController.getProfile);
router.post('/credentials/dispatch', adminController.dispatchCredentials);
router.get('/credentials/pending', adminController.getPendingCredentials);
router.post('/credentials/bulk-dispatch', adminController.bulkDispatchCredentials);

// User Management (Students, Teachers, HODs, Principals, Parents)
router.get('/users/students', userManagementController.getStudents);
router.put('/users/students/:id', userManagementController.updateStudent);
router.get('/users/teachers', userManagementController.getTeachers);
router.put('/users/teachers/:id', userManagementController.updateTeacher);
router.get('/users/principals', userManagementController.getPrincipals);
router.get('/users/hods', userManagementController.getHODs);
router.get('/users/parents', userManagementController.getParents);
router.post('/users/bulk-onboard', upload.single('file'), userManagementController.bulkOnboardUsers);

// Settings and Logs
router.get('/logs', adminController.getAuditLogs);
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.post('/settings/handbook', handbookUpload.single('handbookPdf'), adminController.uploadHandbook);

// Bulk Onboarding (USN Registry & Students)
router.post('/onboarding/usn-registry', upload.single('file'), onboardingController.uploadUSNRegistry);
router.get('/onboarding/usn-registry', onboardingController.getUSNRegistry);
router.post('/onboarding/students/bulk', upload.single('file'), onboardingController.bulkUploadStudents);

// Existing Student Onboarding (Pre-ERP Students)
const safeUploadSingleFile = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'File upload failed' });
    }
    next();
  });
};

router.get('/onboarding/existing-students/context', existingOnboardingController.getOnboardingContext);
router.get('/onboarding/existing-students/template', existingOnboardingController.downloadExistingStudentsTemplate);
router.post('/onboarding/existing-students/validate', safeUploadSingleFile, existingOnboardingController.validateExistingStudents);
router.post('/onboarding/existing-students/import', existingOnboardingController.importExistingStudents);
router.get('/onboarding/existing-students/history', existingOnboardingController.getOnboardingHistory);

// Route aliases matching frontend page URL pattern
router.get('/students/existing-onboarding/context', existingOnboardingController.getOnboardingContext);
router.get('/students/existing-onboarding/template', existingOnboardingController.downloadExistingStudentsTemplate);
router.post('/students/existing-onboarding/validate', safeUploadSingleFile, existingOnboardingController.validateExistingStudents);
router.post('/students/existing-onboarding/import', existingOnboardingController.importExistingStudents);
router.get('/students/existing-onboarding/history', existingOnboardingController.getOnboardingHistory);

export default router;
