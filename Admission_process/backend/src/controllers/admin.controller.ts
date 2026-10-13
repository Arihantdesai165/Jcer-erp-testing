import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { Op } from 'sequelize';
import admissionService from '../services/admission.service';
import User from '../models/User';
import Admin from '../models/Admin';
import Student from '../models/Student';
import Department from '../models/Department';
import Fee from '../models/Fee';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import AuditLog from '../models/AuditLog';
import SystemConfiguration from '../models/SystemConfiguration';
import AcademicYear from '../models/AcademicYear';
import { normalizeAcademicYear, areAcademicYearsEqual, getAcademicYearVariants } from '../utils/academicYear.util';
import { ensureSemestersForAcademicYear } from './system.controller';
import securityEvents from '../services/securityEvents.service';
import db from '../config/database';
import AnalyticsService from '../services/analytics.service';
import * as r2 from '../services/r2.service';
import { ACTIVE_USER_WINDOW_MINUTES } from '../constants/activity.constants';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

/** GET /api/admin/stats — dashboard stats */
export const getStats = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const academicYear = req.query.academicYear as string;
    const stats = await admissionService.getDashboardStats(academicYear);
    return res.json({ success: true, data: stats });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/user-stats — Real-time user statistics */
export const getUserStats = async (
  _req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const activeThreshold = new Date(Date.now() - ACTIVE_USER_WINDOW_MINUTES * 60 * 1000);

    const [totalUsers, activeUsers] = await Promise.all([
      User.count(),
      User.count({
        where: {
          lastActivityAt: { [Op.gte]: activeThreshold }
        }
      })
    ]);

    return res.json({
      success: true,
      totalUsers,
      activeUsers
    });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/dashboard — Real-time dashboard full data */
export const getDashboardData = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeThreshold = new Date(Date.now() - ACTIVE_USER_WINDOW_MINUTES * 60 * 1000);
    const academicYear = req.query.academicYear as string;
    const ayWhere: any = {};
    if (academicYear && academicYear !== 'ALL') {
      const canonical = normalizeAcademicYear(academicYear);
      const variants = [canonical, ...getAcademicYearVariants(canonical), academicYear];
      ayWhere.academicYear = { [Op.in]: variants };
    }

    const transaction = await db.transaction({ readOnly: true });
    try {
      const [
        totalUsers,
        activeUsers,
        pendingAdmissions,
        alertsToday,
        studentCount,
        enrolledCount,
        teacherCount,
        hodCount,
        principalCount,
        parentCount,
        recentLogs
      ] = await Promise.all([
        User.count({ transaction }).catch(e => { console.error('Error counting total users:', e); return 0; }),
        User.count({ where: { lastActivityAt: { [Op.gte]: activeThreshold } }, transaction }).catch(e => { console.error('Error counting active users:', e); return 0; }),
        Admission.count({ where: { applicationStatus: { [Op.in]: ['SUBMITTED', 'UNDER_REVIEW'] }, ...ayWhere }, transaction }).catch(e => { console.error('Error counting pending admissions:', e); return 0; }),
        AuditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { [Op.gte]: today } }, transaction }).catch(e => { console.error('Error counting alerts today:', e); return 0; }),
        User.count({ where: { role: 'STUDENT' }, transaction }).catch(e => { console.error('Error counting students:', e); return 0; }),
        Admission.count({ where: { applicationStatus: 'ENROLLED', ...ayWhere }, transaction }).catch(e => { console.error('Error counting enrolled students:', e); return 0; }),
        User.count({ where: { role: 'TEACHER' }, transaction }).catch(e => { console.error('Error counting teachers:', e); return 0; }),
        User.count({ where: { role: 'HOD' }, transaction }).catch(e => { console.error('Error counting HODs:', e); return 0; }),
        User.count({ where: { role: { [Op.in]: ['SUPER_ADMIN', 'ADMIN'] } }, transaction }).catch(e => { console.error('Error counting principals:', e); return 0; }),
        User.count({ where: { role: 'PARENT' }, transaction }).catch(e => { console.error('Error counting parents:', e); return 0; }),
        AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 5, transaction }).catch(e => { console.error('Error fetching recent logs:', e); return [] as AuditLog[]; })
      ]);

      // Attach user names manually since there is no direct Sequelize association configured.
      const userIds = recentLogs.map(log => log.userId).filter(Boolean) as string[];
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const users = await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ['id', 'firstName', 'lastName'],
          transaction
        });
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = `${user.firstName} ${user.lastName}`;
          return acc;
        }, {} as Record<string, string>);
      }

      const recentActivities = recentLogs.map(log => ({
        id: log.id,
        action: log.action,
        detail: log.userId && usersMap[log.userId] 
          ? `${usersMap[log.userId]} - ${log.details?.reason || ''}`
          : (log.details?.email || 'System Action'),
        createdAt: log.createdAt,
      }));

      await transaction.commit();

      return res.json({
        success: true,
        data: {
          quickStats: {
            totalUsers,
            activeUsers,
            pendingTasks: pendingAdmissions,
            alertsToday
          },
          moduleCounts: {
            students: studentCount,
            enrolledStudents: enrolledCount,
            teachers: teacherCount,
            hods: hodCount,
            principals: principalCount,
            parents: parentCount,
            admissions: pendingAdmissions
          },
          recentActivities
        }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err: any) {
    try {
      const fs = await import('fs');
      fs.writeFileSync('dashboard_error.txt', String(err && err.stack || err));
    } catch (logErr) {
      console.error('Failed to write dashboard error file', logErr);
    }
    return next(err);
  }
};

