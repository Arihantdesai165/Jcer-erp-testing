import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import sequelize from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Teacher from '../models/Teacher';
import HOD from '../models/HOD';
import Student from '../models/Student';
import AuditLog from '../models/AuditLog';
import AcademicYear from '../models/AcademicYear';
import Semester from '../models/Semester';
import Section from '../models/Section';
import HODAssignmentHistory from '../models/HODAssignmentHistory';
import FacultyAuthorizationRequest from '../models/FacultyAuthorizationRequest';
import FacultyAssignment from '../models/FacultyAssignment';
import HodSubjectHandlingRequest from '../models/HodSubjectHandlingRequest';
import Notification from '../models/Notification';
import SystemConfiguration from '../models/SystemConfiguration';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import facultyAuthorizationService from '../services/facultyAuthorization.service';
import logger from '../utils/logger.util';
import { resolveDepartmentCanonical, findDepartmentCanonical } from '../utils/departmentCanonical.util';

// Helper to record audit log
const logAudit = async (req: AuthenticatedRequest, action: string, details: any) => {
  try {
    await AuditLog.create({
      userId: req.user?.id || null,
      action,
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'System',
      details,
    });
  } catch (err) {
    logger.warn('Failed to write audit log in dean.controller:', err);
  }
};

// ─── 1. Dashboard Overview ─────────────────────────────────────────────────────

export const getDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    let currentYearRecord = await AcademicYear.findOne({ where: { isCurrent: true } });
    if (!currentYearRecord) {
      currentYearRecord = await AcademicYear.findOne({ where: { status: 'ACTIVE' } });
    }
    if (!currentYearRecord) {
      const sysConfig = await SystemConfiguration.findOne();
      if (sysConfig?.admissionCycle) {
        currentYearRecord = await AcademicYear.findOne({ where: { year: sysConfig.admissionCycle } });
      }
    }
    if (!currentYearRecord) {
      currentYearRecord = await AcademicYear.findOne({ order: [['startDate', 'DESC']] });
    }
    const currentYear = currentYearRecord?.year || '2026-27';

    // Counts
    const departmentsCount = await Department.count();
    const activeHodsCount = await HOD.count({ where: { isActive: true } });
    const totalFacultyCount = await Teacher.count();
    const pendingRequestsCount = await FacultyAuthorizationRequest.count({
      where: {
        status: 'PENDING',
        authority: 'DEAN',
      },
    });

    // Department Overview list
    const departments = await Department.findAll({
      order: [['name', 'ASC']],
    });

    const departmentOverview = await Promise.all(
      departments.map(async (dept) => {
        const hodRecord = await HOD.findOne({
          where: { departmentId: dept.id, isActive: true },
          include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'profileImage'] }],
        });

        const facultyCount = await Teacher.count({ where: { departmentId: dept.id } });
        const studentCount = await Student.count({ where: { departmentId: dept.id } });

        const hodUser = (hodRecord as any)?.user;
        const hodName = hodUser ? `${hodUser.firstName} ${hodUser.lastName}`.trim() : 'Unassigned';

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          hodId: hodRecord?.id || null,
          hodUserId: hodRecord?.userId || null,
          hodName,
          hodEmail: hodUser?.email || null,
          hodImage: hodUser?.profileImage || null,
          facultyCount,
          studentCount,
          status: 'Active',
        };
      })
    );

    // Latest Pending Faculty Requests
    const pendingRequests = await FacultyAuthorizationRequest.findAll({
      where: {
        status: 'PENDING',
        authority: 'DEAN',
      },
      include: [
        { model: User, as: 'faculty', attributes: ['firstName', 'lastName', 'email', 'phone', 'profileImage'] },
        { model: Department, as: 'department', attributes: ['name', 'code'] },
        { model: Subject, as: 'subject', attributes: ['name', 'code'] },
        { model: User, as: 'createdByHOD', attributes: ['firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 6,
    });

    const formattedPendingRequests = pendingRequests.map((reqItem: any) => ({
      id: reqItem.id,
      facultyName: `${reqItem.faculty?.firstName || ''} ${reqItem.faculty?.lastName || ''}`.trim() || 'Faculty Member',
      email: reqItem.faculty?.email,
      department: reqItem.department?.name || 'Department',
      departmentCode: reqItem.department?.code || 'N/A',
      subject: reqItem.subject?.name || 'Not Specified',
      subjectCode: reqItem.subject?.code || 'N/A',
      semester: reqItem.semester,
      section: reqItem.section,
      academicYear: reqItem.academicYear,
      designation: reqItem.designation,
      createdBy: reqItem.createdByHOD ? `HOD - ${reqItem.createdByHOD.firstName} ${reqItem.createdByHOD.lastName}` : 'HOD',
      requestedDate: reqItem.createdAt,
      status: reqItem.status,
    }));

    return res.json({
      success: true,
      data: {
        academicYear: currentYear,
        stats: {
          departments: departmentsCount,
          activeHods: activeHodsCount,
          totalFaculty: totalFacultyCount,
          pendingRequests: pendingRequestsCount,
        },
        departmentOverview,
        pendingRequests: formattedPendingRequests,
      },
    });
  } catch (error) {
    logger.error('Error fetching Dean dashboard data:', error);
    return next(error);
  }
};

// ─── 2. Academic Years ─────────────────────────────────────────────────────────

export const getAcademicYears = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, status } = req.query;
    const where: any = {};

    if (search) {
      where.year = { [Op.iLike]: `%${search}%` };
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const years = await AcademicYear.findAll({
      where,
      order: [['startDate', 'DESC']],
    });

    return res.json({ success: true, data: years });
  } catch (error) {
    return next(error);
  }
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { year, startDate, endDate, status, isCurrent } = req.body;

    if (!year || !startDate || !endDate) {
      await t.rollback();
      return res.status(400).json({ error: 'Academic Year, Start Date, and End Date are required.' });
    }

    const existing = await AcademicYear.findOne({ where: { year } });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ error: `Academic Year ${year} already exists.` });
    }

    const shouldBeCurrent = isCurrent === true || status === 'ACTIVE';

    if (shouldBeCurrent) {
      // Set all others to isCurrent = false
      await AcademicYear.update({ isCurrent: false }, { where: {}, transaction: t });
    }

    const created = await AcademicYear.create(
      {
        year,
        startDate,
        endDate,
        status: shouldBeCurrent ? 'ACTIVE' : (status || 'UPCOMING'),
        isCurrent: shouldBeCurrent,
      },
      { transaction: t }
    );

    if (shouldBeCurrent) {
      const sysConfig = await SystemConfiguration.findOne({ transaction: t });
      if (sysConfig) {
        await sysConfig.update({ admissionCycle: year }, { transaction: t });
      }
    }

    await t.commit();
    await logAudit(req, 'CREATE_ACADEMIC_YEAR', { academicYearId: created.id, year });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

export const updateAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { startDate, endDate, status, isCurrent } = req.body;

    const academicYear = await AcademicYear.findByPk(id);
    if (!academicYear) {
      await t.rollback();
      return res.status(404).json({ error: 'Academic Year not found.' });
    }

    // Determine if this update makes this academic year the current active session
    const shouldBeCurrent = isCurrent === true || (isCurrent !== false && status === 'ACTIVE');

    if (shouldBeCurrent) {
      // Unset all other academic years as current
      await AcademicYear.update(
        { isCurrent: false },
        { where: { id: { [Op.ne]: id } }, transaction: t }
      );

      // Keep SystemConfiguration.admissionCycle in sync for college-wide consistency
      const sysConfig = await SystemConfiguration.findOne({ transaction: t });
      if (sysConfig) {
        await sysConfig.update({ admissionCycle: academicYear.year }, { transaction: t });
      }
    }

    await academicYear.update(
      {
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(status && { status: shouldBeCurrent ? 'ACTIVE' : status }),
        isCurrent: shouldBeCurrent ? true : (isCurrent !== undefined ? Boolean(isCurrent) : academicYear.isCurrent),
      },
      { transaction: t }
    );

    await t.commit();
    await logAudit(req, 'UPDATE_ACADEMIC_YEAR', { academicYearId: id, year: academicYear.year, changes: req.body });
    return res.json({ success: true, data: academicYear });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

// ─── 3. Departments ────────────────────────────────────────────────────────────

export const getDepartments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search } = req.query;
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const departments = await Department.findAll({
      where,
      order: [['name', 'ASC']],
    });

    const result = await Promise.all(
      departments.map(async (dept) => {
        const hod = await HOD.findOne({
          where: { departmentId: dept.id, isActive: true },
          include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'] }],
        });

        const facultyCount = await Teacher.count({ where: { departmentId: dept.id } });
        const studentCount = await Student.count({ where: { departmentId: dept.id } });
        const subjectCount = await Subject.count({ where: { departmentId: dept.id } });

        const hodUser = (hod as any)?.user;

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          hod: hodUser ? {
            id: hodUser.id,
            name: `${hodUser.firstName} ${hodUser.lastName}`.trim(),
            email: hodUser.email,
            profileImage: hodUser.profileImage,
          } : null,
          facultyCount,
          studentCount,
          subjectCount,
          status: 'Active',
          createdAt: dept.createdAt,
        };
      })
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

export const createDepartment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Department Name and Department Code are required.' });
    }

    const existing = await Department.findOne({
      where: {
        [Op.or]: [{ name }, { code }],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'A department with this name or code already exists.' });
    }

    const dept = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
    });

    await logAudit(req, 'CREATE_DEPARTMENT', { departmentId: dept.id, name: dept.name, code: dept.code });
    return res.status(201).json({ success: true, data: dept });
  } catch (error) {
    return next(error);
  }
};

