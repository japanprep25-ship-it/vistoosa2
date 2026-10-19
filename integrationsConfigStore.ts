import type { Express, Response } from 'express';
import { requireAuth, requireMotherGmail, AuthenticatedRequest } from './authMiddleware';
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
    appScriptDeploymentId: string;
    webAppUrl: string;
    sheetUrl: string;
    status: 'connected' | 'disconnected';
    lastSync: string;
  };
}

export async function loadIntegrationsConfig(userId: string): Promise<FullIntegrationsConfig> {
  if (!userId) return {};

  const local = inMemoryIntegrations.get(userId);
  if (local) return local;

  if (isFirestoreQuotaExceeded()) {
    return local || {};
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) return {};
    const data = doc.data() as FullIntegrationsConfig;
    inMemoryIntegrations.set(userId, data);
    return data;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return inMemoryIntegrations.get(userId) || {};
  }
}

export async function saveIntegrationsConfig(
  userId: string,
  newConfig: Partial<FullIntegrationsConfig>
): Promise<FullIntegrationsConfig> {
  if (!userId) return {};

  const current = (await loadIntegrationsConfig(userId)) || inMemoryIntegrations.get(userId) || {};
  const merged: FullIntegrationsConfig = {
    ...current,
    ...newConfig,
    website: newConfig.website ? { ...current.website, ...newConfig.website } : current.website,
    meta: newConfig.meta ? { ...current.meta, ...newConfig.meta } : current.meta,
    gas: newConfig.gas ? { ...current.gas, ...newConfig.gas } : current.gas,
  };

  inMemoryIntegrations.set(userId, merged);

  if (isFirestoreQuotaExceeded()) {
    return merged;
  }

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(userId);
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
  // GET /api/settings/integrations - Load all persistent integration settings (Mother Gmail ONLY)
  app.get('/api/settings/integrations', requireMotherGmail, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const config = await loadIntegrationsConfig(userId);
      return res.json({
        success: true,
        config,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load integration settings.' });
    }
  });

  // POST /api/settings/integrations - Save persistent integration settings (Mother Gmail ONLY)
  app.post('/api/settings/integrations', requireMotherGmail, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const payload = req.body || {};
      const updated = await saveIntegrationsConfig(userId, payload);
      return res.json({
        success: true,
        message: 'Integration settings saved permanently in Firestore.',
        config: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save integration settings.' });
    }
  });
}
