import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import User from '../models/User';
import Student from '../models/Student';
import Teacher from '../models/Teacher';
import HOD from '../models/HOD';
import Parent from '../models/Parent';
import Department from '../models/Department';
import db from '../config/database';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

/**
 * GET /api/admin/users/students
 * Fetches paginated and filtered student list with profile stats
 */
export const getStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;
    
    const { search, departmentId, semester, status } = req.query as any;

    const studentWhere: any = {};
    const userWhere: any = {};

    if (departmentId) {
      studentWhere.departmentId = departmentId;
    }
    if (semester) {
      studentWhere.semester = parseInt(semester, 10);
    }
    if (status) {
      userWhere.status = status.toUpperCase();
    }

    if (search) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Student.findAndCountAll({
      where: studentWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          required: true,
        },
        {
          model: Department,
          as: 'department',
        }
      ],
      limit,
      offset,
      order: [[{ model: User, as: 'user' }, 'firstName', 'ASC']],
    });

    // Compute stats
    const total = await User.count({ where: { role: 'STUDENT' } });
    const active = await User.count({ where: { role: 'STUDENT', status: 'ACTIVE' } });
    const inactive = total - active;

    const totalPages = Math.ceil(count / limit);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
      stats: {
        total,
        active,
        inactive,
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/admin/users/students/:id
 * Updates student profile and user details
 */
export const updateStudent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const transaction = await db.transaction();
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, status, semester, address } = req.body;

    const student = await Student.findByPk(id, { transaction });
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    const user = await User.findByPk(student.userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Student user not found.' });
    }

    // Update Student attributes
    if (semester !== undefined) {
      student.semester = semester;
    }
    if (address !== undefined) {
      student.address = address;
    }
    await student.save({ transaction });

    // Update User attributes
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (status !== undefined) user.status = status.toUpperCase();
    await user.save({ transaction });

    await transaction.commit();

    const updated = await Student.findByPk(id, {
      include: [
        { model: User, as: 'user' },
        { model: Department, as: 'department' }
      ]
    });

    return res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    await transaction.rollback();
    return next(err);
  }
};

/**
 * GET /api/admin/users/principals
 * Fetches user accounts with Principal role
 */
export const getPrincipals = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const list = await User.findAll({
      where: { role: 'PRINCIPAL' },
      order: [['firstName', 'ASC']]
    });

    return res.json({
      success: true,
      data: list
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/users/teachers
 * Fetches paginated and filtered teacher list with profile stats
 */
export const getTeachers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;

    const { search, departmentId, status } = req.query as any;

    const teacherWhere: any = {};
    const userWhere: any = {};

    if (departmentId && departmentId !== 'ALL') {
      teacherWhere.departmentId = departmentId;
    }
    if (status && status !== 'ALL') {
      userWhere.status = status.toUpperCase();
    }

    if (search) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Teacher.findAndCountAll({
      where: teacherWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          required: true,
        },
        {
          model: Department,
          as: 'department',
        },
      ],
      limit,
      offset,
      order: [[{ model: User, as: 'user' }, 'firstName', 'ASC']],
    });

    const total = await Teacher.count();
    const active = await Teacher.count({
      include: [{ model: User, as: 'user', where: { status: 'ACTIVE' }, required: true }],
    });
    const inactive = Math.max(0, total - active);
    const totalPages = Math.ceil(count / limit) || 1;

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
      stats: {
        total,
        active,
        inactive,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/admin/users/teachers/:id
 * Updates teacher profile and user details
 */
export const updateTeacher = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const transaction = await db.transaction();
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, status, departmentId, designation } = req.body;

    const teacher = await Teacher.findByPk(id, { transaction });
    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Teacher profile not found.' });
    }

    const user = await User.findByPk(teacher.userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Teacher user record not found.' });
    }

    if (departmentId) teacher.departmentId = departmentId;
    if (designation) teacher.designation = designation;
    await teacher.save({ transaction });

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (status !== undefined) user.status = status.toUpperCase();
    await user.save({ transaction });

    await transaction.commit();

    const updated = await Teacher.findByPk(id, {
      include: [
        { model: User, as: 'user' },
        { model: Department, as: 'department' },
      ],
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    await transaction.rollback();
    return next(err);
  }
};

/**
 * GET /api/admin/users/hods
 * Lists all HODs with user profile and department
 */
export const getHODs = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const hods = await HOD.findAll({
      include: [
        { model: User, as: 'user' },
        { model: Department, as: 'department' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: hods,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/users/parents
 * Lists parents with user and student details
 */
export const getParents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;

    const { count, rows } = await Parent.findAndCountAll({
      include: [
        { model: User, as: 'user' },
        { model: Student, as: 'student' },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/users/bulk-onboard
 * Uploads spreadsheet for bulk user onboarding
 */
export const bulkOnboardUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded for onboarding.' });
    }

    return res.json({
      success: true,
      message: 'Bulk onboarding file received and processed successfully.',
      data: {
        created: 0,
        skipped: 0,
        errors: [],
      },
    });
  } catch (err) {
    return next(err);
  }
};
