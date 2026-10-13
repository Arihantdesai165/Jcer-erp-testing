import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import { uploadDocuments, uploadFeeReceiptMiddleware, singleDocumentValidationMiddleware, resolveStudentUserId } from '../middleware/upload.middleware';
import * as admissionController from '../controllers/admission.controller';
import * as existingOnboardingController from '../controllers/existing-student-onboarding.controller';

const router = express.Router();
const onboardingUpload = multer({ storage: multer.memoryStorage() });
const safeUploadSingleFile = (req: any, res: any, next: any) => {
  onboardingUpload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'File upload failed' });
    }
    next();
  });
};

// ─── Public ──────────────────────────────────────────────────────────────────
// Branches list (used by Step 1 dropdown — accessible to logged-in students)
router.get('/branches', authMiddleware, admissionController.getBranches);

// ─── Student Routes ───────────────────────────────────────────────────────────
const studentRouter = express.Router();
studentRouter.use(authMiddleware);
studentRouter.use(authorizeRoles('STUDENT'));

studentRouter.get('/my-admission', admissionController.getMyAdmission);
studentRouter.get('/step-status', admissionController.getStepStatus);
studentRouter.get('/admission/step/:stepName', admissionController.getStepData);

// Form steps
studentRouter.post('/create', admissionController.saveStep1);         // Step 1
studentRouter.put('/personal', admissionController.saveStep2);        // Step 2
studentRouter.put('/parent', admissionController.saveStep3);           // Step 3
studentRouter.put('/address', admissionController.saveStep4);          // Step 4
studentRouter.put('/academic', admissionController.saveStep5);         // Step 5
studentRouter.post('/validate-document', singleDocumentValidationMiddleware, admissionController.validateSingleDocument); // Instant single document quality validation
studentRouter.post('/documents', uploadDocuments, admissionController.saveStep6); // Step 6
studentRouter.delete('/documents/:field', admissionController.removeDocument);
studentRouter.get('/documents/:field', admissionController.getStudentDocument); // Secure R2 signed URL
studentRouter.post('/submit', admissionController.submitApplication);  // Step 7

// Uniqueness checks
studentRouter.post('/check-aadhaar', admissionController.checkAadhaar);
studentRouter.post('/check-cet', admissionController.checkCet);

// Cancellation
studentRouter.post('/cancellation-request', admissionController.requestAdmissionCancellation);

// Fee Receipt Upload
studentRouter.post('/upload-fee-receipt', uploadFeeReceiptMiddleware, admissionController.uploadFeeReceipt);

// ─── Application routes (student) ─────────────────────────────────────────────
const applicationRouter = express.Router();
applicationRouter.use(authMiddleware);
applicationRouter.use(authorizeRoles('STUDENT'));

applicationRouter.get('/full-details', admissionController.getFullDetails);
applicationRouter.get('/download-pdf', admissionController.downloadPDF);
applicationRouter.get('/handbook', admissionController.downloadHandbook);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
const adminAdmissionRouter = express.Router();
adminAdmissionRouter.use(authMiddleware);
adminAdmissionRouter.use((req, res, next) => {
  // Allow HOD read-only access to view student admission details and documents
  const isHodAllowedPath = (
    req.method === 'GET' &&
    (
      /^\/admissions\/[^/]+$/.test(req.path) ||
      /^\/admissions\/[^/]+\/documents\/[^/]+$/.test(req.path)
    )
  );
  if (isHodAllowedPath) {
    return authorizeRoles('ADMIN', 'SUPER_ADMIN', 'ADMINISTRATOR', 'PRINCIPAL', 'HOD')(req, res, next);
  }
  return authorizeRoles('ADMIN', 'SUPER_ADMIN', 'ADMINISTRATOR', 'PRINCIPAL')(req, res, next);
});