/** GET /api/admin/profile */
export const getProfile = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const user = await User.findByPk(req.user!.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage', 'role'],
    });
    const adminProfile = await Admin.findOne({ where: { userId: req.user!.id } });
    return res.json({ success: true, data: { ...user?.toJSON(), ...adminProfile?.toJSON() } });
  } catch (err) {
    return next(err);
  }
};

function generateTempPassword(): string {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `JCER@${year}${randomDigits}`;
}

/** POST /api/admin/credentials/dispatch */
export const dispatchCredentials = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const { userId, username, password } = req.body;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const plainPassword = password || generateTempPassword();
    user.passwordHash = plainPassword; // automatically hashed by User.beforeSave hook
    if (username) {
      user.username = username;
    }
    const isReset = user.status === 'ACTIVE';
    user.status = 'ACTIVE';
    await user.save();

    // Log security/audit log event
    const action = isReset ? 'PASSWORD_RESET' : 'GENERATE_CREDENTIALS';
    securityEvents.generateCredentials(req, req.user!.id, user.id, action);

    return res.json({
      success: true,
      message: `Credentials dispatched for ${user.firstName} ${user.lastName || ''}.`,
      data: {
        username: user.username || user.email,
        plainPassword,
      }
    });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/credentials/pending */
export const getPendingCredentials = async (
  _req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    // Find all ENROLLED students whose User.username does NOT match Student.enrollmentNumber
    const students = await Student.findAll({
      where: { admissionStatus: 'APPROVED' }, // Note: in DB they might be APPROVED or ENROLLED, check context. Actually enrollment implies they have a USN.
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone'],
        }
      ]
    });

    // Filter those who don't have their official username set to their USN
    const pending = students.filter(s => s.user && s.user.username !== s.enrollmentNumber);

    return res.json({ success: true, data: pending });
  } catch (err) {
    return next(err);
  }
};

