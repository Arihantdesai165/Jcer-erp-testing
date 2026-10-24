import { Request, Response, NextFunction } from 'express';
import sequelize from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import Admission from '../models/Admission';
import Department from '../models/Department';
import SystemConfiguration from '../models/SystemConfiguration';
import AcademicYear from '../models/AcademicYear';
import Semester from '../models/Semester';
import AuditLog from '../models/AuditLog';
import { Op } from 'sequelize';

import { normalizeAcademicYear, areAcademicYearsEqual, getAcademicYearVariants } from '../utils/academicYear.util';

export const getAcademicYears = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const config = await SystemConfiguration.findOne();
    const includeHistorical = req.query.includeHistorical === 'true' || req.query.all === 'true';

    const whereClause: any = {};
    if (!includeHistorical) {
      whereClause.isOperational = { [Op.ne]: false };
      whereClause.year = { [Op.ne]: '2025-26' };
    }

    const dbYears = await AcademicYear.findAll({
      where: whereClause,
      order: [['year', 'DESC']],
    });

    const activeAyRecord = await AcademicYear.findOne({ where: { isCurrent: true } });
    const currentFromDb = activeAyRecord?.year;
    const rawCurrentYear = currentFromDb || config?.admissionCycle || '2026-27';
    const currentYear = normalizeAcademicYear(rawCurrentYear) || rawCurrentYear;

    // Format list of years
    let years = dbYears.map((y) => {
      const isCur = y.isCurrent || areAcademicYearsEqual(y.year, currentYear);
      let calculatedStatus = y.status;
      if (isCur) {
        calculatedStatus = 'ACTIVE';
      } else {
        const yStart = parseInt(y.year.split('-')[0], 10);
        const curStart = parseInt(currentYear.split('-')[0], 10);
        if (!isNaN(yStart) && !isNaN(curStart)) {
          calculatedStatus = yStart < curStart ? 'ARCHIVED' : 'UPCOMING';
        }
      }

      return {
        id: y.id,
        year: y.year,
        status: calculatedStatus,
        isCurrent: isCur,
        isOperational: y.isOperational !== false && y.year !== '2025-26',
        startDate: y.startDate,
        endDate: y.endDate,
      };
    });

    if (years.length === 0) {
      years = [
        { id: 'ay-2027-28', year: '2027-28', status: 'ACTIVE', isCurrent: true, isOperational: true, startDate: new Date('2027-07-01'), endDate: new Date('2028-06-30') },
        { id: 'ay-2026-27', year: '2026-27', status: 'ARCHIVED', isCurrent: false, isOperational: true, startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') },
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        currentYear,
        activeAcademicYear: currentYear,
        operationalStartYear: '2026-27',
        years,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Ensures Semesters 1 through 8 exist and are configured for the specified academic year.
 * Generates default VTU semester dates if not already present.
 */
export const ensureSemestersForAcademicYear = async (academicYear: string, transaction?: any): Promise<Semester[]> => {
  const canonical = normalizeAcademicYear(academicYear) || academicYear;
  let semesters = await Semester.findAll({
    where: { academicYear: canonical },
    order: [['semesterNumber', 'ASC']],
    transaction,
  });

  if (semesters.length === 0) {
    const startYearMatch = canonical.match(/^(\d{4})/);
    const startY = startYearMatch ? parseInt(startYearMatch[1], 10) : new Date().getFullYear();
    const oddStart = `${startY}-08-01`;
    const oddEnd = `${startY}-12-31`;
    const evenStart = `${startY + 1}-01-15`;
    const evenEnd = `${startY + 1}-05-31`;

    const newSemestersData = [
      { semesterNumber: 1, semesterName: '1st Semester', academicYear: canonical, startDate: oddStart, endDate: oddEnd, status: 'ACTIVE' },
      { semesterNumber: 2, semesterName: '2nd Semester', academicYear: canonical, startDate: evenStart, endDate: evenEnd, status: 'UPCOMING' },
      { semesterNumber: 3, semesterName: '3rd Semester', academicYear: canonical, startDate: oddStart, endDate: oddEnd, status: 'ACTIVE' },
      { semesterNumber: 4, semesterName: '4th Semester', academicYear: canonical, startDate: evenStart, endDate: evenEnd, status: 'UPCOMING' },
      { semesterNumber: 5, semesterName: '5th Semester', academicYear: canonical, startDate: oddStart, endDate: oddEnd, status: 'ACTIVE' },
      { semesterNumber: 6, semesterName: '6th Semester', academicYear: canonical, startDate: evenStart, endDate: evenEnd, status: 'UPCOMING' },
      { semesterNumber: 7, semesterName: '7th Semester', academicYear: canonical, startDate: oddStart, endDate: oddEnd, status: 'ACTIVE' },
      { semesterNumber: 8, semesterName: '8th Semester', academicYear: canonical, startDate: evenStart, endDate: evenEnd, status: 'UPCOMING' },
    ];

    for (const item of newSemestersData) {
      await Semester.findOrCreate({
        where: { academicYear: canonical, semesterNumber: item.semesterNumber },
        defaults: item as any,
        transaction,
      });
    }

    semesters = await Semester.findAll({
      where: { academicYear: canonical },
      order: [['semesterNumber', 'ASC']],
      transaction,
    });
  }

  return semesters;
};

const toValidUuid = (val: any): string | null =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ? val : null;

export const setActiveAcademicYear = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { year } = req.body;
    if (!year) {
      return res.status(400).json({ success: false, error: 'Academic year is required' });
    }

    const canonicalYear = normalizeAcademicYear(year) || String(year).trim();
    if (!/^\d{4}-\d{2}$/.test(canonicalYear)) {
      return res.status(400).json({
        success: false,
        error: `Invalid academic year format: "${year}". Expected format like "2026-27" or "2027-28".`,
      });
    }

    const startYearNum = parseInt(canonicalYear.split('-')[0], 10);
    if (canonicalYear === '2025-26' || (!isNaN(startYearNum) && startYearNum < 2026)) {
      return res.status(400).json({
        success: false,
        error: `Academic year "${canonicalYear}" cannot be activated. The ERP operational starting year is 2026-27.`,
      });
    }

    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = await SystemConfiguration.create({});
    }

    const previousYear = config.admissionCycle || '2026-27';
    const authReq = req as any;
    const operatorId = toValidUuid(authReq.user?.id);

    await sequelize.transaction(async (t) => {
      // 1. Mark all other academic years as not current
      const allYears = await AcademicYear.findAll({ transaction: t });
      const currentYearStart = parseInt(canonicalYear.split('-')[0], 10);

      for (const y of allYears) {
        if (!areAcademicYearsEqual(y.year, canonicalYear)) {
          const yStart = parseInt(y.year.split('-')[0], 10);
          const nextStatus = isNaN(yStart) || yStart < currentYearStart ? 'ARCHIVED' : 'UPCOMING';
          await y.update({ isCurrent: false, status: nextStatus }, { transaction: t });
        }
      }

      // 2. Ensure target academic year exists, isCurrent = true, status = ACTIVE
      const existingAy = await AcademicYear.findOne({ where: { year: canonicalYear }, transaction: t });
      if (existingAy) {
        if (existingAy.isOperational === false) {
          throw new Error(`Academic year ${canonicalYear} is not an operational academic year.`);
        }
        await existingAy.update({ isCurrent: true, status: 'ACTIVE' }, { transaction: t });
      } else {
        const startY = currentYearStart || new Date().getFullYear();
        await AcademicYear.create({
          year: canonicalYear,
          startDate: new Date(`${startY}-07-01`),
          endDate: new Date(`${startY + 1}-06-30`),
          status: 'ACTIVE',
          isCurrent: true,
          isOperational: true,
        }, { transaction: t });
      }

      // 3. Ensure Semesters 1 through 8 exist for target year
      await ensureSemestersForAcademicYear(canonicalYear, t);

      // 4. Update SystemConfiguration admissionCycle
      config.admissionCycle = canonicalYear;
      await config.save({ transaction: t });

      // 5. Audit Log
      await AuditLog.create({
        userId: operatorId,
        action: 'SYSTEM_CONFIG_UPDATE',
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'JCER-ERP-API',
        details: {
          setting: 'activeAcademicYear',
          previousYear,
          newYear: canonicalYear,
          timestamp: new Date().toISOString(),
        },
      }, { transaction: t });
    });

    return res.status(200).json({
      success: true,
      message: `Active institutional academic year successfully updated to ${canonicalYear}`,
      data: {
        activeAcademicYear: canonicalYear,
        currentYear: canonicalYear,
      },
    });
  } catch (error: any) {
    return next(error);
  }
};

