import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';

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

export function loadIntegrationsConfig(): FullIntegrationsConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveIntegrationsConfig(newConfig: Partial<FullIntegrationsConfig>) {
  const current = loadIntegrationsConfig();
  const merged = {
    ...current,
    ...newConfig,
    website: newConfig.website ? { ...current.website, ...newConfig.website } : current.website,
    meta: newConfig.meta ? { ...current.meta, ...newConfig.meta } : current.meta,
    gas: newConfig.gas ? { ...current.gas, ...newConfig.gas } : current.gas,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

export function mountIntegrationsConfigRoutes(app: Express) {
  // GET /api/settings/integrations - Load all persistent integration settings
  app.get('/api/settings/integrations', (_req: Request, res: Response) => {
    const config = loadIntegrationsConfig();
    return res.json({
      success: true,
      config,
    });
  });

  // POST /api/settings/integrations - Save persistent integration settings
  app.post('/api/settings/integrations', (req: Request, res: Response) => {
    const payload = req.body || {};
    const updated = saveIntegrationsConfig(payload);
    return res.json({
      success: true,
      message: 'Integration settings saved permanently.',
      config: updated,
    });
  });
}