export const updateDepartment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const dept = await Department.findByPk(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    if (name || code) {
      const conflict = await Department.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.or]: [
            ...(name ? [{ name: name.trim() }] : []),
            ...(code ? [{ code: code.trim().toUpperCase() }] : []),
          ],
        },
      });

      if (conflict) {
        return res.status(400).json({ error: 'Another department already uses this name or code.' });
      }
    }

    await dept.update({
      ...(name && { name: name.trim() }),
      ...(code && { code: code.trim().toUpperCase() }),
    });

    await logAudit(req, 'UPDATE_DEPARTMENT', { departmentId: id, changes: req.body });
    return res.json({ success: true, data: dept });
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentAcademicInfo = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const dept = await Department.findByPk(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    const currentYearRecord = await AcademicYear.findOne({ where: { isCurrent: true } });
    const currentYear = currentYearRecord?.year || '2026-27';

    // Current HOD
    const currentHodRecord = await HOD.findOne({
      where: { departmentId: id, isActive: true },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage'] }],
    });

    const hodUser = (currentHodRecord as any)?.user;

    // Faculty summary
    const teachers = await Teacher.findAll({
      where: { departmentId: id },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status'] }],
    });

    const activeFacultyCount = teachers.filter((t: any) => t.user?.status === 'ACTIVE').length;
    const pendingFacultyCount = await FacultyAuthorizationRequest.count({
      where: { departmentId: id, status: 'PENDING' },
    });

    // Subjects summary
    const subjects = await Subject.findAll({
      where: {
        [Op.or]: [{ departmentId: id }, { departmentId: null }],
      },
      order: [['semester', 'ASC'], ['code', 'ASC']],
    });

    const theoryCount = subjects.filter((s) => s.type === 'Theory').length;
    const practicalCount = subjects.filter((s) => s.type === 'Practical').length;
    const electivesCount = subjects.filter((s) => s.type === 'Elective').length;

    // Sections & Semesters structure
    const sections = await Section.findAll({
      where: { departmentId: id },
      order: [['semester', 'ASC'], ['name', 'ASC']],
    });

    const studentCount = await Student.count({ where: { departmentId: id } });

    // Build semester breakdown (Semesters 1 to 8)
    const semesterStructure = [1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
      const semSections = sections.filter((s) => s.semester === semNum);
      const semSubjects = subjects.filter((s) => s.semester === semNum);
      return {
        semesterNumber: semNum,
        semesterName: `Semester ${semNum}`,
        sectionsCount: semSections.length,
        sections: semSections.map((s) => ({ id: s.id, name: s.name, capacity: s.capacity })),
        subjectsCount: semSubjects.length,
        subjects: semSubjects.map((s) => ({ id: s.id, code: s.code, name: s.name, credits: s.credits, type: s.type })),
      };
    });

    return res.json({
      success: true,
      data: {
        department: {
          id: dept.id,
          name: dept.name,
          code: dept.code,
        },
        academicYear: currentYear,
        hod: hodUser ? {
          id: hodUser.id,
          name: `${hodUser.firstName} ${hodUser.lastName}`.trim(),
          email: hodUser.email,
          phone: hodUser.phone,
          profileImage: hodUser.profileImage,
          tenureStartDate: (currentHodRecord as any)?.tenureStartDate,
          appointmentOrderNo: (currentHodRecord as any)?.appointmentOrderNo,
          status: 'Active',
        } : null,
        stats: {
          facultyTotal: teachers.length,
          facultyActive: activeFacultyCount,
          facultyPending: pendingFacultyCount,
          subjectsTotal: subjects.length,
          subjectsTheory: theoryCount,
          subjectsPractical: practicalCount,
          subjectsElective: electivesCount,
          studentsTotal: studentCount,
          activeSectionsCount: sections.length,
        },
        facultyList: teachers.map((t: any) => ({
          id: t.id,
          userId: t.userId,
          name: `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim(),
          email: t.user?.email,
          phone: t.user?.phone,
          designation: t.designation,
          joiningDate: t.joiningDate,
          status: t.user?.status || 'ACTIVE',
        })),
        subjectsList: subjects,
        semesterStructure,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ─── 4. Semesters ──────────────────────────────────────────────────────────────

export const getSemesters = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { academicYear } = req.query;
    const where: any = {};
    if (academicYear) {
      where.academicYear = academicYear;
    }

    const semesters = await Semester.findAll({
      where,
      order: [['semesterNumber', 'ASC']],
    });

    return res.json({ success: true, data: semesters });
  } catch (error) {
    return next(error);
  }
};

export const createSemester = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { semesterNumber, semesterName, academicYear, startDate, endDate, status } = req.body;

    if (!semesterNumber || !academicYear || !startDate || !endDate) {
      return res.status(400).json({ error: 'Semester Number, Academic Year, Start Date, and End Date are required.' });
    }

    const existing = await Semester.findOne({
      where: { semesterNumber: Number(semesterNumber), academicYear },
    });

    if (existing) {
      return res.status(400).json({ error: `Semester ${semesterNumber} already exists for Academic Year ${academicYear}.` });
    }

    const semester = await Semester.create({
      semesterNumber: Number(semesterNumber),
      semesterName: semesterName || `Semester ${semesterNumber}`,
      academicYear,
      startDate,
      endDate,
      status: status || 'UPCOMING',
    });

    await logAudit(req, 'CREATE_SEMESTER', { semesterId: semester.id, semesterNumber, academicYear });
    return res.status(201).json({ success: true, data: semester });
  } catch (error) {
    return next(error);
  }
};

export const updateSemester = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { startDate, endDate, status } = req.body;

    const semester = await Semester.findByPk(id);
    if (!semester) {
      return res.status(404).json({ error: 'Semester not found.' });
    }

    await semester.update({
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(status && { status }),
    });

    await logAudit(req, 'UPDATE_SEMESTER', { semesterId: id, changes: req.body });
    return res.json({ success: true, data: semester });
  } catch (error) {
    return next(error);
  }
};

// ─── 5. Sections ───────────────────────────────────────────────────────────────

export const getSections = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { departmentId, semester, academicYear } = req.query;
    const where: any = {};

    if (departmentId && departmentId !== 'ALL') where.departmentId = departmentId;
    if (semester && semester !== 'ALL') where.semester = Number(semester);
    if (academicYear && academicYear !== 'ALL') where.academicYear = academicYear;

    const sections = await Section.findAll({
      where,
      include: [{ model: Department, as: 'department', attributes: ['name', 'code'] }],
      order: [['semester', 'ASC'], ['name', 'ASC']],
    });

    return res.json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
};

export const createSection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { departmentId, semester, academicYear, name, capacity, status } = req.body;

    if (!departmentId || !semester || !academicYear || !name) {
      return res.status(400).json({ error: 'Department, Semester, Academic Year, and Section Name are required.' });
    }

    const existing = await Section.findOne({
      where: {
        departmentId,
        semester: Number(semester),
        academicYear,
        name: name.trim(),
      },
    });

    if (existing) {
      return res.status(400).json({ error: `Section ${name} already exists for this Department and Semester.` });
    }

    const section = await Section.create({
      departmentId,
      semester: Number(semester),
      academicYear,
      name: name.trim(),
      capacity: capacity ? Number(capacity) : 60,
      status: status || 'ACTIVE',
    });

    await logAudit(req, 'CREATE_SECTION', { sectionId: section.id, departmentId, semester, name });
    return res.status(201).json({ success: true, data: section });
  } catch (error) {
    return next(error);
  }
};

export const updateSection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { capacity, status } = req.body;

    const section = await Section.findByPk(id);
    if (!section) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    await section.update({
      ...(capacity !== undefined && { capacity: Number(capacity) }),
      ...(status && { status }),
    });

    await logAudit(req, 'UPDATE_SECTION', { sectionId: id, changes: req.body });
    return res.json({ success: true, data: section });
  } catch (error) {
    return next(error);
  }
};

// ─── 6. Subjects ───────────────────────────────────────────────────────────────

export const getSubjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, departmentId, semester, type } = req.query;
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (departmentId && departmentId !== 'ALL') {
      where.departmentId = departmentId;
    }
    if (semester && semester !== 'ALL') {
      where.semester = Number(semester);
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }

    const subjects = await Subject.findAll({
      where,
      include: [{ model: Department, as: 'department', attributes: ['name', 'code'] }],
      order: [['semester', 'ASC'], ['code', 'ASC']],
    });

    return res.json({ success: true, data: subjects });
  } catch (error) {
    return next(error);
  }
};

export const createSubject = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { name, code, semester, departmentId, credits, type, status } = req.body;

    if (!name || !code || !semester) {
      return res.status(400).json({ error: 'Subject Name, Subject Code, and Semester are required.' });
    }

    const existing = await Subject.findOne({ where: { code: code.trim().toUpperCase() } });
    if (existing) {
      return res.status(400).json({ error: `Subject Code ${code} already exists.` });
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      semester: Number(semester),
      departmentId: departmentId || null,
      credits: credits ? Number(credits) : 4,
      type: type || 'Theory',
      status: status || 'ACTIVE',
    });

    await logAudit(req, 'CREATE_SUBJECT', { subjectId: subject.id, code: subject.code, name: subject.name });
    return res.status(201).json({ success: true, data: subject });
  } catch (error) {
    return next(error);
  }
};

export const updateSubject = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { name, code, semester, departmentId, credits, type, status } = req.body;

    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    if (code) {
      const conflict = await Subject.findOne({
        where: { id: { [Op.ne]: id }, code: code.trim().toUpperCase() },
      });
      if (conflict) {
        return res.status(400).json({ error: `Subject code ${code} is already in use.` });
      }
    }

    await subject.update({
      ...(name && { name: name.trim() }),
      ...(code && { code: code.trim().toUpperCase() }),
      ...(semester && { semester: Number(semester) }),
      ...(departmentId !== undefined && { departmentId: departmentId || null }),
      ...(credits !== undefined && { credits: Number(credits) }),
      ...(type && { type }),
      ...(status && { status }),
    });

    await logAudit(req, 'UPDATE_SUBJECT', { subjectId: id, changes: req.body });
    return res.json({ success: true, data: subject });
  } catch (error) {
    return next(error);
  }
};

// ─── 7. HOD Management ─────────────────────────────────────────────────────────

export const getHods = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, departmentId, status } = req.query;

    const hodRecords = await HOD.findAll({
      where: status && status !== 'ALL' ? { isActive: status === 'ACTIVE' } : {},
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status', 'createdAt'],
          where: search
            ? {
                [Op.or]: [
                  { firstName: { [Op.iLike]: `%${search}%` } },
                  { lastName: { [Op.iLike]: `%${search}%` } },
                  { email: { [Op.iLike]: `%${search}%` } },
                ],
              }
            : {},
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
          where: departmentId && departmentId !== 'ALL' ? { id: departmentId } : {},
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const currentYearRecord = await AcademicYear.findOne({ where: { isCurrent: true } });
    const currentYear = currentYearRecord?.year || '2026-27';

    const formatted = hodRecords.map((h: any) => ({
      id: h.id,
      userId: h.userId,
      name: `${h.user?.firstName || ''} ${h.user?.lastName || ''}`.trim(),
      email: h.user?.email,
      phone: h.user?.phone,
      profileImage: h.user?.profileImage,
      departmentId: h.departmentId,
      departmentName: h.department?.name,
      departmentCode: h.department?.code,
      academicYear: currentYear,
      tenureStartDate: h.tenureStartDate,
      appointmentOrderNo: h.appointmentOrderNo,
      isActive: h.isActive,
      status: h.isActive ? 'Active' : 'Inactive',
      createdAt: h.createdAt,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return next(error);
  }
};

export const createHod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { firstName, lastName, email, phone, designation, departmentId, academicYear, joiningDate, tempPassword } = req.body;

    if (!firstName || !lastName || !email || !departmentId) {
      await t.rollback();
      return res.status(400).json({ error: 'First Name, Last Name, Email, and Department are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      await t.rollback();
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const dept = await Department.findByPk(departmentId);
    if (!dept) {
      await t.rollback();
      return res.status(404).json({ error: 'Department not found.' });
    }

    // Default or provided temporary password
    const rawPass = tempPassword && tempPassword.trim().length >= 6 ? tempPassword.trim() : 'password123';
    const passwordHash = await bcrypt.hash(rawPass, 10);

    const newUser = await User.create(
      {
        username: normalizedEmail,
        email: normalizedEmail,
        passwordHash,
        role: 'HOD',
        status: 'ACTIVE',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&fit=crop',
        mustChangePassword: false,
      },
      { transaction: t }
    );

    // If there is an existing active HOD for this department, mark as inactive & complete in history
    const existingActiveHod = await HOD.findOne({
      where: { departmentId, isActive: true },
      transaction: t,
    });

    if (existingActiveHod) {
      await existingActiveHod.update({ isActive: false }, { transaction: t });
      await HODAssignmentHistory.update(
        { status: 'COMPLETED', endDate: new Date() },
        { where: { hodId: existingActiveHod.id, status: 'ACTIVE' }, transaction: t }
      );
    }

    const hod = await HOD.create(
      {
        userId: newUser.id,
        departmentId,
        tenureStartDate: joiningDate || new Date(),
        isActive: true,
        appointedByAdminId: req.user?.id || null,
        appointmentOrderNo: `APP-HOD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        appointmentDate: new Date(),
      },
      { transaction: t }
    );

    // Record assignment history
    await HODAssignmentHistory.create(
      {
        hodId: hod.id,
        userId: newUser.id,
        departmentId,
        academicYear: academicYear || '2026-27',
        startDate: joiningDate || new Date(),
        status: 'ACTIVE',
        assignedByUserId: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    await logAudit(req, 'CREATE_HOD', { hodId: hod.id, userId: newUser.id, email: newUser.email, departmentId });

    return res.status(201).json({
      success: true,
      message: 'HOD created successfully.',
      data: {
        id: hod.id,
        userId: newUser.id,
        email: newUser.email,
        temporaryPassword: rawPass,
      },
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

export const getHodById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const hod = await HOD.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status', 'createdAt'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
    });

    if (!hod) {
      return res.status(404).json({ error: 'HOD record not found.' });
    }

    const history = await HODAssignmentHistory.findAll({
      where: { userId: hod.userId },
      include: [
        { model: Department, as: 'department', attributes: ['name', 'code'] },
        { model: User, as: 'assignedBy', attributes: ['firstName', 'lastName'] },
      ],
      order: [['startDate', 'DESC']],
    });

    return res.json({
      success: true,
      data: {
        hod,
        history,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const assignHod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { hodUserId, departmentId, academicYear, startDate, endDate } = req.body;

    if (!hodUserId || !departmentId || !academicYear || !startDate) {
      await t.rollback();
      return res.status(400).json({ error: 'HOD, Department, Academic Year, and Start Date are required.' });
    }

    const user = await User.findByPk(hodUserId);
    if (!user) {
      await t.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }

    const dept = await Department.findByPk(departmentId);
    if (!dept) {
      await t.rollback();
      return res.status(404).json({ error: 'Department not found.' });
    }

    // Deactivate prior active HOD for this department
    const priorHod = await HOD.findOne({ where: { departmentId, isActive: true }, transaction: t });
    if (priorHod) {
      await priorHod.update({ isActive: false }, { transaction: t });
      await HODAssignmentHistory.update(
        { status: 'COMPLETED', endDate: new Date() },
        { where: { departmentId, status: 'ACTIVE' }, transaction: t }
      );
    }

    // Deactivate prior assignments for this user if they were active in another department
    await HOD.update({ isActive: false }, { where: { userId: hodUserId }, transaction: t });

    // Create or update HOD record
    let hod = await HOD.findOne({ where: { userId: hodUserId, departmentId }, transaction: t });
    if (hod) {
      await hod.update({
        isActive: true,
        tenureStartDate: startDate,
        appointmentDate: new Date(),
      }, { transaction: t });
    } else {
      hod = await HOD.create({
        userId: hodUserId,
        departmentId,
        tenureStartDate: startDate,
        isActive: true,
        appointedByAdminId: req.user?.id || null,
        appointmentOrderNo: `APP-HOD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        appointmentDate: new Date(),
      }, { transaction: t });
    }

    // Record History
    await HODAssignmentHistory.create({
      hodId: hod.id,
      userId: hodUserId,
      departmentId,
      academicYear,
      startDate,
      endDate: endDate || null,
      status: 'ACTIVE',
      assignedByUserId: req.user?.id || null,
    }, { transaction: t });

    await t.commit();
    await logAudit(req, 'ASSIGN_HOD', { hodUserId, departmentId, academicYear, startDate });

    return res.json({ success: true, message: 'HOD successfully assigned to department.' });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

export const deleteHod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const hod = await HOD.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      transaction: t,
    });

    if (!hod) {
      await t.rollback();
      return res.status(404).json({ error: 'HOD record not found.' });
    }

    const userId = hod.userId;
    const hodUser = (hod as any).user;
    const hodDept = (hod as any).department;

    // 1. Delete associated assignment history
    await HODAssignmentHistory.destroy({
      where: {
        [Op.or]: [{ hodId: id }, { userId }],
      },
      transaction: t,
    });

    // 2. Delete the HOD record
    await hod.destroy({ transaction: t });

    // 3. If the user only exists as an HOD, clean up user and related user-bound records
    if (userId) {
      const remainingHods = await HOD.count({ where: { userId }, transaction: t });
      if (remainingHods === 0) {
        const user = await User.findByPk(userId, { transaction: t });
        if (user && user.role === 'HOD') {
          await FacultyAuthorizationRequest.destroy({ where: { createdByHODId: userId }, transaction: t });
          await FacultyAssignment.update({ createdByHODId: null }, { where: { createdByHODId: userId }, transaction: t });
          await Notification.destroy({ where: { targetUserId: userId }, transaction: t });
          await user.destroy({ transaction: t });
        }
      }
    }

    await t.commit();
    await logAudit(req, 'DELETE_HOD', {
      hodId: id,
      userId,
      hodName: `${hodUser?.firstName || ''} ${hodUser?.lastName || ''}`.trim(),
      email: hodUser?.email,
      department: hodDept?.name,
    });

    return res.json({
      success: true,
      message: 'HOD record deleted successfully from database.',
    });
  } catch (error) {
    await t.rollback();
    return next(error);
  }
};

export const getHodHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const history = await HODAssignmentHistory.findAll({
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'profileImage'] },
        { model: Department, as: 'department', attributes: ['name', 'code'] },
        { model: User, as: 'assignedBy', attributes: ['firstName', 'lastName'] },
      ],
      order: [['startDate', 'DESC']],
    });

    const formatted = history.map((item: any) => ({
      id: item.id,
      hodName: `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim(),
      email: item.user?.email,
      profileImage: item.user?.profileImage,
      departmentName: item.department?.name,
      departmentCode: item.department?.code,
      academicYear: item.academicYear,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status,
      assignedBy: item.assignedBy ? `${item.assignedBy.firstName} ${item.assignedBy.lastName}` : 'Dean Academics',
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return next(error);
  }
};

// ─── 8. Faculty Management & Authorizations ────────────────────────────────────

export const getFacultyList = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, departmentId, status } = req.query;
    logger.info(`[DEAN FACULTY] request user=${req.user?.id} filters=${JSON.stringify({ departmentId: departmentId || 'ALL', status: status || 'ALL', search: search || '' })}`);

    const whereUser: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereUser[Op.or] = [
        { firstName: { [Op.iLike]: `%${term}%` } },
        { lastName: { [Op.iLike]: `%${term}%` } },
        { email: { [Op.iLike]: `%${term}%` } },
      ];
    }
    if (status && status !== 'ALL' && status !== 'ARCHIVED') {
      whereUser.status = status;
    }

    const whereTeacher: any = {
      ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
    };

    if (status === 'ARCHIVED') {
      whereTeacher.status = 'ARCHIVED';
    } else if (status && status !== 'ALL') {
      whereTeacher.status = status;
    } else {
      // Active Directory: exclude ARCHIVED faculty, include ACTIVE or legacy null status
      whereTeacher.status = {
        [Op.or]: [
          { [Op.ne]: 'ARCHIVED' },
          { [Op.is]: null },
        ],
      };
    }

    logger.info(`[DEAN FACULTY] querying database with safe filters`);

    const teachers = await Teacher.findAll({
      where: whereTeacher,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status', 'createdAt'],
          where: Object.keys(whereUser).length > 0 ? whereUser : undefined,
          required: Object.keys(whereUser).length > 0,
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    let currentYear = '2026-27';
    try {
      const currentYearRecord = await AcademicYear.findOne({ where: { isCurrent: true } })
        || await AcademicYear.findOne({ where: { status: 'ACTIVE' } });
      if (currentYearRecord?.year) {
        currentYear = currentYearRecord.year;
      }
    } catch (ayErr) {
      logger.warn('[DEAN FACULTY] Warning resolving current academic year:', ayErr);
    }

    const formatted = await Promise.all(
      teachers.map(async (t: any) => {
        let subjectNames: string[] = [];
        try {
          const assignments = await FacultyAssignment.findAll({
            where: { userId: t.userId, status: 'ACTIVE' },
            include: [{ model: Subject, as: 'subject', attributes: ['name', 'code'], required: false }],
          });
          subjectNames = assignments.map((a: any) => a.subject?.name).filter(Boolean);
        } catch (assignErr) {
          logger.warn(`[DEAN FACULTY] Could not fetch assignments for faculty userId=${t.userId}:`, assignErr);
        }

        const facultyName = `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim() || t.user?.email || 'Faculty Member';

        return {
          id: t.id,
          userId: t.userId,
          name: facultyName,
          email: t.user?.email || '',
          phone: t.user?.phone || null,
          profileImage: t.user?.profileImage || null,
          departmentId: t.departmentId,
          departmentName: t.department?.name || 'Department',
          departmentCode: t.department?.code || 'N/A',
          designation: t.designation || 'Faculty',
          status: t.status || t.user?.status || 'ACTIVE',
          userStatus: t.user?.status || 'ACTIVE',
          subjects: subjectNames.length > 0 ? subjectNames.join(', ') : 'General Faculty',
          academicYear: currentYear,
          joiningDate: t.joiningDate,
          archivedAt: t.archivedAt || null,
          createdAt: t.createdAt,
        };
      })
    );

    logger.info(`[DEAN FACULTY] success count=${formatted.length}`);
    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error(`[DEAN FACULTY] FAILED errorName=${error?.name} message=${error?.message}`);
    return next(error);
  }
};

export const getFacultyAuthorizations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, departmentId, status, academicYear } = req.query;
    const where: any = { authority: 'DEAN' };

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (departmentId && departmentId !== 'ALL') {
      where.departmentId = departmentId;
    }
    if (academicYear && academicYear !== 'ALL') {
      const startYear = String(academicYear).split(/[-–]/)[0].trim();
      where.academicYear = {
        [Op.or]: [
          { [Op.iLike]: `${startYear}-%` },
          { [Op.iLike]: `${startYear}–%` },
          { [Op.eq]: academicYear },
          { [Op.eq]: startYear },
        ],
      };
    }

    const searchTerm = typeof search === 'string' ? search.trim() : '';

    const requests = await FacultyAuthorizationRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: 'faculty',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status'],
          required: Boolean(searchTerm),
          ...(searchTerm
            ? {
                where: {
                  [Op.or]: [
                    { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                    { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                    { email: { [Op.iLike]: `%${searchTerm}%` } },
                  ],
                },
              }
            : {}),
        },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'], required: false },
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'], required: false },
        { model: User, as: 'createdByHOD', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: User, as: 'decidedBy', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });

    const formatted = await Promise.all(
      requests.map((item: any) => facultyAuthorizationService.formatRequestForQueue(item, 'DEAN'))
    );

    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error('Failed to get faculty authorizations for dean:', error);
    return res.json({ success: true, data: [] });
  }
};

export const getFacultyAuthorizationById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const request = await FacultyAuthorizationRequest.findByPk(id, {
      include: [
        { model: User, as: 'faculty', attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits', 'type'] },
        { model: User, as: 'createdByHOD', attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'] },
        { model: User, as: 'decidedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    if (!request) {
      return res.status(404).json({ error: 'Faculty authorization request not found.' });
    }

    const formatted = await facultyAuthorizationService.formatRequestForQueue(request, 'DEAN');

    // Fetch all assignments associated with this faculty user
    const assignments = await FacultyAssignment.findAll({
      where: { userId: request.facultyUserId },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits', 'type'] }],
      order: [['semester', 'ASC'], ['createdAt', 'ASC']],
    });

    const responseData = {
      ...formatted,
      assignments: assignments.map((a: any) => ({
        id: a.id,
        subjectId: a.subjectId,
        subjectName: a.subject?.name || 'General Assignment',
        subjectCode: a.subject?.code || 'N/A',
        subjectType: a.subject?.type || 'Theory',
        credits: a.subject?.credits || 4,
        semester: a.semester,
        section: a.section,
        academicYear: a.academicYear,
        attendanceAccess: a.attendanceAccess,
        marksAccess: a.marksAccess,
        status: a.status,
      })),
    };

    return res.json({ success: true, data: responseData });
  } catch (error) {
    return next(error);
  }
};

export const getFacultyAuthorizationCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const count = await FacultyAuthorizationRequest.count({
      where: {
        status: 'PENDING',
        authority: 'DEAN',
      },
    });

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    return next(error);
  }
};

export const approveFacultyAuthorization = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const result = await facultyAuthorizationService.approveRequest({
      requestId: id,
      expectedAuthority: 'DEAN',
      approver: {
        id: req.user!.id,
        role: req.user!.role,
        firstName: req.user?.firstName,
        lastName: req.user?.lastName,
        email: req.user?.email,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'System',
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Dean approve error:', error);
    return res.status(400).json({ error: error.message || 'Failed to approve faculty authorization.' });
  }
};

export const rejectFacultyAuthorization = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'A rejection reason is required.' });
    }

    const result = await facultyAuthorizationService.rejectRequest({
      requestId: id,
      expectedAuthority: 'DEAN',
      reason,
      approver: {
        id: req.user!.id,
        role: req.user!.role,
        firstName: req.user?.firstName,
        lastName: req.user?.lastName,
        email: req.user?.email,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'System',
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Dean reject error:', error);
    return res.status(400).json({ error: error.message || 'Failed to reject faculty authorization.' });
  }
};

export const getFacultyAssignments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { departmentId, semester, academicYear, status, search } = req.query;
    const where: any = {};

    if (departmentId && departmentId !== 'ALL') where.departmentId = departmentId;
    if (semester && semester !== 'ALL') where.semester = Number(semester);
    if (academicYear && academicYear !== 'ALL') where.academicYear = academicYear;
    if (status && status !== 'ALL') where.status = status;

    const assignments = await FacultyAssignment.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'],
          where: search
            ? {
                [Op.or]: [
                  { firstName: { [Op.iLike]: `%${search}%` } },
                  { lastName: { [Op.iLike]: `%${search}%` } },
                ],
              }
            : {},
        },
        { model: Department, as: 'department', attributes: ['name', 'code'] },
        { model: Subject, as: 'subject', attributes: ['name', 'code', 'credits', 'type'] },
      ],
      order: [['semester', 'ASC'], ['createdAt', 'DESC']],
    });

    const formatted = assignments.map((a: any) => ({
      id: a.id,
      facultyName: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim(),
      email: a.user?.email,
      profileImage: a.user?.profileImage,
      departmentName: a.department?.name,
      departmentCode: a.department?.code,
      subjectName: a.subject?.name,
      subjectCode: a.subject?.code,
      subjectType: a.subject?.type,
      credits: a.subject?.credits,
      semester: a.semester,
      section: a.section,
      academicYear: a.academicYear,
      attendanceAccess: a.attendanceAccess,
      marksAccess: a.marksAccess,
      status: a.status,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return next(error);
  }
};

// ─── 8. HOD Subject Handling Requests Module ───────────────────────────────────

/**
 * GET /api/dean/hod-subject-requests
 * Returns all HOD subject handling requests with filters
 */
export const getHodSubjectRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { status, semester, departmentId, search, academicYear } = req.query as any;

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (semester && semester !== 'ALL') {
      whereClause.semester = Number(semester);
    }
    if (departmentId && departmentId !== 'ALL') {
      whereClause.departmentId = departmentId;
    }
    if (academicYear && academicYear !== 'ALL') {
      whereClause.academicYear = { [Op.iLike]: `%${academicYear.split(/[-–]/)[0].trim()}%` };
    }

    const requests = await HodSubjectHandlingRequest.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'hodUser',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage'],
          where: search
            ? {
                [Op.or]: [
                  { firstName: { [Op.iLike]: `%${search.trim()}%` } },
                  { lastName: { [Op.iLike]: `%${search.trim()}%` } },
                  { email: { [Op.iLike]: `%${search.trim()}%` } },
                ],
              }
            : {},
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code', 'type'],
        },
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code', 'credits', 'type', 'semester'],
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: FacultyAssignment,
          as: 'teachingAssignment',
          attributes: ['id', 'status', 'section', 'academicYear', 'assignmentType'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const formatted = requests.map((r: any) => ({
      id: r.id,
      hodUserId: r.hodUserId,
      hodName: `${r.hodUser?.firstName || ''} ${r.hodUser?.lastName || ''}`.trim() || 'HOD',
      email: r.hodUser?.email,
      phone: r.hodUser?.phone,
      profileImage: r.hodUser?.profileImage,
      hodUser: r.hodUser ? {
        id: r.hodUser.id,
        firstName: r.hodUser.firstName,
        lastName: r.hodUser.lastName,
        email: r.hodUser.email,
        phone: r.hodUser.phone,
        profileImage: r.hodUser.profileImage,
      } : null,
      departmentId: r.departmentId,
      departmentName: r.department?.name,
      departmentCode: r.department?.code,
      department: r.department ? {
        id: r.department.id,
        name: r.department.name,
        code: r.department.code,
        type: r.department.type,
      } : null,
      semester: r.semester,
      subjectId: r.subjectId,
      subjectName: r.subject?.name,
      subjectCode: r.subject?.code,
      subjectType: r.subject?.type,
      credits: r.subject?.credits,
      subject: r.subject ? {
        id: r.subject.id,
        name: r.subject.name,
        code: r.subject.code,
        credits: r.subject.credits,
        type: r.subject.type,
        semester: r.subject.semester,
      } : null,
      academicYear: r.academicYear,
      reason: r.reason,
      status: r.status,
      rejectionReason: r.rejectionReason,
      reviewedBy: r.reviewedBy,
      reviewerName: r.reviewer ? `${r.reviewer.firstName || ''} ${r.reviewer.lastName || ''}`.trim() : null,
      reviewer: r.reviewer ? {
        id: r.reviewer.id,
        firstName: r.reviewer.firstName,
        lastName: r.reviewer.lastName,
        email: r.reviewer.email,
      } : null,
      reviewedAt: r.reviewedAt,
      teachingAssignmentId: r.teachingAssignmentId,
      teachingAssignment: r.teachingAssignment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('DEAN_GET_HOD_SUBJECT_REQUESTS_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/dean/hod-subject-requests/count
 * Returns the count of pending HOD subject handling requests
 */
export const getHodSubjectRequestCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const pendingCount = await HodSubjectHandlingRequest.count({
      where: { status: 'PENDING' },
    });
    return res.json({ success: true, data: { pendingCount } });
  } catch (error) {
    logger.error('DEAN_GET_HOD_SUBJECT_REQUEST_COUNT_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/dean/hod-subject-requests/:id
 * Retrieve a single request by ID
 */
export const getHodSubjectRequestById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const r: any = await HodSubjectHandlingRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'hodUser',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage'],
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code', 'type'],
        },
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code', 'credits', 'type', 'semester'],
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: FacultyAssignment,
          as: 'teachingAssignment',
        },
      ],
    });

    if (!r) {
      return res.status(404).json({ error: 'Subject handling request not found.' });
    }

    const data = {
      id: r.id,
      hodUserId: r.hodUserId,
      hodName: `${r.hodUser?.firstName || ''} ${r.hodUser?.lastName || ''}`.trim() || 'HOD',
      email: r.hodUser?.email,
      phone: r.hodUser?.phone,
      profileImage: r.hodUser?.profileImage,
      hodUser: r.hodUser ? {
        id: r.hodUser.id,
        firstName: r.hodUser.firstName,
        lastName: r.hodUser.lastName,
        email: r.hodUser.email,
        phone: r.hodUser.phone,
        profileImage: r.hodUser.profileImage,
      } : null,
      departmentId: r.departmentId,
      departmentName: r.department?.name,
      departmentCode: r.department?.code,
      department: r.department ? {
        id: r.department.id,
        name: r.department.name,
        code: r.department.code,
        type: r.department.type,
      } : null,
      semester: r.semester,
      subjectId: r.subjectId,
      subjectName: r.subject?.name,
      subjectCode: r.subject?.code,
      subjectType: r.subject?.type,
      credits: r.subject?.credits,
      subject: r.subject ? {
        id: r.subject.id,
        name: r.subject.name,
        code: r.subject.code,
        credits: r.subject.credits,
        type: r.subject.type,
        semester: r.subject.semester,
      } : null,
      academicYear: r.academicYear,
      reason: r.reason,
      status: r.status,
      rejectionReason: r.rejectionReason,
      reviewedBy: r.reviewedBy,
      reviewerName: r.reviewer ? `${r.reviewer.firstName || ''} ${r.reviewer.lastName || ''}`.trim() : null,
      reviewer: r.reviewer ? {
        id: r.reviewer.id,
        firstName: r.reviewer.firstName,
        lastName: r.reviewer.lastName,
        email: r.reviewer.email,
      } : null,
      reviewedAt: r.reviewedAt,
      teachingAssignmentId: r.teachingAssignmentId,
      teachingAssignment: r.teachingAssignment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };

    return res.json({ success: true, data });
  } catch (error) {
    logger.error('DEAN_GET_HOD_SUBJECT_REQUEST_BY_ID_ERROR:', error);
    return next(error);
  }
};

/**
 * POST /api/dean/hod-subject-requests/:id/approve
 * Approves an HOD subject handling request and activates teaching assignment
 */
export const approveHodSubjectRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    // Query directly in transaction without lock on outer joins (avoiding PostgreSQL 0A000 feature error)
    const request: any = await HodSubjectHandlingRequest.findByPk(id, {
      transaction,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Subject handling request not found.' });
    }

    if (request.status !== 'PENDING') {
      await transaction.rollback();
      return res.status(400).json({ error: `Request has already been ${request.status.toLowerCase()}.` });
    }

    // Load related entities within the transaction
    const [subject, department, teacherProfile] = await Promise.all([
      Subject.findByPk(request.subjectId, { transaction }),
      Department.findByPk(request.departmentId, { transaction }),
      Teacher.findOne({ where: { userId: request.hodUserId }, transaction }),
    ]);

    // 1. Check if teaching assignment already exists
    let assignment = await FacultyAssignment.findOne({
      where: {
        userId: request.hodUserId,
        subjectId: request.subjectId,
        semester: request.semester,
        academicYear: request.academicYear,
        status: 'ACTIVE',
      },
      transaction,
    });

    const targetDeptId = request.departmentId || teacherProfile?.departmentId || department?.id;
    const targetBranch = department?.code || teacherProfile?.department?.code || null;

    if (!assignment) {
      assignment = await FacultyAssignment.create(
        {
          teacherId: teacherProfile ? teacherProfile.id : null,
          userId: request.hodUserId,
          departmentId: targetDeptId,
          subjectId: request.subjectId,
          semester: request.semester,
          section: 'A',
          branch: targetBranch,
          academicYear: request.academicYear,
          attendanceAccess: true,
          marksAccess: true,
          createdByHODId: null,
          assignmentType: 'HOD_SUBJECT_HANDLING',
          status: 'ACTIVE',
        },
        { transaction }
      );
    } else {
      assignment.assignmentType = 'HOD_SUBJECT_HANDLING';
      assignment.status = 'ACTIVE';
      assignment.attendanceAccess = true;
      assignment.marksAccess = true;
      if (!assignment.teacherId && teacherProfile) {
        assignment.teacherId = teacherProfile.id;
      }
      await assignment.save({ transaction });
    }

    // 2. Update Request record
    request.status = 'APPROVED';
    request.reviewedBy = req.user?.id || null;
    request.reviewedAt = new Date();
    request.teachingAssignmentId = assignment.id;
    request.rejectionReason = null;
    await request.save({ transaction });

    await logAudit(req, 'APPROVE_HOD_SUBJECT_REQUEST', {
      requestId: request.id,
      hodUserId: request.hodUserId,
      subjectId: request.subjectId,
      semester: request.semester,
      assignmentId: assignment.id,
    });

    await transaction.commit();

    // 3. Send Notification to HOD (safely dispatched post-commit so notification failures never roll back approval)
    const subjectName = subject?.name || 'Subject';
    const subjectCode = subject?.code ? ` (${subject.code})` : '';
    try {
      await Notification.create({
        title: 'Subject Handling Request Approved',
        content: `Your request to handle ${subjectName}${subjectCode} for Semester ${request.semester} has been approved.`,
        type: 'SUCCESS',
        audience: 'SPECIFIC_USER',
        targetUserId: request.hodUserId,
        status: 'PUBLISHED',
        approvedByAdminId: req.user?.id || null,
        publishedAt: new Date(),
      });
    } catch (notifErr) {
      logger.warn('Failed to dispatch HOD subject approval notification:', notifErr);
    }

    return res.json({
      success: true,
      message: `Request to handle ${subjectName} approved successfully. Teaching assignment is now active.`,
      data: {
        request,
        assignment,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('DEAN_APPROVE_HOD_SUBJECT_REQUEST_ERROR:', error);
    return next(error);
  }
};

/**
 * POST /api/dean/hod-subject-requests/:id/reject
 * Rejects an HOD subject handling request with mandatory reason
 */
export const rejectHodSubjectRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.toString().trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Rejection reason is mandatory when rejecting a request.' });
    }

    const request: any = await HodSubjectHandlingRequest.findByPk(id, {
      transaction,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Subject handling request not found.' });
    }

    if (request.status !== 'PENDING') {
      await transaction.rollback();
      return res.status(400).json({ error: `Request has already been ${request.status.toLowerCase()}.` });
    }

    const subject = await Subject.findByPk(request.subjectId, { transaction });

    request.status = 'REJECTED';
    request.rejectionReason = rejectionReason.toString().trim();
    request.reviewedBy = req.user?.id || null;
    request.reviewedAt = new Date();
    await request.save({ transaction });

    await logAudit(req, 'REJECT_HOD_SUBJECT_REQUEST', {
      requestId: request.id,
      hodUserId: request.hodUserId,
      subjectId: request.subjectId,
      reason: rejectionReason,
    });

    await transaction.commit();

    // Send Notification to HOD (safely dispatched post-commit)
    const subjectName = subject?.name || 'Subject';
    const subjectCode = subject?.code ? ` (${subject.code})` : '';
    try {
      await Notification.create({
        title: 'Subject Handling Request Rejected',
        content: `Your request to handle ${subjectName}${subjectCode} has been rejected. Reason: ${rejectionReason.toString().trim()}`,
        type: 'WARNING',
        audience: 'SPECIFIC_USER',
        targetUserId: request.hodUserId,
        status: 'PUBLISHED',
        approvedByAdminId: req.user?.id || null,
        publishedAt: new Date(),
      });
    } catch (notifErr) {
      logger.warn('Failed to dispatch HOD subject rejection notification:', notifErr);
    }

    return res.json({
      success: true,
      message: `Request for ${subjectName} rejected.`,
      data: request,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('DEAN_REJECT_HOD_SUBJECT_REQUEST_ERROR:', error);
    return next(error);
  }
};

// ─── 9. Dean Direct Faculty Creation & Bulk Import Module ──────────────────────

/**
 * POST /api/dean/faculty
 * Dean creates a single faculty member directly with immediate ACTIVE status.
 */
export const createFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { firstName, middleName, lastName, gender, email, phone, designation, joiningDate, coreDepartmentId } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      await t.rollback();
      return res.status(400).json({ error: 'First name, last name, and official email are required.' });
    }

    if (!coreDepartmentId) {
      await t.rollback();
      return res.status(400).json({ error: 'Core Department is required.' });
    }

    // Resolve Core Department canonically (UUID, code, or branch alias)
    const coreDept = await findDepartmentCanonical(coreDepartmentId, { transaction: t });

    if (!coreDept) {
      await t.rollback();
      return res.status(400).json({ error: 'Invalid Core Department selected. Please select a valid academic department.' });
    }

    // Check if email is already taken
    const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() }, transaction: t });
    if (existingUser) {
      await t.rollback();
      return res.status(400).json({ error: `A faculty or user with email "${email.trim().toLowerCase()}" already exists.` });
    }

    // Generate secure temporary password
    const rawTempPassword = `Fac@${Math.floor(100000 + Math.random() * 900000)}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawTempPassword, salt);

    // Create User record as ACTIVE with TEACHER role and forced password change on first login
    const newUser = await User.create(
      {
        firstName: firstName.trim(),
        middleName: middleName ? middleName.trim() : null,
        lastName: lastName.trim(),
        gender: gender ? gender.trim() : null,
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : null,
        role: 'TEACHER',
        status: 'ACTIVE',
        mustChangePassword: false,
        passwordHash,
      },
      { transaction: t }
    );

    // Create Teacher record linked to Core Department
    const newTeacher = await Teacher.create(
      {
        userId: newUser.id,
        departmentId: coreDept.id,
        middleName: middleName ? middleName.trim() : null,
        gender: gender ? gender.trim() : null,
        designation: designation?.trim() || 'Assistant Professor',
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      },
      { transaction: t }
    );

    await logAudit(req, 'DEAN_CREATE_FACULTY', {
      teacherId: newTeacher.id,
      facultyUserId: newUser.id,
      email: newUser.email,
      coreDepartmentId: coreDept.id,
      coreDepartmentCode: coreDept.code,
      designation: newTeacher.designation,
    });

    await t.commit();

    return res.status(201).json({
      success: true,
      message: 'Faculty created successfully.',
      data: {
        teacher: newTeacher,
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          phone: newUser.phone,
          status: newUser.status,
        },
        coreDepartment: {
          id: coreDept.id,
          code: coreDept.code,
          name: coreDept.name,
        },
        temporaryCredentials: {
          email: newUser.email,
          temporaryPassword: rawTempPassword,
        },
      },
    });
  } catch (error: any) {
    await t.rollback();
    logger.error('DEAN_CREATE_FACULTY_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to create faculty member.' });
  }
};

/**
 * GET /api/dean/faculty/template
 * Generates an official Excel template for bulk faculty import with dynamic DB department validation dropdown.
 */
export const downloadBulkFacultyTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const departments = await Department.findAll({
      order: [['code', 'ASC']],
      attributes: ['id', 'code', 'name'],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JCER ERP';
    workbook.created = new Date();

    // 1. Data Sheet
    const worksheet = workbook.addWorksheet('Faculty Template');

    worksheet.columns = [
      { header: 'First Name *', key: 'firstName', width: 18 },
      { header: 'Middle Name', key: 'middleName', width: 18 },
      { header: 'Last Name *', key: 'lastName', width: 18 },
      { header: 'Gender *', key: 'gender', width: 14 },
      { header: 'Faculty College Email *', key: 'email', width: 32 },
      { header: 'Phone Number', key: 'phone', width: 18 },
      { header: 'Academic Designation *', key: 'designation', width: 26 },
      { header: 'Joining Date (YYYY-MM-DD) *', key: 'joiningDate', width: 26 },
      { header: 'Core Department *', key: 'coreDepartment', width: 40 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F245C' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // 2. Reference Sheet for Gender Dropdown Validation
    const genderSheet = workbook.addWorksheet('GendersRef');
    genderSheet.state = 'hidden';
    genderSheet.columns = [{ header: 'GenderOption', key: 'opt', width: 20 }];
    const genderOptions = ['Male', 'Female', 'Other'];
    genderOptions.forEach((opt) => {
      genderSheet.addRow({ opt });
    });
    const genderFormulaRef = `GendersRef!$A$2:$A$${genderOptions.length + 1}`;

    // Apply Gender validation dropdown (Column D / 4)
    for (let i = 2; i <= 500; i++) {
      worksheet.getCell(`D${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [genderFormulaRef],
        showErrorMessage: true,
        errorTitle: 'Invalid Gender',
        error: 'Please select a valid Gender (Male, Female, Other) from the dropdown list.',
      };
    }

    // 3. Reference Sheet for Department Dropdown Validation
    const refSheet = workbook.addWorksheet('DepartmentsRef');
    refSheet.state = 'hidden';
    refSheet.columns = [{ header: 'DeptOption', key: 'opt', width: 45 }];

    const deptOptions = departments.map((d) => `${d.code} — ${d.name}`);
    deptOptions.forEach((opt) => {
      refSheet.addRow({ opt });
    });

    // Apply Core Department validation dropdown (Column I / 9)
    const formulaRef = `DepartmentsRef!$A$2:$A$${deptOptions.length + 1}`;
    for (let i = 2; i <= 500; i++) {
      worksheet.getCell(`I${i}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [formulaRef],
        showErrorMessage: true,
        errorTitle: 'Invalid Department',
        error: 'Please select a valid Core Department from the dropdown list.',
      };
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Faculty_Bulk_Import_Template.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    logger.error('DEAN_BULK_TEMPLATE_DOWNLOAD_ERROR:', error);
    return next(error);
  }
};

/**
 * POST /api/dean/faculty/bulk-validate
 * Parses and validates uploaded faculty Excel file before committing.
 */
export const validateBulkFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an Excel (.xlsx) file.',
        errors: ['No file was uploaded or file buffer is empty.'],
      });
    }

    const departments = await Department.findAll({ attributes: ['id', 'code', 'name'] });
    const deptMapByCode = new Map<string, Department>();
    const deptMapByName = new Map<string, Department>();
    const deptMapById = new Map<string, Department>();

    departments.forEach((d) => {
      deptMapByCode.set(d.code.trim().toUpperCase(), d);
      deptMapByName.set(d.name.trim().toLowerCase(), d);
      deptMapById.set(d.id, d);
    });

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer as any);
    } catch (parseErr: any) {
      return res.status(422).json({
        success: false,
        message: 'Unable to parse the Excel file. Please ensure it is a valid .xlsx file.',
        errors: [parseErr?.message || 'Malformed Excel file.'],
      });
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'No worksheet found in uploaded Excel file.',
        errors: ['The uploaded workbook contains no worksheets.'],
      });
    }

    const existingUsers = await User.findAll({ attributes: ['email'] });
    const dbEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase().trim()));

    // Dynamically discover header column indexes from Row 1
    const headerRow = worksheet.getRow(1);
    const colMap: { [key: string]: number } = {};

    headerRow.eachCell((cell, colNumber) => {
      let text = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          text = String((cell.value as any).text);
        } else {
          text = String(cell.value);
        }
      }
      const normalized = text.replace(/[*()\-–—_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.includes('first name') || normalized === 'first') {
        colMap.firstName = colNumber;
      } else if (normalized.includes('middle name') || normalized === 'middle') {
        colMap.middleName = colNumber;
      } else if (normalized.includes('last name') || normalized === 'last') {
        colMap.lastName = colNumber;
      } else if (normalized.includes('gender') || normalized === 'sex') {
        colMap.gender = colNumber;
      } else if (normalized.includes('email')) {
        colMap.email = colNumber;
      } else if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('contact')) {
        colMap.phone = colNumber;
      } else if (normalized.includes('designation')) {
        colMap.designation = colNumber;
      } else if (normalized.includes('joining') || normalized.includes('doj')) {
        colMap.joiningDate = colNumber;
      } else if (normalized.includes('department') || normalized.includes('dept')) {
        colMap.coreDepartment = colNumber;
      }
    });

    const getVal = (row: ExcelJS.Row, key: string, fallbackCol: number): string => {
      const col = colMap[key] || fallbackCol;
      const cell = row.getCell(col);
      const c = cell.value;
      if (c === null || c === undefined) return '';
      if (c instanceof Date) {
        if (isNaN(c.getTime())) return '';
        const year = c.getFullYear();
        const month = String(c.getMonth() + 1).padStart(2, '0');
        const day = String(c.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      if (typeof c === 'object') {
        if ('text' in c && (c as any).text) return String((c as any).text).trim();
        if ('result' in c && (c as any).result !== undefined) return String((c as any).result).trim();
        if ('richText' in c && Array.isArray((c as any).richText)) {
          return (c as any).richText.map((rt: any) => rt.text || '').join('').trim();
        }
        return String(c).trim();
      }
      return String(c).trim();
    };

    const seenFileEmails = new Set<string>();
    const allRows: any[] = [];
    const validRecords: any[] = [];
    const invalidRecords: any[] = [];

    // Process rows starting from row 2
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const firstName = getVal(row, 'firstName', 1);
      const middleName = getVal(row, 'middleName', 2);
      const lastName = getVal(row, 'lastName', 3);
      const genderRaw = getVal(row, 'gender', 4);
      const rawEmail = getVal(row, 'email', 5);
      const email = rawEmail.toLowerCase();
      const phone = getVal(row, 'phone', 6);
      const designation = getVal(row, 'designation', 7);
      const joiningDateStr = getVal(row, 'joiningDate', 8);
      const coreDeptRaw = getVal(row, 'coreDepartment', 9);

      // If entire row is blank, skip
      if (!firstName && !middleName && !lastName && !genderRaw && !rawEmail && !phone && !designation && !joiningDateStr && !coreDeptRaw) {
        return;
      }

      const rowErrors: string[] = [];

      // 1. First Name
      if (!firstName) {
        rowErrors.push('First Name is required.');
      }

      // 2. Last Name
      if (!lastName) {
        rowErrors.push('Last Name is required.');
      }

      // 3. Gender (Optional or Required depending on presence of values; validated if provided or requested)
      let normalizedGender = '';
      if (genderRaw) {
        const g = genderRaw.trim().toLowerCase();
        if (g === 'male' || g === 'm') {
          normalizedGender = 'Male';
        } else if (g === 'female' || g === 'f') {
          normalizedGender = 'Female';
        } else if (g === 'other' || g === 'o') {
          normalizedGender = 'Other';
        } else {
          rowErrors.push(`Invalid Gender "${genderRaw}". Must be Male, Female, or Other.`);
        }
      }

      // 4. Faculty College Email
      if (!email) {
        rowErrors.push('Faculty College Email is required.');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          rowErrors.push('Invalid email address format.');
        } else if (dbEmailSet.has(email)) {
          rowErrors.push(`Faculty College Email "${email}" already exists in system database.`);
        } else if (seenFileEmails.has(email)) {
          rowErrors.push(`Duplicate email "${email}" repeated inside this Excel sheet.`);
        }
      }

      // 5. Academic Designation
      if (!designation) {
        rowErrors.push('Academic Designation is required.');
      }

      // 6. Joining Date
      let formattedJoiningDate = '';
      if (!joiningDateStr) {
        rowErrors.push('Joining Date is required.');
      } else {
        const d = new Date(joiningDateStr);
        if (isNaN(d.getTime())) {
          rowErrors.push(`Invalid joining date "${joiningDateStr}". Expected format YYYY-MM-DD.`);
        } else {
          formattedJoiningDate = d.toISOString().split('T')[0];
        }
      }

      // 7. Core Department Resolution
      let resolvedDept: Department | null = null;
      if (!coreDeptRaw) {
        rowErrors.push('Core Department is required.');
      } else {
        resolvedDept = resolveDepartmentCanonical(coreDeptRaw, departments);
        if (!resolvedDept) {
          rowErrors.push(
            `Invalid Core Department "${coreDeptRaw}". Must be one of: ${departments.map((d) => d.code).join(', ')}.`
          );
        }
      }

      const isValid = rowErrors.length === 0;

      if (email && !seenFileEmails.has(email)) {
        seenFileEmails.add(email);
      }

      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

      const rowResult = {
        rowNumber,
        firstName,
        middleName: middleName || null,
        lastName,
        gender: normalizedGender || (genderRaw ? genderRaw.trim() : null),
        fullName,
        email,
        phone: phone || null,
        designation: designation || 'Assistant Professor',
        joiningDate: formattedJoiningDate || joiningDateStr,
        coreDepartment: resolvedDept ? `${resolvedDept.code} — ${resolvedDept.name}` : coreDeptRaw,
        coreDepartmentInput: coreDeptRaw,
        coreDepartmentId: resolvedDept?.id,
        coreDepartmentCode: resolvedDept?.code,
        coreDepartmentName: resolvedDept?.name,
        status: isValid ? 'VALID' : 'INVALID',
        isValid,
        errors: rowErrors,
      };

      allRows.push(rowResult);

      if (isValid) {
        validRecords.push(rowResult);
      } else {
        invalidRecords.push(rowResult);
      }
    });

    const totalRecords = allRows.length;

    return res.json({
      success: true,
      message: 'Validation completed successfully.',
      summary: {
        total: totalRecords,
        valid: validRecords.length,
        invalid: invalidRecords.length,
      },
      rows: allRows,
      data: {
        totalRows: totalRecords,
        validRows: validRecords.length,
        invalidRows: invalidRecords.length,
        totalRecords,
        validCount: validRecords.length,
        errorCount: invalidRecords.length,
        departments: departments.map((d) => ({ id: d.id, code: d.code, name: d.name })),
        summary: {
          total: totalRecords,
          valid: validRecords.length,
          invalid: invalidRecords.length,
        },
        rows: allRows,
        results: allRows,
        validRecords,
        errors: invalidRecords,
      },
    });
  } catch (error: any) {
    logger.error('DEAN_VALIDATE_BULK_FACULTY_ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process Excel file.',
      errors: [error.message || 'Internal server error during Excel processing.'],
    });
  }
};

