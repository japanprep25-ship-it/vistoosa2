import type { Express, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';
import { db } from './firebaseAdmin';

const INTEGRATIONS_COLLECTION = 'integrationsConfig';

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

  try {
    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) return {};
    return doc.data() as FullIntegrationsConfig;
  } catch (err: any) {
    console.error(`[IntegrationsConfigStore]: Error loading integrations config for user ${userId}:`, err?.message || err);
    return {};
  }
}

export async function saveIntegrationsConfig(
  userId: string,
  newConfig: Partial<FullIntegrationsConfig>
): Promise<FullIntegrationsConfig> {
  if (!userId) return {};

  try {
    const current = await loadIntegrationsConfig(userId);
    const merged: FullIntegrationsConfig = {
      ...current,
      ...newConfig,
      website: newConfig.website ? { ...current.website, ...newConfig.website } : current.website,
      meta: newConfig.meta ? { ...current.meta, ...newConfig.meta } : current.meta,
      gas: newConfig.gas ? { ...current.gas, ...newConfig.gas } : current.gas,
    };

    const docRef = db.collection(INTEGRATIONS_COLLECTION).doc(userId);
    await docRef.set({ ...merged, updatedAt: new Date().toISOString() }, { merge: true });

    return merged;
  } catch (err: any) {
    console.error(`[IntegrationsConfigStore]: Error saving integrations config for user ${userId}:`, err?.message || err);
    return {};
  }
}

export function mountIntegrationsConfigRoutes(app: Express) {
  // GET /api/settings/integrations - Load all persistent integration settings for user
  app.get('/api/settings/integrations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

  // POST /api/settings/integrations - Save persistent integration settings for user
  app.post('/api/settings/integrations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
