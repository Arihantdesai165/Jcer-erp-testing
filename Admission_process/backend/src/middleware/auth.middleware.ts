import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import User from '../models/User';
import redisService from '../services/redis.service';
import logger from '../utils/logger.util';
import { UnauthorizedError } from '../utils/error.util';
import { contextStorage } from '../utils/context.util';
import { STUDENT_INACTIVITY_TIMEOUT_MINUTES } from '../constants/activity.constants';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    tokenVersion: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImage?: string;
    status?: string;
  };
  departmentId?: string;
  department?: any;
  hod?: any;
  isSemesterHandling?: boolean;
  correlationId?: string;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }
    
    // 1. Verify token signature and expiry
    let decoded: any;
    try {
      decoded = verifyToken(token);
    } catch (err: any) {
      throw new UnauthorizedError('Invalid or expired token.');
    }

    // 2. Database verification (zero-trust: always re-verify user status and tokenVersion)
    const user = await User.findByPk(decoded.id);
    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(`User account is ${user.status.toLowerCase()}.`);
    }

    if (typeof decoded.tv === 'number' && decoded.tv !== user.tokenVersion) {
      throw new UnauthorizedError('Session invalidated due to password or permission change. Please log in again.');
    }

    // 3. Student-Only Inactivity Check (1 hour auto-logout)
    // ADMIN, PRINCIPAL, and staff roles are exempt
    if (user.role === 'STUDENT' && user.lastActivityAt) {
      const inactivityMs = Date.now() - new Date(user.lastActivityAt).getTime();
      const maxInactivityMs = STUDENT_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
      if (inactivityMs >= maxInactivityMs) {
        logger.warn(`SESSION_INACTIVE: Student ${user.email} session expired due to inactivity (${Math.round(inactivityMs / 60000)}m).`);
        return res.status(401).json({
          code: 'SESSION_INACTIVE',
          error: 'Your session expired due to inactivity. Please log in again.',
          message: 'Your session expired due to inactivity. Please log in again.',
        });
      }
    }

    // 4. Throttle updating lastActivityAt (at most once every 60 seconds)
    const now = new Date();
    if (!user.lastActivityAt || (now.getTime() - new Date(user.lastActivityAt).getTime() > 60 * 1000)) {
      User.update({ lastActivityAt: now }, { where: { id: user.id }, silent: true }).catch(err => {
        logger.error(`Failed to update lastActivityAt for user ${user.id}: ${err.message}`);
      });
    }

    // Attach verified user payload to the request object
    req.user = {
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profileImage: user.profileImage,
      status: user.status,
    };

    // Run the rest of the request lifecycle in the AsyncLocalStorage context
    return contextStorage.run({ userId: user.id, role: user.role }, () => {
      next();
    });
  } catch (error: any) {
    const status = error.status || 401;
    logger.warn(`Auth failure: ${error.message}`, { path: req.path, ip: req.ip });
    return res.status(status).json({ error: error.message || 'Authentication failed.' });
  }
};

