import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';
import * as googleDriveController from '../controllers/googleDrive.controller';

const router = express.Router();

// Dean / Admin authorization guard for Google Drive management
const deanAdminGuard = [
  authMiddleware as any,
  authorizeRoles('DEAN', 'ADMIN', 'SUPER_ADMIN') as any,
];

// ── Google OAuth Routes ──────────────────────────────────────────────────────
// Initiate Google OAuth (redirects Dean to Google Consent Screen)
router.get('/google/oauth', ...deanAdminGuard, googleDriveController.initiateOAuth as any);

// Google OAuth Redirect URI callback (Public endpoint, called by Google with auth code & state)
router.get('/google/oauth/callback', googleDriveController.handleOAuthCallback as any);

// ── Google Drive Integration Management Routes (Dean / Admin only) ───────────
router.get('/google-drive/status', ...deanAdminGuard, googleDriveController.getStatus as any);
router.post('/google-drive/test-connection', ...deanAdminGuard, googleDriveController.testConnection as any);
router.post('/google-drive/disconnect', ...deanAdminGuard, googleDriveController.disconnect as any);
router.post('/google-drive/toggle-auto-backup', ...deanAdminGuard, googleDriveController.toggleAutoBackup as any);
router.post('/google-drive/retry-failed', ...deanAdminGuard, googleDriveController.retryFailedBackups as any);
router.post('/google-drive/backup-subject/:assignmentId', ...deanAdminGuard, googleDriveController.triggerSubjectBackup as any);

export default router;