/** POST /api/admin/credentials/bulk-dispatch */
export const bulkDispatchCredentials = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  const transaction = await db.transaction();
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new Error('No students selected');
    }

    const domain = process.env.OFFICIAL_EMAIL_DOMAIN || 'jcer.edu.in';
    const dispatchedList: any[] = [];

    for (const studentId of studentIds) {
      const student = await Student.findByPk(studentId, {
        include: [{ model: User, as: 'user' }],
        transaction,
      });

      if (!student || !student.user) continue;

      const user = student.user as User;
      
      // If already generated, skip
      if (user.username === student.enrollmentNumber) continue;

      // Ensure we have their personal email stored safely (fallback to original user email)
      const personalEmail = student.parentEmail || user.email; // We use parentEmail or user.email
      
      const officialEmail = `${student.enrollmentNumber.toLowerCase()}@${domain}`;
      // Generate a strong random password (8 chars)
      const plainPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      
      user.username = student.enrollmentNumber;
      user.email = officialEmail;
      user.passwordHash = plainPassword; // Hashed by hook
      user.mustChangePassword = true;    // Force change on login
      
      await user.save({ transaction });

      // In a real app: Send email via nodemailer to personalEmail here
      console.log(`[EMAIL DISPATCH] Sent to ${personalEmail}: USN=${user.username}, Pass=${plainPassword}, Login=${officialEmail}`);

      // Log Security Event
      securityEvents.generateCredentials(req, req.user!.id, user.id, 'GENERATE_CREDENTIALS');

      dispatchedList.push({
        id: student.id,
        enrollmentNumber: student.enrollmentNumber,
        officialEmail,
      });
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: `Successfully generated credentials for ${dispatchedList.length} students.`,
      data: dispatchedList
    });
  } catch (err) {
    await transaction.rollback();
    return next(err);
  }
};

