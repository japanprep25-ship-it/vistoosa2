// pathaoConfigStore.ts
// -----------------------------------------------------------------------
// Lets the Pathao credentials be entered through a form in your app's
// Settings/Integrations page (already exists in IntegrationsHubView.tsx),
// instead of typing them into AI Studio chat or Render's env var panel.
//
// Saves to a local JSON file on the server (simplest option for now).
// Swap `saveConfig`/`loadConfig` for a real database call later if needed.

import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';

const CONFIG_PATH = path.join(process.cwd(), 'pathao-config.json');

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

export function loadPathaoConfig(): PathaoConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config: PathaoConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// Mount these two routes in server.ts:
//   import { mountPathaoConfigRoutes } from './pathaoConfigStore';
//   mountPathaoConfigRoutes(app);
export function mountPathaoConfigRoutes(app: Express) {
  // Called when the Settings form is submitted
  app.post('/api/settings/pathao', (req: Request, res: Response) => {
    const { baseUrl, clientId, clientSecret, username, password, storeId } = req.body;
    if (!clientId || !clientSecret || !username || !password || !storeId) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    saveConfig({
      baseUrl: baseUrl || 'https://api-hermes.pathao.com',
      clientId,
      clientSecret,
      username,
      password,
      storeId,
    });
    return res.json({ success: true, message: 'Pathao credentials saved.' });
  });

  // Called when the Settings page loads, to prefill the form
  // (mask the secret/password fields in the response for safety)
  app.get('/api/settings/pathao', (_req: Request, res: Response) => {
    const config = loadPathaoConfig();
    if (!config) return res.json({ configured: false });
    return res.json({
      configured: true,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      storeId: config.storeId,
      clientSecret: '••••••••',
      password: '••••••••',
    });
  });
}
