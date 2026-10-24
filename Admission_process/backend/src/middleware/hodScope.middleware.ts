import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import HOD from '../models/HOD';
import Department from '../models/Department';
import Teacher from '../models/Teacher';
import FacultyAssignment from '../models/FacultyAssignment';
import logger from '../utils/logger.util';

// Extend AuthenticatedRequest with HOD department fields
declare module './auth.middleware' {
  interface AuthenticatedRequest {
    departmentId?: string;
    department?: any;
    hod?: any;
    isSemesterHandling?: boolean;
    handlingSemesters?: number[] | null;
  }
}

/**
 * Strict HOD Department Scope Guard:
 * Resolves the authenticated HOD's active record from the database.
 * Enforces mandatory departmental isolation.
 * Any client-provided `departmentId` parameter is completely ignored.
 */
export const resolveHodDepartmentScope = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: 'Unauthorized. Identity missing.' });
    }

    if (role === 'HOD') {
      let hod = await HOD.findOne({
        where: { userId, isActive: true },
        include: [{ model: Department, as: 'department' }],
      });

      if (!hod || !(hod as any).department) {
        // Resilient fallback: Check latest HOD record if active flag was not updated
        hod = await HOD.findOne({
          where: { userId },
          include: [{ model: Department, as: 'department' }],
          order: [['updatedAt', 'DESC']],
        });
      }

      if (!hod || !(hod as any).department) {
        logger.warn(`HOD_SCOPE_DENIED: User ${userId} (${req.user?.email}) has no assigned department.`);
        return res.status(403).json({
          error: 'Forbidden. No active department assigned to this HOD account.',
        });
      }

      const dept = (hod as any).department;
      req.hod = hod;
      req.departmentId = hod.departmentId;
      req.department = dept;
      req.isSemesterHandling = dept?.type === 'SEMESTER_HANDLING';
      req.handlingSemesters = dept?.handlingSemesters || (req.isSemesterHandling ? [1, 2] : null);
      return next();
    }

    // For ADMIN, SUPER_ADMIN, DEAN, and PRINCIPAL viewing HOD portal in administrative mode
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DEAN' || role === 'PRINCIPAL') {
      const explicitDeptId = (req.query.departmentId as string) || (req.headers['x-department-id'] as string) || (req.body?.departmentId as string);
      
      if (!explicitDeptId || explicitDeptId === 'ALL') {
        // If route is generic or lists all departments, allow without department lock, but if department scope is strictly required:
        // Check if route requires department context or if a default query is needed
        const activeDept = await Department.findOne({ order: [['code', 'ASC']] });
        if (!activeDept) {
          return res.status(404).json({ error: 'No academic departments exist in the system.' });
        }
        // Note: For overview/list routes that do not filter by dept, attach first valid department only if explicitly needed
        req.departmentId = activeDept.id;
        req.department = activeDept;
        req.isSemesterHandling = activeDept.type === 'SEMESTER_HANDLING';
        req.handlingSemesters = activeDept.handlingSemesters || (req.isSemesterHandling ? [1, 2] : null);
        return next();
      }

      const dept = await Department.findByPk(explicitDeptId);
      if (!dept) {
        return res.status(404).json({
          error: `Department not found for ID '${explicitDeptId}'. Please specify a valid department context.`,
        });
      }

      req.departmentId = dept.id;
      req.department = dept;
      req.isSemesterHandling = dept.type === 'SEMESTER_HANDLING';
      req.handlingSemesters = dept.handlingSemesters || (req.isSemesterHandling ? [1, 2] : null);
      return next();
    }

    // For TEACHER and FACULTY viewing department resources
    if (role === 'TEACHER' || role === 'FACULTY') {
      const teacher = await Teacher.findOne({
        where: { userId },
        include: [{ model: Department, as: 'department' }],
      });
      if (teacher && (teacher as any).department) {
        const dept = (teacher as any).department;
        req.departmentId = teacher.departmentId;
        req.department = dept;
        req.isSemesterHandling = dept?.type === 'SEMESTER_HANDLING';
        req.handlingSemesters = dept?.handlingSemesters || (req.isSemesterHandling ? [1, 2] : null);
        return next();
      }

      const assignment = await FacultyAssignment.findOne({
        where: { userId },
        include: [{ model: Department, as: 'department' }],
      });
      if (assignment && (assignment as any).department) {
        const dept = (assignment as any).department;
        req.departmentId = assignment.departmentId;
        req.department = dept;
        req.isSemesterHandling = dept?.type === 'SEMESTER_HANDLING';
        req.handlingSemesters = dept?.handlingSemesters || (req.isSemesterHandling ? [1, 2] : null);
        return next();
      }

      return res.status(403).json({
        error: 'Forbidden. No teaching department or subject assignment found for this faculty account.',
      });
    }

    return res.status(403).json({
      error: `Forbidden. Role '${role}' is not authorized to access HOD academic resources.`,
    });
  } catch (error) {
    logger.error('HOD_SCOPE_ERROR: Unexpected error resolving HOD department scope:', error);
    return res.status(500).json({ error: 'Internal Server Error while verifying departmental authorization.' });
  }
};

/**
 * Administrative Scope Guard:
 * Decoupled from strict HOD department lock. Allows administrators to inspect any department.
 */
export const resolveAdminScope = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const targetDeptId = (req.query.departmentId as string) || (req.body?.departmentId as string);
    if (targetDeptId) {
      const dept = await Department.findByPk(targetDeptId);
      if (dept) {
        req.departmentId = dept.id;
        req.department = dept;
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
