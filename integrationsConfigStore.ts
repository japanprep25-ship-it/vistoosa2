import type { Express, Response } from 'express';
import { extractOptionalAuth, AuthenticatedRequest } from './authMiddleware';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  incrementFirestoreReads,
} from './firebaseAdmin';

const INTEGRATIONS_COLLECTION = 'integrationsConfig';
const inMemoryIntegrations = new Map<string, FullIntegrationsConfig>();

// Pending queue for background retries of failed writes (Section B)
const pendingIntegrationSaves: Array<{ userId: string; config: any; timestamp: number }> = [];

setInterval(async () => {
  if (pendingIntegrationSaves.length === 0 || isFirestoreQuotaExceeded()) return;
  const item = pendingIntegrationSaves.shift();
  if (!item) return;
  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(item.userId);
    await docRef.set({ ...item.config, updatedAt: new Date().toISOString() }, { merge: true });
    console.info(`[IntegrationsConfig Background Sync]: Successfully flushed pending save for user ${item.userId}`);
  } catch (err) {
    pendingIntegrationSaves.push(item); // re-queue
  }
}, 2 * 60 * 1000);

export interface FullIntegrationsConfig {
  website?: {
    platform: string;
    storeUrl: string;
    apiKey: string;
    apiSecret: string;
    webhookUrl: string;
    webhookSecret: string;
    syncOrders: boolean;
    syncInventory: boolean;
    status: 'connected' | 'disconnected';
    lastSync: string;
  };
  meta?: {
    metaAppId?: string;
    metaAppSecret?: string;
    metaVerifyToken?: string;
    pageAccessToken: string;
    pageId?: string;
    instagramBusinessAccountId?: string;
    whatsappPhoneNumberId?: string;
    whatsappBusinessAccountId?: string;
    whatsappAccessToken?: string;
    webhookCallbackUrl?: string;
    businessSuitePageId: string;
    adAccountId: string;
    conversionsApiPixelId: string;
    conversionsApiToken: string;
    syncMessengerLeads: boolean;
    trackAdSpend: boolean;
    autoReplyEnabled: boolean;
    status: 'connected' | 'disconnected';
    lastSync: string;
  };
  gas?: {
    appScriptDeploymentId?: string;
    webAppUrl?: string;
    sheetUrl?: string;
    status?: 'connected' | 'disconnected';
    lastSync?: string;
  };
}

export async function loadIntegrationsConfig(userId: string = 'usr_vistoosa_mother'): Promise<FullIntegrationsConfig> {
  const uid = userId || 'usr_vistoosa_mother';

  const local = inMemoryIntegrations.get(uid);
  if (local) return local;

  if (isFirestoreQuotaExceeded()) {
    return local || {};
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(uid);
    const doc = await docRef.get();
    incrementFirestoreReads('settings');

    if (!doc.exists) return local || {};
    const data = doc.data() as FullIntegrationsConfig;
    inMemoryIntegrations.set(uid, data);
    return data;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return inMemoryIntegrations.get(uid) || {};
  }
}

export async function saveIntegrationsConfig(
  userId: string = 'usr_vistoosa_mother',
  newConfig: Partial<FullIntegrationsConfig>
): Promise<{ config: FullIntegrationsConfig; persisted: boolean; error?: string }> {
  const uid = userId || 'usr_vistoosa_mother';

  const current = (await loadIntegrationsConfig(uid)) || inMemoryIntegrations.get(uid) || {};
  const merged: FullIntegrationsConfig = {
    ...current,
    ...newConfig,
    website: newConfig.website ? { ...current.website, ...newConfig.website } : current.website,
    meta: newConfig.meta ? { ...current.meta, ...newConfig.meta } : current.meta,
    gas: newConfig.gas ? { ...current.gas, ...newConfig.gas } : current.gas,
  };

  inMemoryIntegrations.set(uid, merged);

  if (isFirestoreQuotaExceeded()) {
    pendingIntegrationSaves.push({ userId: uid, config: merged, timestamp: Date.now() });
    return { config: merged, persisted: false, error: 'Firestore quota exceeded' };
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(uid);
    await docRef.set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });
    return { config: merged, persisted: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    pendingIntegrationSaves.push({ userId: uid, config: merged, timestamp: Date.now() });
    return { config: merged, persisted: false, error: err?.message || 'Database write error' };
  }
}

export function mountIntegrationsConfigRoutes(app: Express) {
  app.get('/api/settings/integrations', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const config = await loadIntegrationsConfig(userId);
      return res.json({
        success: true,
        config,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load integration settings.' });
    }
  });

  app.post('/api/settings/integrations', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const payload = req.body || {};
      const result = await saveIntegrationsConfig(userId, payload);
      return res.json({
        success: true,
        persisted: result.persisted,
        message: result.persisted
          ? 'Integration settings saved permanently.'
          : `Saved only temporarily in server memory. Database error: ${result.error || 'Unknown'}`,
        config: result.config,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save integration settings.' });
    }
  });
}
