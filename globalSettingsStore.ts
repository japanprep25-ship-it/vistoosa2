import type { Express } from 'express';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';
import { extractOptionalAuth, requireAuth, AuthenticatedRequest } from './authMiddleware';
import { createAndSendOtp, verifyOtpCode } from './otpService';
import { findUserByEmail, adminCreateUser, updateUser } from './userStore';

export interface GlobalSettings {
  appName: string;
  appMonogram: string;
  appSubtitle: string;
  appTagline: string;
  themePreset: 'amber' | 'emerald' | 'blue' | 'rose' | 'purple';
  fontPreset: 'default' | 'modern' | 'classic' | 'playful';
  isDarkMode: boolean;
  motherGmail: string;
  updatedAt: string;
}

export const DEFAULT_MOTHER_GMAIL = 'vistoosa@gmail.com';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appName: 'Vistoosa Management System',
  appMonogram: 'V',
  appSubtitle: 'Management System',
  appTagline: '',
  themePreset: 'amber',
  fontPreset: 'default',
  isDarkMode: true,
  motherGmail: DEFAULT_MOTHER_GMAIL,
  updatedAt: new Date().toISOString(),
};

let cachedSettings: GlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS };

export async function getGlobalSettingsFromDb(): Promise<GlobalSettings> {
  if (isFirestoreQuotaExceeded()) {
    return cachedSettings;
  }

  try {
    const docRef = db.collection('appSettings').doc('global');
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      const data = snapshot.data();
      cachedSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        ...data,
        motherGmail: data?.motherGmail ? String(data.motherGmail).trim().toLowerCase() : DEFAULT_MOTHER_GMAIL,
        updatedAt: data?.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }
  return cachedSettings;
}

export async function saveGlobalSettingsToDb(newSettings: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const updated: GlobalSettings = {
    ...cachedSettings,
    ...newSettings,
    motherGmail: newSettings.motherGmail
      ? String(newSettings.motherGmail).trim().toLowerCase()
      : cachedSettings.motherGmail || DEFAULT_MOTHER_GMAIL,
    updatedAt: new Date().toISOString(),
  };

  cachedSettings = updated;

  if (isFirestoreQuotaExceeded()) {
    return updated;
  }

  try {
    const docRef = db.collection('appSettings').doc('global');
    await docRef.set(updated, { merge: true });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }

  return updated;
}

export async function getMotherGmail(): Promise<string> {
  const s = await getGlobalSettingsFromDb();
  return (s.motherGmail || DEFAULT_MOTHER_GMAIL).trim().toLowerCase();
}

export async function setMotherGmail(newEmail: string): Promise<string> {
  const cleanEmail = newEmail.trim().toLowerCase();
  await saveGlobalSettingsToDb({ motherGmail: cleanEmail });
  return cleanEmail;
}

export function mountGlobalSettingsRoutes(app: Express) {
  // GET /api/settings/global (PUBLIC / optional auth)
  app.get('/api/settings/global', extractOptionalAuth, async (_req, res) => {
    const settings = await getGlobalSettingsFromDb();
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.json({ success: true, settings });
  });

  // POST /api/settings/global (ADMIN / OWNER / USER)
  app.post('/api/settings/global', extractOptionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payload = req.body || {};
      // Never allow overwriting motherGmail casually via general settings update
      delete payload.motherGmail;
      const updated = await saveGlobalSettingsToDb(payload);
      return res.json({
        success: true,
        message: 'Global settings updated and synced across all devices successfully.',
        settings: updated,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update global settings: ' + (err?.message || 'Server error'),
      });
    }
  });

  // GET /api/settings/mother-gmail
  app.get('/api/settings/mother-gmail', extractOptionalAuth, async (_req, res) => {
    const motherGmail = await getMotherGmail();
    return res.json({ success: true, motherGmail });
  });

  // POST /api/settings/mother-gmail/request-otp
  // Sends OTP to current Mother Gmail to authorize transferring / changing Mother Gmail
  app.post('/api/settings/mother-gmail/request-otp', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const currentMother = await getMotherGmail();
      const otpRes = await createAndSendOtp(currentMother, 'mother_change');
      return res.json({
        success: true,
        currentMotherGmail: currentMother,
        message: `Verification OTP sent to current Mother Gmail (${currentMother}).`,
        expiresAt: otpRes.expiresAt,
        debugOtp: otpRes.debugOtp,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to send OTP to current Mother Gmail.',
      });
    }
  });

  // POST /api/settings/mother-gmail/verify-change
  // Verifies the OTP sent to current Mother Gmail, then switches to new Mother Gmail
  app.post('/api/settings/mother-gmail/verify-change', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { newMotherGmail, otpCode } = req.body || {};
      const cleanNew = String(newMotherGmail || '').trim().toLowerCase();
      const cleanOtp = String(otpCode || '').trim();

      if (!cleanNew || !cleanNew.includes('@')) {
        return res.status(400).json({ success: false, message: 'Please enter a valid new Mother Gmail address.' });
      }

      if (cleanOtp.length !== 6) {
        return res.status(400).json({ success: false, message: 'Please enter the 6-digit OTP sent to current Mother Gmail.' });
      }

      const currentMother = await getMotherGmail();
      const verifyRes = await verifyOtpCode(currentMother, cleanOtp);
      if (!verifyRes.success) {
        return res.status(400).json({
          success: false,
          message: verifyRes.message || 'Invalid or expired OTP code for current Mother Gmail.',
        });
      }

      // Update Mother Gmail
      await setMotherGmail(cleanNew);

      // Ensure user record for new Mother Gmail has Owner role
      try {
        const existingUser = await findUserByEmail(cleanNew);
        if (existingUser) {
          await updateUser(existingUser.id, { role: 'Owner' });
        } else {
          await adminCreateUser(cleanNew, 'vistoosa2026', cleanNew.split('@')[0], 'Owner');
        }
      } catch (uErr) {
        console.warn('Could not auto-promote user to Owner during Mother Gmail switch:', uErr);
      }

      return res.json({
        success: true,
        message: `Mother Gmail successfully updated to ${cleanNew}.`,
        motherGmail: cleanNew,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to update Mother Gmail.',
      });
    }
  });
}

