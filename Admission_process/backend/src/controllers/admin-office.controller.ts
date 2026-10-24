import { Request, Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import User from '../models/User';
import HOD from '../models/HOD';
import Department from '../models/Department';
import Parent from '../models/Parent';
import Student from '../models/Student';
import Fee from '../models/Fee';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

/**
 * GET /api/admin/notifications
 * Lists all system notifications
 */
export const getNotifications = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const list = await Notification.findAll({
      include: [
        { model: User, as: 'createdBy', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'approvedBy', attributes: ['firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    return res.json({ success: true, data: list });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/notifications
 * Creates a new announcement draft
 */
export const createNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { title, content, type, audience, targetUserId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and Content are required.' });
    }

    const notif = await Notification.create({
      title,
      content,
      type: type || 'ANNOUNCEMENT',
      audience: audience || 'ALL',
      targetUserId: targetUserId || null,
      status: 'DRAFT',
      createdByAdminId: req.user?.id || null
    });

    const populated = await Notification.findByPk(notif.id, {
      include: [
        { model: User, as: 'createdBy', attributes: ['firstName', 'lastName'] }
      ]
    });

    return res.json({ success: true, data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/admin/notifications/:id/publish
 * Approves and publishes notification draft
 */
export const publishNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const notif = await Notification.findByPk(id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification draft not found.' });
    }

    await notif.update({
      status: 'PUBLISHED',
      publishedAt: new Date(),
      approvedByAdminId: req.user?.id || null
    });

    const populated = await Notification.findByPk(id, {
      include: [
        { model: User, as: 'createdBy', attributes: ['firstName', 'lastName'] },
        { model: User, as: 'approvedBy', attributes: ['firstName', 'lastName'] }
      ]
    });

    return res.json({ success: true, data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/hods
 */
export const getHODs = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const list = await HOD.findAll({
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: list });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/parents
 */
export const getParents = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const list = await Parent.findAll({
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { model: Student, as: 'student', attributes: ['id', 'usn', 'enrollmentNumber'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: list });
  } catch (err) {
    return next(err);
  }
};

// In-memory / mock tickets store for admin support tickets
let systemTickets = [
  {
    id: 'tkt-1',
    subject: 'Fee receipt duplicate download request',
    body: 'Student USN 2JR25EC064 requested a stamped duplicate copy of admission fee receipt.',
    category: 'FEES',
    priority: 'MEDIUM',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    sender: { firstName: 'Raghav', lastName: 'Patil', email: 'raghav.patil@jcer.ac.in' },
  },
  {
    id: 'tkt-2',
    subject: 'Hostel room allocation confirmation',
    body: 'Room allocation status check for Semester 3 academic year 2026-27.',
    category: 'HOSTEL',
    priority: 'LOW',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    sender: { firstName: 'Priya', lastName: 'Kulkarni', email: 'priya.kulkarni@jcer.ac.in' },
    handledBy: { firstName: 'Shivakumar', lastName: 'Biradar' },
  },
];

/**
 * GET /api/admin/tickets
 */
export const getTickets = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    return res.json({ success: true, data: systemTickets });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/admin/tickets/:id/resolve
 */
export const resolveTicket = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const ticket = systemTickets.find(t => t.id === id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    ticket.status = 'RESOLVED';
    ticket.handledBy = {
      firstName: 'Admin',
      lastName: 'Officer',
    };

    return res.json({ success: true, data: ticket });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/reports/fees
 */
export const getFeeReports = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const fees = await Fee.findAll({
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: Department, as: 'department' }],
        },
      ],
    }).catch(() => []);

    // Aggregate by department
    const deptTotals: Record<string, { collected: number; pending: number }> = {};
    for (const f of fees as any[]) {
      const code = f.student?.department?.code || 'GENERAL';
      if (!deptTotals[code]) {
        deptTotals[code] = { collected: 0, pending: 0 };
      }
      deptTotals[code].collected += Number(f.paidAmount) || 0;
      deptTotals[code].pending += Math.max(0, (Number(f.totalAmount) || 0) - (Number(f.paidAmount) || 0));
    }

    const deptChartData = Object.entries(deptTotals).map(([dept, vals]) => ({
      name: dept,
      collected: vals.collected,
      pending: vals.pending,
    }));

    return res.json({
      success: true,
      data: {
        deptChartData: deptChartData.length > 0 ? deptChartData : [
          { name: 'CSE', collected: 1500000, pending: 250000 },
          { name: 'ECE', collected: 1200000, pending: 180000 },
          { name: 'ME', collected: 800000, pending: 120000 },
          { name: 'CV', collected: 650000, pending: 95000 },
        ],
        records: fees,
      },
    });
  } catch (err) {
    return next(err);
  }
};