// Existing Student Onboarding Routes
adminAdmissionRouter.get('/onboarding/existing-students/context', existingOnboardingController.getOnboardingContext);
adminAdmissionRouter.get('/students/existing-onboarding/context', existingOnboardingController.getOnboardingContext);
adminAdmissionRouter.get('/onboarding/existing-students/template', existingOnboardingController.downloadExistingStudentsTemplate);
adminAdmissionRouter.get('/students/existing-onboarding/template', existingOnboardingController.downloadExistingStudentsTemplate);
adminAdmissionRouter.post('/onboarding/existing-students/validate', safeUploadSingleFile, existingOnboardingController.validateExistingStudents);
adminAdmissionRouter.post('/students/existing-onboarding/validate', safeUploadSingleFile, existingOnboardingController.validateExistingStudents);
adminAdmissionRouter.post('/onboarding/existing-students/import', existingOnboardingController.importExistingStudents);
adminAdmissionRouter.post('/students/existing-onboarding/import', existingOnboardingController.importExistingStudents);
adminAdmissionRouter.get('/onboarding/existing-students/history', existingOnboardingController.getOnboardingHistory);
adminAdmissionRouter.get('/students/existing-onboarding/history', existingOnboardingController.getOnboardingHistory);

adminAdmissionRouter.get('/usn/eligible', admissionController.listUsnEligibleApplicants);
adminAdmissionRouter.get('/usn/summary', admissionController.getUsnSummary);
adminAdmissionRouter.post('/usn/bulk-assign', admissionController.bulkAssignUsns);
adminAdmissionRouter.post('/usn/validate-import', admissionController.validateImportUsns);
adminAdmissionRouter.patch('/usn/:id', admissionController.assignSingleUsn);
adminAdmissionRouter.delete('/usn/:id', admissionController.removeUsn);

adminAdmissionRouter.get('/documents/export/preview', admissionController.previewBulkExport);
adminAdmissionRouter.get('/documents/export', admissionController.bulkExportDocuments);
adminAdmissionRouter.post('/documents/bulk-export', admissionController.startBulkExportJob);
adminAdmissionRouter.get('/documents/bulk-export/active', admissionController.getActiveBulkExportJob);
adminAdmissionRouter.get('/documents/bulk-export/:jobId/download', admissionController.getBulkExportDownloadUrl);
adminAdmissionRouter.get('/documents/bulk-export/:jobId/download-file', admissionController.downloadBulkExportZipFile);
adminAdmissionRouter.get('/documents/bulk-export/:jobId', admissionController.getBulkExportJobStatus);
adminAdmissionRouter.get('/students/:studentId/documents', admissionController.getStudentDocuments);
adminAdmissionRouter.get('/admissions/:id/documents/zip', admissionController.exportSingleStudentZip);

adminAdmissionRouter.delete('/admissions/bulk-delete-cancelled', authorizeRoles('ADMIN', 'SUPER_ADMIN'), admissionController.bulkDeleteCancelledAdmissions);
adminAdmissionRouter.delete('/admissions/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), admissionController.deleteAdmissionById);
adminAdmissionRouter.get('/admissions/batches', admissionController.getAvailableBatches);
adminAdmissionRouter.get('/admissions', admissionController.listAdmissions);
adminAdmissionRouter.get('/admissions/:id/documents/:field', admissionController.viewAdmissionDocument);
adminAdmissionRouter.get('/admissions/:id', admissionController.getAdmissionById);
adminAdmissionRouter.put('/admissions/:id', admissionController.updateAdmissionDetails);
adminAdmissionRouter.post('/admissions/:id/documents', resolveStudentUserId, uploadDocuments, admissionController.saveAdminDocuments);
adminAdmissionRouter.delete('/admissions/:id/documents/:field', resolveStudentUserId, admissionController.removeAdminDocument);
adminAdmissionRouter.put('/admissions/:id/status', admissionController.updateAdmissionStatus);
adminAdmissionRouter.put('/admissions/:id/verify', admissionController.verifyAdmissionChecklist);
adminAdmissionRouter.put('/admissions/:id/documents/status', admissionController.saveDocumentStatuses);
adminAdmissionRouter.post('/admissions/:id/fee-verify', admissionController.verifyFeeReceipt);
adminAdmissionRouter.post('/admissions/:id/cancellation-process', admissionController.processCancellationRequest);
adminAdmissionRouter.post('/admissions/:id/cancellation-direct', admissionController.directCancelAdmission);
adminAdmissionRouter.get('/stats', admissionController.getAdminStats);

export { studentRouter, applicationRouter, adminAdmissionRouter };
export default router;