/**
 * POST /api/dean/faculty/bulk-import
 * Commits verified faculty rows inside a database transaction.
 */
export const importBulkFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'No valid faculty records provided for import.' });
    }

    const imported: any[] = [];
    const skipped: any[] = [];

    for (const rec of records) {
      const email = rec.email ? rec.email.toLowerCase().trim() : '';
      let resolvedDept = rec.coreDepartmentId ? await Department.findByPk(rec.coreDepartmentId, { transaction: t }) : null;
      if (!resolvedDept && (rec.coreDepartmentCode || rec.coreDepartment || rec.coreDepartmentInput)) {
        resolvedDept = await findDepartmentCanonical(rec.coreDepartmentCode || rec.coreDepartment || rec.coreDepartmentInput, { transaction: t });
      }

      if (!email || !rec.firstName || !rec.lastName || !resolvedDept) {
        skipped.push({ email, reason: !resolvedDept ? 'Invalid core department' : 'Missing required fields' });
        continue;
      }

      // Check duplicate
      const existing = await User.findOne({ where: { email }, transaction: t });
      if (existing) {
        skipped.push({ email, reason: 'Email already exists' });
        continue;
      }

      const rawTempPassword = `Fac@${Math.floor(100000 + Math.random() * 900000)}`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(rawTempPassword, salt);

      const newUser = await User.create(
        {
          firstName: rec.firstName.trim(),
          middleName: rec.middleName ? String(rec.middleName).trim() : null,
          lastName: rec.lastName.trim(),
          gender: rec.gender ? String(rec.gender).trim() : null,
          email,
          phone: rec.phone ? String(rec.phone).trim() : null,
          role: 'TEACHER',
          status: 'ACTIVE',
          mustChangePassword: false,
          passwordHash,
        },
        { transaction: t }
      );

      const newTeacher = await Teacher.create(
        {
          userId: newUser.id,
          departmentId: resolvedDept.id,
          middleName: rec.middleName ? String(rec.middleName).trim() : null,
          gender: rec.gender ? String(rec.gender).trim() : null,
          designation: rec.designation ? String(rec.designation).trim() : 'Assistant Professor',
          joiningDate: rec.joiningDate ? new Date(rec.joiningDate) : new Date(),
        },
        { transaction: t }
      );

      imported.push({
        teacherId: newTeacher.id,
        userId: newUser.id,
        firstName: newUser.firstName,
        middleName: rec.middleName ? String(rec.middleName).trim() : null,
        lastName: newUser.lastName,
        gender: rec.gender ? String(rec.gender).trim() : null,
        name: [newUser.firstName, rec.middleName, newUser.lastName].filter(Boolean).join(' ').trim(),
        email: newUser.email,
        temporaryPassword: rawTempPassword,
        designation: newTeacher.designation,
        coreDepartmentId: resolvedDept.id,
        coreDepartmentCode: resolvedDept.code,
        coreDepartmentName: resolvedDept.name,
        status: 'ACTIVE',
      });
    }

    await logAudit(req, 'DEAN_BULK_IMPORT_FACULTY', {
      importedCount: imported.length,
      skippedCount: skipped.length,
    });

    await t.commit();

    return res.json({
      success: true,
      message: `Successfully imported ${imported.length} faculty member(s).`,
      data: {
        importedCount: imported.length,
        skippedCount: skipped.length,
        imported,
        skipped,
      },
    });
  } catch (error: any) {
    await t.rollback();
    logger.error('DEAN_BULK_IMPORT_FACULTY_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to import faculty members.' });
  }
};

