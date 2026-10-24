import { Request, Response } from 'express';
import redisService from '../services/redis.service';

/**
 * Controller for persisting and synchronizing user drafts and dashboard session state in Redis.
 * Scoped by authenticated user ID to prevent cross-account/cross-department leakage.
 */

export const getSessionDraft = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { key } = req.params;

    if (!userId || !key) {
      return res.status(400).json({ success: false, error: 'User ID and draft key are required.' });
    }

    const redisKey = `draft:${userId}:${key}`;
    const data = await redisService.getCache(redisKey);

    return res.status(200).json({
      success: true,
      key,
      data: data !== null && data !== undefined ? data : null,
    });
  } catch (error: any) {
    console.warn(`[DraftController] Error retrieving draft for key ${req.params?.key}:`, error);
    return res.status(200).json({ success: true, key: req.params?.key, data: null });
  }
};

export const saveSessionDraft = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { key } = req.params;
    const { data, ttlSeconds } = req.body;

    if (!userId || !key) {
      return res.status(400).json({ success: false, error: 'User ID and draft key are required.' });
    }

    // Default TTL: 7 days (604800 seconds)
    const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : 7 * 24 * 60 * 60;
    const redisKey = `draft:${userId}:${key}`;

    await redisService.setCache(redisKey, data, ttl);

    return res.status(200).json({
      success: true,
      key,
      message: 'Draft saved to Redis session successfully.',
    });
  } catch (error: any) {
    console.warn(`[DraftController] Error saving draft for key ${req.params?.key}:`, error);
    return res.status(500).json({ success: false, error: 'Failed to persist draft in Redis.' });
  }
};

export const deleteSessionDraft = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { key } = req.params;

    if (!userId || !key) {
      return res.status(400).json({ success: false, error: 'User ID and draft key are required.' });
    }

    const redisKey = `draft:${userId}:${key}`;
    await redisService.deleteCache(redisKey);

    return res.status(200).json({
      success: true,
      key,
      message: 'Draft cleared from Redis session successfully.',
    });
  } catch (error: any) {
    console.warn(`[DraftController] Error deleting draft for key ${req.params?.key}:`, error);
    return res.status(500).json({ success: false, error: 'Failed to delete draft from Redis.' });
  }
};
