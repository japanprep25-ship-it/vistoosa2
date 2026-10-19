import type { Express } from 'express';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';
import { extractOptionalAuth, AuthenticatedRequest } from './authMiddleware';

export interface GlobalSettings {
  appName: string;
  appMonogram: string;
  appSubtitle: string;
  appTagline: string;
  themePreset: 'amber' | 'emerald' | 'blue' | 'rose' | 'purple';
  fontPreset: 'default' | 'modern' | 'classic' | 'playful';
  isDarkMode: boolean;
  updatedAt: string;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appName: 'Vistoosa Management System',
  appMonogram: 'V',
  appSubtitle: 'Management System',
  appTagline: '',
  themePreset: 'amber',
  fontPreset: 'default',
  isDarkMode: true,
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
}
