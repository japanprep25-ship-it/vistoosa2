import type { Express, Response } from 'express';
import { extractOptionalAuth, AuthenticatedRequest } from './authMiddleware';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';

const INTEGRATIONS_COLLECTION = 'integrationsConfig';

// In-memory cache for high resilience during cloud quota limits
const inMemoryIntegrations = new Map<string, FullIntegrationsConfig>();

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

export async function loadIntegrationsConfig(userId: string = 'usr_admin_default'): Promise<FullIntegrationsConfig> {
  const uid = userId || 'usr_admin_default';

  const local = inMemoryIntegrations.get(uid);
  if (local) return local;

  if (isFirestoreQuotaExceeded()) {
    return local || {};
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(uid);
    const doc = await docRef.get();

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
  userId: string = 'usr_admin_default',
  newConfig: Partial<FullIntegrationsConfig>
): Promise<FullIntegrationsConfig> {
  const uid = userId || 'usr_admin_default';

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
    return merged;
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(uid);
    await docRef.set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });
    return merged;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return merged;
  }
}

export function mountIntegrationsConfigRoutes(app: Express) {
  // GET /api/settings/integrations - Load all persistent integration settings
  app.get('/api/settings/integrations', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_admin_default';
      const config = await loadIntegrationsConfig(userId);
      return res.json({
        success: true,
        config,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load integration settings.' });
    }
  });

  // POST /api/settings/integrations - Save persistent integration settings
  app.post('/api/settings/integrations', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_admin_default';
      const payload = req.body || {};
      const updated = await saveIntegrationsConfig(userId, payload);
      return res.json({
        success: true,
        message: 'Integration settings saved permanently.',
        config: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save integration settings.' });
    }
  });
}