export const createAcademicYear = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { year, startDate, endDate, status } = req.body;
    if (!year) {
      return res.status(400).json({ success: false, error: 'Academic year is required.' });
    }

    const canonicalYear = normalizeAcademicYear(year) || String(year).trim();
    if (!/^\d{4}-\d{2}$/.test(canonicalYear)) {
      return res.status(400).json({
        success: false,
        error: `Invalid academic year format "${year}". Must be in format YYYY-YY (e.g. 2028-29).`,
      });
    }

    const startY = parseInt(canonicalYear.split('-')[0], 10);
    if (canonicalYear === '2025-26' || (!isNaN(startY) && startY < 2026)) {
      return res.status(400).json({
        success: false,
        error: `Cannot create academic year "${canonicalYear}". The ERP operational starting year is 2026-27.`,
      });
    }

    const existing = await AcademicYear.findOne({ where: { year: canonicalYear } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Academic year ${canonicalYear} already exists.` });
    }

    const startD = startDate ? new Date(startDate) : new Date(`${startY}-07-01`);
    const endD = endDate ? new Date(endDate) : new Date(`${startY + 1}-06-30`);

    const authReq = req as any;
    let createdAy: any;

    await sequelize.transaction(async (t) => {
      createdAy = await AcademicYear.create({
        year: canonicalYear,
        startDate: startD,
        endDate: endD,
        status: status || 'UPCOMING',
        isCurrent: false,
        isOperational: true,
      }, { transaction: t });

      await ensureSemestersForAcademicYear(canonicalYear, t);

      await AuditLog.create({
        userId: toValidUuid(authReq.user?.id),
        action: 'CREATE_ACADEMIC_YEAR',
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'JCER-ERP-API',
        details: { year: canonicalYear, startDate: startD, endDate: endD },
      }, { transaction: t });
    });

    return res.status(201).json({
      success: true,
      message: `Academic year ${canonicalYear} created successfully with configured semesters 1 through 8.`,
      data: createdAy,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Generate multiple consecutive future academic years.
 * Example: startYear: "2028-29", count: 5 -> creates 2028-29, 2029-30, 2030-31, 2031-32, 2032-33
 * Idempotent: Does not duplicate existing academic years or semesters.
 */
export const generateAcademicYears = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { startYear, count: rawCount } = req.body;
    if (!startYear) {
      return res.status(400).json({ success: false, error: 'Start academic year is required (e.g. "2028-29").' });
    }

    const count = parseInt(String(rawCount || 3), 10);
    if (isNaN(count) || count < 1 || count > 20) {
      return res.status(400).json({ success: false, error: 'Count must be a number between 1 and 20.' });
    }

    const canonicalStartYear = normalizeAcademicYear(startYear) || String(startYear).trim();
    if (!/^\d{4}-\d{2}$/.test(canonicalStartYear)) {
      return res.status(400).json({
        success: false,
        error: `Invalid starting academic year format: "${startYear}". Expected format like "2028-29".`,
      });
    }

    const baseStartYear = parseInt(canonicalStartYear.split('-')[0], 10);
    if (canonicalStartYear === '2025-26' || baseStartYear < 2026) {
      return res.status(400).json({
        success: false,
        error: `Starting academic year cannot be prior to the ERP operational starting year (2026-27).`,
      });
    }

    const authReq = req as any;
    const operatorId = toValidUuid(authReq.user?.id);

    const generatedYears: any[] = [];
    let newlyCreatedCount = 0;

    await sequelize.transaction(async (t) => {
      for (let i = 0; i < count; i++) {
        const curStart = baseStartYear + i;
        const curEnd = ((curStart + 1) % 100).toString().padStart(2, '0');
        const curYearStr = `${curStart}-${curEnd}`;

        let ay = await AcademicYear.findOne({ where: { year: curYearStr }, transaction: t });
        if (!ay) {
          ay = await AcademicYear.create({
            year: curYearStr,
            startDate: new Date(`${curStart}-07-01`),
            endDate: new Date(`${curStart + 1}-06-30`),
            status: 'UPCOMING',
            isCurrent: false,
            isOperational: true,
          }, { transaction: t });
          newlyCreatedCount++;
        }

        // Idempotently configure semesters 1 through 8
        await ensureSemestersForAcademicYear(curYearStr, t);
        generatedYears.push(ay);
      }

      await AuditLog.create({
        userId: operatorId,
        action: 'GENERATE_ACADEMIC_YEARS',
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'JCER-ERP-API',
        details: {
          startYear: canonicalStartYear,
          count,
          newlyCreatedCount,
          years: generatedYears.map(g => g.year),
        },
      }, { transaction: t });
    });

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${generatedYears.length} consecutive academic year(s) (${newlyCreatedCount} newly created).`,
      data: {
        totalProcessed: generatedYears.length,
        newlyCreatedCount,
        years: generatedYears,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getSemesters = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { academicYear } = req.query;
    let targetYear: string;

    if (academicYear && String(academicYear).trim() !== '' && String(academicYear).trim() !== 'All') {
      targetYear = normalizeAcademicYear(String(academicYear)) || String(academicYear).trim();
    } else {
      const config = await SystemConfiguration.findOne();
      const currentAy = await AcademicYear.findOne({ where: { isCurrent: true } });
      targetYear = currentAy?.year || normalizeAcademicYear(config?.admissionCycle) || '2026-27';
    }

    const semesters = await ensureSemestersForAcademicYear(targetYear);

    return res.status(200).json({
      success: true,
      data: {
        academicYear: targetYear,
        semesters,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSemester = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { semesterName, startDate, endDate, status } = req.body;

    const semester = await Semester.findByPk(id);
    if (!semester) {
      return res.status(404).json({ success: false, error: 'Semester record not found.' });
    }

    const authReq = req as any;
    await semester.update({
      ...(semesterName && { semesterName: String(semesterName).trim() }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(status && { status }),
    });

    await AuditLog.create({
      userId: authReq.user?.id || null,
      action: 'UPDATE_SEMESTER',
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'JCER-ERP-API',
      details: {
        semesterId: id,
        semesterNumber: semester.semesterNumber,
        academicYear: semester.academicYear,
        changes: req.body,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Semester ${semester.semesterNumber} (${semester.academicYear}) updated successfully.`,
      data: semester,
    });
  } catch (error) {
    return next(error);
  }
};

export const getConfig = async (_req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = await SystemConfiguration.create({});
    }

    const dbFeatures = config.features || {};
    const keys = ['admission', 'admin', 'principal', 'student', 'teacher', 'hod', 'parent', 'fees', 'library', 'placement', 'hostel', 'grievances'];
    const features: Record<string, boolean> = {};
    for (const key of keys) {
      const envKey = `FEATURE_${key.toUpperCase()}`;
      const envVal = process.env[envKey];
      if (envVal !== undefined) {
        features[key] = envVal === 'true';
      } else {
        features[key] = !!dbFeatures[key];
      }
    }

    const responseData = {
      ...config.toJSON(),
      features
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    return next(error);
  }
};

export const getHealth = async (_req: Request, res: Response): Promise<any> => {
  try {
    // 1. Check Database connection
    let dbConnected = false;
    let seeded = false;
    let version = '1.0.0';
    let features: Record<string, boolean> = {};

    try {
      await sequelize.authenticate();
      dbConnected = true;
      
      const adminExists = await User.count({ where: { role: 'ADMIN' } }).catch(() => 0) > 0;
      const principalExists = await User.count({ where: { role: 'PRINCIPAL' } }).catch(() => 0) > 0;
      seeded = adminExists && principalExists;

      const config = await SystemConfiguration.findOne();
      if (config) {
        version = config.version || '1.0.0';
        const dbFeatures = config.features || {};
        const keys = ['admission', 'admin', 'principal', 'student', 'teacher', 'hod', 'parent', 'fees', 'library', 'placement', 'hostel', 'grievances'];
        for (const key of keys) {
          const envKey = `FEATURE_${key.toUpperCase()}`;
          const envVal = process.env[envKey];
          if (envVal !== undefined) {
            features[key] = envVal === 'true';
          } else {
            features[key] = !!dbFeatures[key];
          }
        }
      }
    } catch (dbErr) {
      // Don't fail the health request entirely, report unhealthy database state
    }

    return res.status(200).json({
      status: dbConnected ? 'healthy' : 'unhealthy',
      version,
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbConnected,
        dialect: 'postgres',
        seeded
      },
      services: {
        authentication: 'up',
        admission: features.admission !== false ? 'up' : 'down',
        notifications: 'up'
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'unhealthy', error: 'Health check failed' });
  }
};

export const dbStatus = async (_req: Request, res: Response): Promise<any> => {
  try {
    await sequelize.authenticate();
    
    // Dynamically query table count from PostgreSQL information schema
    const tableCountQuery = await sequelize.query(
      `SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'`,
      { type: 'SELECT' } as any
    );
    const tables = parseInt((tableCountQuery[0] as any)?.count || '0', 10);
    
    const userCount = await User.count().catch(() => -1);
    const admissionCount = await Admission.count().catch(() => -1);
    const departmentCount = await Department.count().catch(() => -1);
    
    const adminExists = await User.count({ where: { role: 'ADMIN' } }).catch(() => 0) > 0;
    const principalExists = await User.count({ where: { role: 'PRINCIPAL' } }).catch(() => 0) > 0;
    const seeded = adminExists && principalExists;
    
    // Test AdmissionDocument create & update
    let testResult: any = {};
    try {
      const AdmissionDocument = (await import('../models/AdmissionDocument')).default;
      const AdmissionModel = (await import('../models/Admission')).default;
      const testAdmission = await AdmissionModel.findOne();
      if (testAdmission) {
        let doc = await AdmissionDocument.findOne({ where: { admissionId: testAdmission.id } });
        if (!doc) {
          doc = await AdmissionDocument.create({ admissionId: testAdmission.id, photoUrl: 'test_photo' });
          testResult.action = 'created';
        } else {
          await doc.update({ signatureUrl: 'test_signature_' + Date.now() });
          testResult.action = 'updated';
        }
        testResult.success = true;
        testResult.doc = doc.toJSON();
      } else {
        testResult.success = false;
        testResult.error = 'No admission found';
      }
    } catch (e: any) {
      testResult.success = false;
      testResult.error = e.message;
      testResult.stack = e.stack;
    }

    return res.status(200).json({
      success: true,
      connected: true,
      sequelize: 'PostgreSQL',
      database: process.env.DB_NAME || 'college_erp_db',
      tables,
      pendingMigrations: 0,
      seeded,
      version: '1.0.0',
      health: 'ok',
      testResult,
      counts: {
        users: userCount,
        admissions: admissionCount,
        departments: departmentCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      connected: false,
      database: 'error',
      error: error.message || 'Database connection failed'
    });
  }
};

export const getVersion = async (_req: Request, res: Response): Promise<any> => {
  try {
    const config = await SystemConfiguration.findOne();
    return res.status(200).json({
      success: true,
      version: config?.version || '1.0.0'
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      version: '1.0.0'
    });
  }
};

export const getFeatures = async (_req: Request, res: Response): Promise<any> => {
  try {
    const config = await SystemConfiguration.findOne();
    const dbFeatures = config?.features || {};
    const keys = ['admission', 'admin', 'principal', 'student', 'teacher', 'hod', 'parent', 'fees', 'library', 'placement', 'hostel', 'grievances'];
    const features: Record<string, boolean> = {};
    for (const key of keys) {
      const envKey = `FEATURE_${key.toUpperCase()}`;
      const envVal = process.env[envKey];
      if (envVal !== undefined) {
        features[key] = envVal === 'true';
      } else {
        features[key] = !!dbFeatures[key];
      }
    }
    return res.status(200).json({
      success: true,
      features
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch features'
    });
  }
};
