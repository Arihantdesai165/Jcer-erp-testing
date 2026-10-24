import { Router } from 'express';
import * as systemController from '../controllers/system.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/rbac.middleware';

import { getBranches } from '../controllers/admission.controller';

const router = Router();

router.get('/academic-years', systemController.getAcademicYears as any);
router.post('/academic-years', authMiddleware as any, authorizeRoles('ADMIN', 'SUPER_ADMIN') as any, systemController.createAcademicYear as any);
router.post('/academic-years/generate', authMiddleware as any, authorizeRoles('ADMIN', 'SUPER_ADMIN') as any, systemController.generateAcademicYears as any);
router.post('/academic-years/active', authMiddleware as any, authorizeRoles('ADMIN', 'SUPER_ADMIN') as any, systemController.setActiveAcademicYear as any);
router.get('/semesters', systemController.getSemesters as any);
router.put('/semesters/:id', authMiddleware as any, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'DEAN') as any, systemController.updateSemester as any);
router.get('/config', systemController.getConfig as any);
router.get('/health', systemController.getHealth as any);
router.get('/db-status', authMiddleware as any, authorizeRoles('SUPER_ADMIN') as any, systemController.dbStatus as any);
router.get('/version', systemController.getVersion as any);
router.get('/features', systemController.getFeatures as any);
router.get('/branches', getBranches as any);

export default router;