/** GET /api/admin/logs - Fetch audit logs */
export const getAuditLogs = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const { action, startDate, endDate, limit = 300 } = req.query;

    const whereClause: any = {};

    if (action && action !== 'ALL') {
      whereClause.action = action;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
    }

    const logs = await AuditLog.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Math.min(Number(limit) || 300, 1000),
    });

    // Populate usernames & user details
    const userIds = logs.map(l => l.userId).filter(Boolean) as string[];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const users = await User.findAll({
        where: { id: { [Op.in]: Array.from(new Set(userIds)) } },
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'username']
      });
      usersMap = users.reduce((acc, user) => {
        acc[user.id] = {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
          role: user.role,
          email: user.email,
        };
        return acc;
      }, {} as Record<string, any>);
    }

    // Collect admission IDs for legacy enrichment if studentName is missing
    const legacyAdmissionIds: string[] = [];
    logs.forEach(l => {
      const admId = l.details?.admissionId;
      if (admId && typeof admId === 'string' && !l.details?.studentName) {
        legacyAdmissionIds.push(admId);
      }
    });

    let admissionsMap: Record<string, { studentName: string; applicationNumber: string }> = {};
    if (legacyAdmissionIds.length > 0) {
      try {
        const legacyAdmissions = await Admission.findAll({
          where: { id: { [Op.in]: Array.from(new Set(legacyAdmissionIds)) } },
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'username', 'email'] },
            { model: AdmissionPersonalDetail, as: 'studentpersonaldetails', attributes: ['firstName', 'middleName', 'lastName'] }
          ]
        });
        legacyAdmissions.forEach(adm => {
          const pd = adm.studentpersonaldetails;
          const pdName = pd ? `${pd.firstName || ''} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName || ''}`.trim() : '';
          const u = adm.user;
          const userName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
          admissionsMap[adm.id] = {
            studentName: pdName || userName || u?.username || u?.email || 'Unknown Student',
            applicationNumber: adm.applicationNumber || 'N/A'
          };
        });
      } catch (e) {
        console.error('Failed to populate legacy admission metadata for logs:', e);
      }
    }

    const data = logs.map(log => {
      const u = log.userId ? usersMap[log.userId] : null;
      const legacyInfo = log.details?.admissionId ? admissionsMap[log.details.admissionId] : null;
      const studentName = log.details?.studentName || legacyInfo?.studentName || null;
      const applicationNumber = log.details?.applicationNumber || legacyInfo?.applicationNumber || null;
      const admissionId = log.details?.admissionId || null;

      return {
        id: log.id,
        action: log.action,
        userId: log.userId,
        userName: u ? u.name : 'System / Guest',
        userRole: u ? u.role : 'SYSTEM',
        userEmail: u ? u.email : null,
        ipAddress: log.ipAddress || '127.0.0.1',
        userAgent: log.userAgent,
        details: log.details,
        studentName,
        applicationNumber,
        admissionId,
        createdAt: log.createdAt,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/settings - Get system settings */
export const getSettings = async (
  _req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = await SystemConfiguration.create({});
    }
    return res.json({
      success: true,
      data: {
        admissionOpen: config.admissionOpen,
        collegeName: config.collegeName,
        admissionCycle: config.admissionCycle,
        admissionClosingDate: config.admissionClosingDate,
        handbookUrl: config.handbookUrl,
        copyrightYear: config.copyrightYear || '2026',
        require2FA: true,
        admissionsPortalOpen: config.admissionOpen,
        freshAdmissionOpen: config.freshAdmissionOpen,
        lateralEntryOpen: config.lateralEntryOpen,
        provisionalAdmissionOpen: config.provisionalAdmissionOpen,
        provisionalAdmission3Open: config.provisionalAdmission3Open,
        provisionalAdmission5Open: config.provisionalAdmission5Open,
        provisionalAdmission7Open: config.provisionalAdmission7Open,
        smtpServer: 'smtp.sendgrid.net',
        smsGateway: '************************'
      }
    });
  } catch (err) {
    return next(err);
  }
};

/** PUT /api/admin/settings - Update system settings */
export const updateSettings = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = await SystemConfiguration.create({});
    }

    if (typeof req.body.admissionOpen === 'boolean') {
      config.admissionOpen = req.body.admissionOpen;
    }

    if (typeof req.body.freshAdmissionOpen === 'boolean') {
      config.freshAdmissionOpen = req.body.freshAdmissionOpen;
    }

    if (typeof req.body.lateralEntryOpen === 'boolean') {
      config.lateralEntryOpen = req.body.lateralEntryOpen;
    }

    if (typeof req.body.provisionalAdmissionOpen === 'boolean') {
      config.provisionalAdmissionOpen = req.body.provisionalAdmissionOpen;
    }

    if (typeof req.body.provisionalAdmission3Open === 'boolean') {
      config.provisionalAdmission3Open = req.body.provisionalAdmission3Open;
    }

    if (typeof req.body.provisionalAdmission5Open === 'boolean') {
      config.provisionalAdmission5Open = req.body.provisionalAdmission5Open;
    }

    if (typeof req.body.provisionalAdmission7Open === 'boolean') {
      config.provisionalAdmission7Open = req.body.provisionalAdmission7Open;
    }

    let canonicalYear: string | undefined;
    if (req.body.admissionCycle || req.body.academicYear) {
      const rawYear = req.body.admissionCycle || req.body.academicYear;
      canonicalYear = normalizeAcademicYear(rawYear) || String(rawYear).trim();

      const startYearNum = parseInt(canonicalYear.split('-')[0], 10);
      if (canonicalYear === '2025-26' || (!isNaN(startYearNum) && startYearNum < 2026)) {
        return res.status(400).json({
          success: false,
          error: `Academic year "${canonicalYear}" cannot be activated. The ERP operational starting year is 2026-27.`,
        });
      }

      config.admissionCycle = canonicalYear;

      // Transactionally update AcademicYear model table as single authoritative source of truth
      await db.transaction(async (t) => {
        const allYears = await AcademicYear.findAll({ transaction: t });
        const currentYearStart = parseInt(canonicalYear!.split('-')[0], 10);

        for (const y of allYears) {
          if (!areAcademicYearsEqual(y.year, canonicalYear!)) {
            const yStart = parseInt(y.year.split('-')[0], 10);
            const nextStatus = isNaN(yStart) || yStart < currentYearStart ? 'ARCHIVED' : 'UPCOMING';
            await y.update({ isCurrent: false, status: nextStatus }, { transaction: t });
          }
        }

        // Find or create the canonical academic year record
        const existingAy = await AcademicYear.findOne({
          where: { year: canonicalYear },
          transaction: t,
        });

        if (existingAy) {
          if (existingAy.isOperational === false) {
            throw new Error(`Academic year ${canonicalYear} is not an operational academic year.`);
          }
          await existingAy.update(
            { isCurrent: true, status: 'ACTIVE' },
            { transaction: t }
          );
        } else {
          const startYearMatch = canonicalYear!.match(/^(\d{4})/);
          const startY = startYearMatch ? parseInt(startYearMatch[1], 10) : new Date().getFullYear();
          await AcademicYear.create(
            {
              year: canonicalYear!,
              startDate: new Date(`${startY}-07-01`),
              endDate: new Date(`${startY + 1}-06-30`),
              status: 'ACTIVE',
              isCurrent: true,
              isOperational: true,
            },
            { transaction: t }
          );
        }

        // Ensure Semesters 1 through 8 exist for target year
        await ensureSemestersForAcademicYear(canonicalYear!, t);
      });

      // Audit log the academic year change
      await AuditLog.create({
        userId: req.user?.id || null,
        action: 'UPDATE_SYSTEM_SETTINGS',
        details: `Active academic year updated to ${canonicalYear}`,
      }).catch(err => console.warn('Could not write audit log for AY change:', err));
    }

    if (req.body.copyrightYear) {
      config.copyrightYear = String(req.body.copyrightYear).trim();
    }

    if (req.body.admissionClosingDate !== undefined) {
      config.admissionClosingDate = req.body.admissionClosingDate ? new Date(req.body.admissionClosingDate) : null;
    }

    await config.save();

    return res.json({
      success: true,
      message: `System settings updated successfully.`,
      data: config,
      currentYear: canonicalYear || config.admissionCycle,
      activeAcademicYear: canonicalYear || config.admissionCycle,
    });
  } catch (err) {
    return next(err);
  }
};

