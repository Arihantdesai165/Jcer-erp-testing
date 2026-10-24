import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import Otp, { OtpPurpose } from '../models/Otp';
import logger from '../utils/logger.util';

export interface GenerateOtpResult {
  success: boolean;
  otp?: string;
  error?: string;
  cooldownSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
}

class OtpService {
  /**
   * Generate 6-digit numeric OTP and save hashed copy in database.
   */
  public async generateAndSaveOtp(email: string, purpose: OtpPurpose, userId?: string): Promise<GenerateOtpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Rate Limit: Check requests in past 1 hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyRequestCount = await Otp.count({
      where: {
        email: normalizedEmail,
        purpose,
        createdAt: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (hourlyRequestCount >= 5) {
      logger.warn(`OTP rate limit exceeded for ${normalizedEmail} (${purpose})`);
      return {
        success: false,
        error: 'Too many OTP requests. Maximum 5 requests allowed per hour. Please try again later.',
      };
    }

    // 2. Cooldown Guard: Check if an OTP was created less than cooldown seconds ago (default 60s)
    const cooldownSeconds = parseInt(process.env.DAILY_LOGIN_OTP_RESEND_SECONDS || '60', 10);
    const latestOtp = await Otp.findOne({
      where: {
        email: normalizedEmail,
        purpose,
      },
      order: [['createdAt', 'DESC']],
    });

    if (latestOtp) {
      const elapsedSeconds = Math.floor((now.getTime() - new Date(latestOtp.createdAt).getTime()) / 1000);
      if (elapsedSeconds < cooldownSeconds) {
        const remainingCooldown = cooldownSeconds - elapsedSeconds;
        return {
          success: false,
          error: `Please wait ${remainingCooldown} seconds before requesting a new OTP.`,
          cooldownSeconds: remainingCooldown,
        };
      }
    }

    // 3. Invalidate any existing active unverified OTPs for this email and purpose by expiring them
    await Otp.update(
      { expiresAt: new Date(0) },
      {
        where: {
          email: normalizedEmail,
          purpose,
          verified: false,
        },
      }
    );

    // 4. Generate random 6-digit numeric OTP using cryptographically secure PRNG
    const plainOtp = crypto.randomInt(100000, 999999).toString();

    // 5. Hash OTP with bcrypt
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(plainOtp, salt);

    // 6. Expiry = 5 minutes
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    // 7. Save into Otp table
    await Otp.create({
      email: normalizedEmail,
      userId: userId || null,
      otpHash,
      purpose,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    logger.info(`[DEV_OTP] Generated OTP for ${normalizedEmail} (purpose: ${purpose}, code: ${plainOtp}, expires: ${expiresAt.toISOString()})`);

    return {
      success: true,
      otp: plainOtp,
    };
  }

  /**
   * Verify an OTP entered by user.
   */
  public async verifyOtp(email: string, plainOtp: string, purpose: OtpPurpose): Promise<VerifyOtpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = plainOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || isNaN(Number(cleanOtp))) {
      return {
        success: false,
        error: 'Invalid OTP format. Please enter a 6-digit numerical code.',
      };
    }

    const now = new Date();

    // Find all active unexpired and unverified OTPs for email & purpose
    const activeOtps = await Otp.findAll({
      where: {
        email: normalizedEmail,
        purpose,
        verified: false,
        expiresAt: {
          [Op.gt]: now,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!activeOtps || activeOtps.length === 0) {
      return {
        success: false,
        error: 'No active OTP found. Please request a new OTP.',
      };
    }

    // Try matching entered cleanOtp against active OTP records
    let matchedRecord: Otp | null = null;
    for (const otpRecord of activeOtps) {
      if (otpRecord.attempts >= 5) continue;
      const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);
      if (isMatch) {
        matchedRecord = otpRecord;
        break;
      }
    }

    if (!matchedRecord) {
      const latestRecord = activeOtps[0];
      const newAttempts = latestRecord.attempts + 1;
      const attemptsLeft = Math.max(0, 5 - newAttempts);

      await latestRecord.update({ attempts: newAttempts });

      if (attemptsLeft <= 0) {
        await latestRecord.update({ expiresAt: new Date(0) });
        return {
          success: false,
          error: 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.',
          attemptsRemaining: 0,
        };
      }

      return {
        success: false,
        error: `Incorrect OTP. You have ${attemptsLeft} attempt(s) remaining.`,
        attemptsRemaining: attemptsLeft,
      };
    }

    // OTP is valid! Mark only the matched record as verified
    const updateValues: any = {
      verified: true,
      updatedAt: now,
    };
    if (purpose === 'DAILY_LOGIN') {
      // 24-hour verification validity period
      updateValues.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    await matchedRecord.update(updateValues);

    // Invalidate/expire any other unverified OTPs for this email and purpose
    await Otp.update(
      { expiresAt: new Date(0) },
      {
        where: {
          email: normalizedEmail,
          purpose,
          verified: false,
        },
      }
    );

    logger.info(`OTP successfully verified for ${normalizedEmail} (${purpose})`);
    return {
      success: true,
    };
  }

  /**
   * Generate OTP specifically for Email Change request associated with authenticated userId.
   */
  public async generateAndSaveEmailChangeOtp(
    userId: string,
    newEmail: string
  ): Promise<GenerateOtpResult> {
    const normalizedNewEmail = newEmail.trim().toLowerCase();
    const now = new Date();

    const expiryMinutes = parseInt(process.env.EMAIL_CHANGE_OTP_EXPIRY_MINUTES || '10', 10);
    const cooldownSeconds = parseInt(process.env.EMAIL_CHANGE_OTP_RESEND_SECONDS || '45', 10);

    // 1. Rate Limit: Max 5 requests per hour for this user
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyCount = await Otp.count({
      where: {
        userId,
        purpose: 'EMAIL_CHANGE',
        createdAt: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (hourlyCount >= 5) {
      logger.warn(`Email change OTP rate limit exceeded for user ${userId}`);
      return {
        success: false,
        error: 'Too many OTP requests. Maximum 5 email-change requests allowed per hour. Please try again later.',
      };
    }

    // 2. Cooldown Guard
    const latestOtp = await Otp.findOne({
      where: {
        userId,
        purpose: 'EMAIL_CHANGE',
      },
      order: [['createdAt', 'DESC']],
    });

    if (latestOtp) {
      const elapsedSeconds = Math.floor((now.getTime() - new Date(latestOtp.createdAt).getTime()) / 1000);
      if (elapsedSeconds < cooldownSeconds) {
        const remainingCooldown = cooldownSeconds - elapsedSeconds;
        return {
          success: false,
          error: `Please wait ${remainingCooldown} seconds before requesting a new OTP.`,
          cooldownSeconds: remainingCooldown,
        };
      }
    }

    // 3. Invalidate previous unverified email-change OTPs for this user
    await Otp.update(
      { verified: true },
      {
        where: {
          userId,
          purpose: 'EMAIL_CHANGE',
          verified: false,
        },
      }
    );

    // 4. Generate random 6-digit numeric OTP using PRNG
    const plainOtp = crypto.randomInt(100000, 999999).toString();

    // 5. Hash OTP with bcrypt
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(plainOtp, salt);

    // 6. Expiry (e.g. 10 minutes)
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    // 7. Save into Otp table with userId & newEmail
    await Otp.create({
      userId,
      newEmail: normalizedNewEmail,
      email: normalizedNewEmail,
      otpHash,
      purpose: 'EMAIL_CHANGE',
      expiresAt,
      verified: false,
      attempts: 0,
    });

    logger.info(`Email-change OTP generated for user ${userId} -> ${normalizedNewEmail} (expires: ${expiresAt.toISOString()})`);

    return {
      success: true,
      otp: plainOtp,
    };
  }

  /**
   * Verify an Email Change OTP entered by user.
   */
  public async verifyEmailChangeOtp(
    userId: string,
    plainOtp: string
  ): Promise<{ success: boolean; newEmail?: string; error?: string; attemptsRemaining?: number }> {
    const cleanOtp = plainOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || isNaN(Number(cleanOtp))) {
      return {
        success: false,
        error: 'Invalid OTP format. Please enter a 6-digit numerical code.',
      };
    }

    // Find the latest active email-change OTP for user
    const otpRecord = await Otp.findOne({
      where: {
        userId,
        purpose: 'EMAIL_CHANGE',
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord || !otpRecord.newEmail) {
      return {
        success: false,
        error: 'No active email-change request found. Please request a new OTP.',
      };
    }

    if (otpRecord.verified) {
      if (otpRecord.attempts >= 5) {
        return {
          success: false,
          error: 'Too many verification attempts. Please request a new OTP.',
        };
      }
      return {
        success: false,
        error: 'No active email-change request found. Please request a new OTP.',
      };
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      const newAttempts = otpRecord.attempts + 1;
      const attemptsLeft = 5 - newAttempts;

      await otpRecord.update({ attempts: newAttempts });

      if (attemptsLeft <= 0) {
        await otpRecord.update({ verified: true });
        return {
          success: false,
          error: 'Invalid verification code. Maximum attempts exceeded. Please request a new OTP.',
          attemptsRemaining: 0,
        };
      }

      return {
        success: false,
        error: `Invalid verification code. You have ${attemptsLeft} attempt(s) remaining.`,
        attemptsRemaining: attemptsLeft,
      };
    }

    // Mark verified
    await otpRecord.update({ verified: true });

    logger.info(`Email-change OTP verified for user ${userId}`);
    return {
      success: true,
      newEmail: otpRecord.newEmail,
    };
  }
}

export const otpService = new OtpService();
export default otpService;