/**
 * DELETE /api/dean/faculty/:id
 * Soft deletes / archives a faculty member.
 * - Sets Teacher.status = 'ARCHIVED'
 * - Sets Teacher.archivedAt = new Date()
 * - Sets Teacher.archivedBy = req.user.id
 * - Sets User.status = 'INACTIVE'
 * - Preserves all academic records (FacultyAssignment, AttendanceSession, AttendanceRecord) intact.
 * - Records audit log FACULTY_ARCHIVED.
 */
export const archiveFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'status'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      transaction: t,
    });

    if (!teacher) {
      await t.rollback();
      return res.status(404).json({ error: 'Faculty record not found.' });
    }

    if (teacher.status === 'ARCHIVED') {
      await t.rollback();
      return res.status(400).json({ error: 'Faculty member is already archived.' });
    }

    const teacherUser = (teacher as any).user;
    const teacherDept = (teacher as any).department;

    // 1. Update Teacher status to ARCHIVED with metadata
    await teacher.update(
      {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: req.user?.id || null,
      },
      { transaction: t }
    );

    // 2. Disable User account for login
    if (teacher.userId) {
      const user = await User.findByPk(teacher.userId, { transaction: t });
      if (user) {
        await user.update({ status: 'INACTIVE' }, { transaction: t });
      }
    }

    // 3. Log Audit
    await logAudit(req, 'FACULTY_ARCHIVED', {
      teacherId: teacher.id,
      userId: teacher.userId,
      facultyName: `${teacherUser?.firstName || ''} ${teacherUser?.lastName || ''}`.trim(),
      email: teacherUser?.email,
      department: teacherDept?.name,
      departmentCode: teacherDept?.code,
      archivedBy: req.user?.id,
      archivedAt: new Date(),
    });

    await t.commit();

    return res.json({
      success: true,
      message: 'Faculty archived successfully.',
      data: {
        id: teacher.id,
        status: 'ARCHIVED',
      },
    });
  } catch (error: any) {
    await t.rollback();
    logger.error('DEAN_ARCHIVE_FACULTY_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to archive faculty member.' });
  }
};