/** POST /api/admin/settings/handbook - Upload or replace Admission Handbook PDF */
export const uploadHandbook = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = await SystemConfiguration.create({});
    }

    const oldKey = config.handbookUrl;

    // Upload to R2
    const key = r2.buildHandbookKey();
    await r2.uploadFromDisk(req.file.path, key, 'application/pdf');

    // Save new key in DB
    config.handbookUrl = key;
    await config.save();

    // Delete old handbook from R2 only after successful DB save
    if (oldKey) await r2.deleteFile(oldKey);

    return res.json({
      success: true,
      message: 'Admission Handbook PDF uploaded successfully.',
      handbookKey: key,
    });
  } catch (err) {
    return next(err);
  }
};



/** GET /api/admin/analytics - Real analytics data from database */
export const getAnalyticsData = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<any> => {
  try {
    const period = req.query.period as string || '7d';
    const academicYear = req.query.academicYear as string || '2026-2027';

    const filters = {
      academicYear,
      period: period as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    // 1. Get dates range conditions
    const dateRange = AnalyticsService.getCurrentDateRange(period, req.query.startDate as string, req.query.endDate as string);
    const prevDateRange = AnalyticsService.getPreviousDateRange(period, req.query.startDate as string, req.query.endDate as string);

    const baseWhere: any = { applicationStatus: { [Op.ne]: 'DRAFT' } };
    if (academicYear && academicYear !== 'ALL') {
      baseWhere.academicYear = academicYear;
    }

    // 2. Query KPIs for current period
    const currentWhereTotal = { ...baseWhere };
    if (dateRange) currentWhereTotal.submittedAt = dateRange;
    else currentWhereTotal.submittedAt = { [Op.ne]: null };

    const currentWhereVerified = { ...baseWhere, applicationStatus: { [Op.in]: ['APPROVED', 'PRINCIPAL_APPROVED', 'ENROLLED'] } };
    if (dateRange) currentWhereVerified.verifiedAt = dateRange;
    else currentWhereVerified.verifiedAt = { [Op.ne]: null };

    const currentWhereEnrolled = { ...baseWhere, applicationStatus: 'ENROLLED' };
    if (dateRange) currentWhereEnrolled.enrolledAt = dateRange;
    else currentWhereEnrolled.enrolledAt = { [Op.ne]: null };

    const [
      totalApplications,
      verifiedApplications,
      enrolledStudents,
      funnel,
      trend,
      branchPerformance,
      admissionTypes,
      categories,
      genders,
      districts,
      workload,
      rates,
      recentActivity,
      pendingActions
    ] = await Promise.all([
      Admission.count({ where: currentWhereTotal }),
      Admission.count({ where: currentWhereVerified }),
      Admission.count({ where: currentWhereEnrolled }),
      AnalyticsService.getApplicationFunnel(filters),
      AnalyticsService.getApplicationTrend(filters, 'daily'),
      AnalyticsService.getBranchAnalytics(filters),
      AnalyticsService.getAdmissionTypeAnalytics(filters),
      AnalyticsService.getCategoryAnalytics(filters),
      AnalyticsService.getGenderAnalytics(filters),
      AnalyticsService.getDistrictAnalytics(filters),
      AnalyticsService.getAdminWorkload(filters),
      AnalyticsService.getPerformanceRates(filters),
      AnalyticsService.getRecentActivity(filters),
      AnalyticsService.getPendingActions(filters, 'ADMIN'),
    ]);

    // 3. Query KPIs for previous period
    let prevTotal = 0;
    let prevVerified = 0;
    let prevEnrolled = 0;

    if (prevDateRange) {
      const prevWhereTotal = { ...baseWhere, submittedAt: prevDateRange };
      const prevWhereVerified = { ...baseWhere, verifiedAt: prevDateRange, applicationStatus: { [Op.in]: ['APPROVED', 'PRINCIPAL_APPROVED', 'ENROLLED'] } };
      const prevWhereEnrolled = { ...baseWhere, enrolledAt: prevDateRange, applicationStatus: 'ENROLLED' };

      const [pTotal, pVerified, pEnrolled] = await Promise.all([
        Admission.count({ where: prevWhereTotal }),
        Admission.count({ where: prevWhereVerified }),
        Admission.count({ where: prevWhereEnrolled }),
      ]);
      prevTotal = pTotal;
      prevVerified = pVerified;
      prevEnrolled = pEnrolled;
    }

    // 4. Calculate comparisons
    const calculateChange = (current: number, previous: number) => {
      if (!prevDateRange) return null;
      if (previous === 0) {
        if (current === 0) return 0;
        return null; // Represents "New"
      }
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    const currentConversion = totalApplications > 0 ? (enrolledStudents / totalApplications) * 100 : 0;
    const previousConversion = prevTotal > 0 ? (prevEnrolled / prevTotal) * 100 : 0;
    const conversionChange = prevDateRange
      ? parseFloat((currentConversion - previousConversion).toFixed(1))
      : null;

    const range = {
      from: dateRange ? ((dateRange as any)[Op.gte] as Date).toISOString() : '',
      to: dateRange ? ((dateRange as any)[Op.lte] as Date).toISOString() : '',
      previousFrom: prevDateRange ? ((prevDateRange as any)[Op.gte] as Date).toISOString() : '',
      previousTo: prevDateRange ? ((prevDateRange as any)[Op.lte] as Date).toISOString() : '',
    };

    const funnelObj = {
      submitted: funnel.find((f: any) => f.stage === 'Submitted')?.count || 0,
      underReview: funnel.find((f: any) => f.stage === 'Under Review')?.count || 0,
      adminVerified: funnel.find((f: any) => f.stage === 'Admin Verified')?.count || 0,
      principalApproved: funnel.find((f: any) => f.stage === 'Principal Approved')?.count || 0,
      enrolled: funnel.find((f: any) => f.stage === 'Enrolled')?.count || 0,
    };

    const topPrograms = [...branchPerformance]
      .sort((a, b) => b.applications - a.applications)
      .map((item) => {
        const total = branchPerformance.reduce((acc, curr) => acc + curr.applications, 0) || 1;
        return {
          name: item.name,
          applications: item.applications,
          percentage: parseFloat(((item.applications / total) * 100).toFixed(1)),
        };
      });

    return res.json({
      success: true,
      data: {
        period,
        range,
        kpis: {
          totalApplications: {
            value: totalApplications,
            change: calculateChange(totalApplications, prevTotal)
          },
          verifiedApplications: {
            value: verifiedApplications,
            change: calculateChange(verifiedApplications, prevVerified)
          },
          enrolledStudents: {
            value: enrolledStudents,
            change: calculateChange(enrolledStudents, prevEnrolled)
          },
          conversionRate: {
            value: parseFloat(currentConversion.toFixed(2)),
            change: conversionChange
          }
        },
        funnel: funnelObj,
        trend,
        branchPerformance,
        admissionTypes,
        categories,
        genders,
        districts,
        workload,
        rates,
        recentActivity,
        pendingActions,
        topPrograms
      }
    });
  } catch (err) {
    return next(err);
  }
};
