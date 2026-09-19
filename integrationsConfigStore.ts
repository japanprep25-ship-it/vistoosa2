import fs from 'fs';
import path from 'path';
import type { Express, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const CONFIG_PATH = path.join(process.cwd(), 'integrations-config.json');

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

type PerUserIntegrationsConfigs = Record<string, FullIntegrationsConfig>;

function loadAllIntegrationsConfigs(): PerUserIntegrationsConfigs {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    if (parsed && typeof parsed === 'object' && ('website' in parsed || 'meta' in parsed || 'gas' in parsed) && !('usr_' in parsed)) {
      return { usr_admin_default: parsed as FullIntegrationsConfig };
    }
    return (parsed as PerUserIntegrationsConfigs) || {};
  } catch {
    return {};
  }
}

export function loadIntegrationsConfig(userId: string): FullIntegrationsConfig {
  if (!userId) return {};
  const all = loadAllIntegrationsConfigs();
  return all[userId] || {};
}

export function saveIntegrationsConfig(userId: string, newConfig: Partial<FullIntegrationsConfig>) {
  if (!userId) return {};
  const all = loadAllIntegrationsConfigs();
  const current = all[userId] || {};
  const merged = {
    ...current,
    ...newConfig,
    website: newConfig.website ? { ...current.website, ...newConfig.website } : current.website,
    meta: newConfig.meta ? { ...current.meta, ...newConfig.meta } : current.meta,
    gas: newConfig.gas ? { ...current.gas, ...newConfig.gas } : current.gas,
  };
  all[userId] = merged;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(all, null, 2), 'utf-8');
  return merged;
}

export function mountIntegrationsConfigRoutes(app: Express) {
  // GET /api/settings/integrations - Load all persistent integration settings for user
  app.get('/api/settings/integrations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const config = loadIntegrationsConfig(userId);
    return res.json({
      success: true,
      config,
    });
  });

  // POST /api/settings/integrations - Save persistent integration settings for user
  app.post('/api/settings/integrations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const payload = req.body || {};
    const updated = saveIntegrationsConfig(userId, payload);
    return res.json({
      success: true,
      message: 'Integration settings saved permanently for your account.',
      config: updated,
    });
  });
}