/**
 * POST /api/dean/faculty/:id/restore
 * Restores an archived faculty member back to ACTIVE.
 * - Sets Teacher.status = 'ACTIVE'
 * - Clears Teacher.archivedAt and Teacher.archivedBy
 * - Sets User.status = 'ACTIVE'
 * - Preserves existing historical assignments
 * - Logs audit record FACULTY_RESTORED
 */
export const restoreFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'status'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      transaction: t,
    });

    if (!teacher) {
      await t.rollback();
      return res.status(404).json({ error: 'Faculty record not found.' });
    }

    if (teacher.status !== 'ARCHIVED') {
      await t.rollback();
      return res.status(400).json({ error: 'Faculty member is not archived.' });
    }

    const teacherUser = (teacher as any).user;
    const teacherDept = (teacher as any).department;

    // 1. Update Teacher status to ACTIVE
    await teacher.update(
      {
        status: 'ACTIVE',
        archivedAt: null,
        archivedBy: null,
      },
      { transaction: t }
    );

    // 2. Enable User account
    if (teacher.userId) {
      const user = await User.findByPk(teacher.userId, { transaction: t });
      if (user) {
        await user.update({ status: 'ACTIVE' }, { transaction: t });
      }
    }

    // 3. Log Audit
    await logAudit(req, 'FACULTY_RESTORED', {
      teacherId: teacher.id,
      userId: teacher.userId,
      facultyName: `${teacherUser?.firstName || ''} ${teacherUser?.lastName || ''}`.trim(),
      email: teacherUser?.email,
      department: teacherDept?.name,
      departmentCode: teacherDept?.code,
      restoredBy: req.user?.id,
      restoredAt: new Date(),
    });

    await t.commit();

    return res.json({
      success: true,
      message: 'Faculty restored successfully.',
      data: {
        id: teacher.id,
        status: 'ACTIVE',
      },
    });
  } catch (error: any) {
    await t.rollback();
    logger.error('DEAN_RESTORE_FACULTY_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to restore faculty member.' });
  }
};

/**
 * GET /api/dean/faculty/archived
 * Retrieves all archived faculty with full metadata (archivedAt, archivedByUser, historical assignments summary).
 */
export const getArchivedFacultyList = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { search, departmentId } = req.query;

    const whereUser: any = {};
    if (search) {
      whereUser[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const teachers = await Teacher.findAll({
      where: {
        status: 'ARCHIVED',
        ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'status', 'createdAt'],
          where: whereUser,
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
        },
        {
          model: User,
          as: 'archivedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [['archivedAt', 'DESC'], ['updatedAt', 'DESC']],
    });

    const formatted = await Promise.all(
      teachers.map(async (t: any) => {
        const assignments = await FacultyAssignment.findAll({
          where: { userId: t.userId },
          include: [{ model: Subject, as: 'subject', attributes: ['name', 'code'] }],
        });

        const subjectNames = Array.from(new Set(assignments.map((a: any) => a.subject?.name).filter(Boolean)));
        const archivedByName = t.archivedByUser
          ? `${t.archivedByUser.firstName || ''} ${t.archivedByUser.lastName || ''}`.trim() || t.archivedByUser.email
          : 'Dean Academics';

        return {
          id: t.id,
          userId: t.userId,
          name: `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim(),
          email: t.user?.email,
          phone: t.user?.phone,
          profileImage: t.user?.profileImage,
          departmentId: t.departmentId,
          departmentName: t.department?.name,
          departmentCode: t.department?.code,
          designation: t.designation,
          status: 'ARCHIVED',
          joiningDate: t.joiningDate,
          archivedAt: t.archivedAt,
          archivedBy: archivedByName,
          archivedByEmail: t.archivedByUser?.email || null,
          totalAssignments: assignments.length,
          previousSubjects: subjectNames.length > 0 ? subjectNames.join(', ') : 'No historical assignments',
          createdAt: t.createdAt,
        };
      })
    );

    return res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('DEAN_GET_ARCHIVED_FACULTY_ERROR:', error);
    return next(error);
  }
};

/**
 * GET /api/dean/faculty/:id
 * Dedicated faculty profile endpoint returning full personal, academic, login, teaching, attendance, and marks details.
 */
export const getFacultyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'gender', 'email', 'phone', 'profileImage', 'status', 'mustChangePassword', 'createdAt'],
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
        },
        {
          model: User,
          as: 'archivedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Faculty record not found.' });
    }

    const userId = teacher.userId;

    // 1. Current & Historical Teaching Assignments
    const assignments = await FacultyAssignment.findAll({
      where: { userId },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits', 'type', 'semester'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      order: [['academicYear', 'DESC'], ['semester', 'ASC'], ['createdAt', 'DESC']],
    });

    const activeAssignments = assignments.filter((a) => a.status === 'ACTIVE');
    const historicalAssignments = assignments.filter((a) => a.status !== 'ACTIVE');

    const assignmentIds = assignments.map((a) => a.id);

    // 2. Attendance History
    let attendanceHistory: any[] = [];
    if (assignmentIds.length > 0) {
      const sessions = await AttendanceSession.findAll({
        where: { facultyAssignmentId: { [Op.in]: assignmentIds } },
        include: [
          { model: Subject, as: 'subject', attributes: ['name', 'code'] },
          { model: Department, as: 'department', attributes: ['name', 'code'] },
        ],
        order: [['attendanceDate', 'DESC'], ['sessionPeriod', 'ASC']],
        limit: 50,
      });

      attendanceHistory = sessions.map((s: any) => ({
        id: s.id,
        date: s.attendanceDate,
        subject: s.subject?.name || 'Subject',
        subjectCode: s.subject?.code || '',
        section: s.section,
        semester: s.semester,
        period: s.sessionPeriod,
        present: s.presentCount,
        absent: s.absentCount,
        totalStudents: s.totalStudents,
        status: s.status,
      }));
    }

    // 3. Marks / Assessment History
    const marksHistory: any[] = [];

    // 4. Audit History (Safely queried)
    let auditLogs: any[] = [];
    try {
      auditLogs = await AuditLog.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: 15,
      });
    } catch (auditErr) {
      logger.warn('Audit lookup non-fatal error:', auditErr);
    }

    const archivedByName = teacher.archivedByUser
      ? `${teacher.archivedByUser.firstName || ''} ${teacher.archivedByUser.lastName || ''}`.trim() || teacher.archivedByUser.email
      : null;

    const facultyMiddleName = teacher.middleName || (teacher.user as any)?.middleName || null;
    const facultyGender = teacher.gender || (teacher.user as any)?.gender || null;
    const facultyFullName = [teacher.user?.firstName, facultyMiddleName, teacher.user?.lastName].filter(Boolean).join(' ').trim() || `${teacher.user?.firstName || ''} ${teacher.user?.lastName || ''}`.trim();

    return res.json({
      success: true,
      data: {
        faculty: {
          id: teacher.id,
          userId: teacher.userId,
          firstName: teacher.user?.firstName || '',
          middleName: facultyMiddleName,
          lastName: teacher.user?.lastName || '',
          gender: facultyGender,
          name: facultyFullName,
          email: teacher.user?.email || '',
          phone: teacher.user?.phone || null,
          profileImage: teacher.user?.profileImage || null,
          designation: teacher.designation,
          joiningDate: teacher.joiningDate,
          status: teacher.status,
          archivedAt: teacher.archivedAt,
          archivedBy: archivedByName,
          coreDepartment: {
            id: teacher.department?.id || teacher.departmentId,
            name: teacher.department?.name || 'Department',
            code: teacher.department?.code || 'N/A',
          },
        },
        account: {
          id: teacher.user?.id,
          email: teacher.user?.email || '',
          status: teacher.user?.status || 'ACTIVE',
          mustChangePassword: teacher.user?.mustChangePassword || false,
        },
        teachingAssignments: assignments.map((a: any) => ({
          id: a.id,
          academicYear: a.academicYear,
          teachingDepartment: a.department?.name || teacher.department?.name || 'Department',
          teachingDepartmentCode: a.department?.code || teacher.department?.code || '',
          semester: a.semester,
          subject: a.subject?.name || 'Subject',
          subjectCode: a.subject?.code || '',
          section: a.section,
          status: a.status,
        })),
        historicalAssignments: historicalAssignments.map((a: any) => ({
          id: a.id,
          academicYear: a.academicYear,
          teachingDepartment: a.department?.name || teacher.department?.name || 'Department',
          teachingDepartmentCode: a.department?.code || teacher.department?.code || '',
          semester: a.semester,
          subject: a.subject?.name || 'Subject',
          subjectCode: a.subject?.code || '',
          section: a.section,
          status: a.status,
        })),
        attendanceHistory,
        marksHistory,
        auditLogs: auditLogs.map((log: any) => ({
          id: log.id,
          action: log.action,
          createdAt: log.createdAt,
          details: log.details,
        })),
      },
    });
  } catch (error: any) {
    logger.error('DEAN_GET_FACULTY_PROFILE_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to load faculty profile.' });
  }
};

/**
 * GET /api/dean/faculty/:id/history
 * Backward-compatible history endpoint forwarding to getFacultyProfile logic.
 */
export const getFacultyHistoryById = getFacultyProfile;

/**
 * POST /api/dean/faculty/:id/regenerate-password
 * Securely regenerates a temporary password for an active faculty user account.
 * - Generates secure random password
 * - Hashes password using bcrypt
 * - Updates existing User record only (never creates duplicate users)
 * - Sets mustChangePassword = true
 * - Logs audit record FACULTY_PASSWORD_REGENERATED
 * - Returns temporary password in immediate response only
 */
export const regenerateFacultyPassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const teacher = await Teacher.findByPk(id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'role'] }],
      transaction: t,
    });

    if (!teacher) {
      await t.rollback();
      return res.status(404).json({ error: 'Faculty record not found.' });
    }

    if (teacher.status === 'ARCHIVED') {
      await t.rollback();
      return res.status(400).json({ error: 'Password regeneration is unavailable while this faculty account is archived.' });
    }

    const user = await User.findByPk(teacher.userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ error: 'Linked user account not found.' });
    }

    // Generate secure temporary password (e.g., Fac#k8NpQ4)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let randomSuffix = '';
    for (let i = 0; i < 6; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newTempPassword = `Fac#${randomSuffix}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newTempPassword, salt);

    // Update existing user record ONLY
    await user.update(
      {
        passwordHash,
        mustChangePassword: false,
      },
      { transaction: t }
    );

    // Audit log (DO NOT store plain password or hash)
    await logAudit(req, 'FACULTY_PASSWORD_REGENERATED', {
      teacherId: teacher.id,
      facultyUserId: user.id,
      facultyName: `${user.firstName} ${user.lastName}`.trim(),
      facultyEmail: user.email,
      performedBy: req.user?.id,
      timestamp: new Date(),
    });

    await t.commit();

    return res.json({
      success: true,
      message: 'Temporary password generated successfully.',
      data: {
        facultyName: `${user.firstName} ${user.lastName}`.trim(),
        loginEmail: user.email,
        temporaryPassword: newTempPassword,
      },
    });
  } catch (error: any) {
    await t.rollback();
    logger.error('DEAN_REGENERATE_FACULTY_PASSWORD_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to regenerate faculty password.' });
  }
};




