// pathaoConfigStore.ts
// -----------------------------------------------------------------------
// Stores Pathao credentials per-user in `pathao-config.json`.
// Each user (userId) has an isolated configuration record.

import fs from 'fs';
import path from 'path';
import type { Express, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const CONFIG_PATH = path.join(process.cwd(), 'pathao-config.json');

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

type PerUserPathaoConfigs = Record<string, PathaoConfig>;

function loadAllConfigs(): PerUserPathaoConfigs {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Legacy migration check: if file is single PathaoConfig object without userId keys
    if (parsed && typeof parsed === 'object' && 'clientId' in parsed && !('usr_' in parsed)) {
      return { usr_admin_default: parsed as PathaoConfig };
    }
    return (parsed as PerUserPathaoConfigs) || {};
  } catch {
    return {};
  }
}

export function loadPathaoConfig(userId: string): PathaoConfig | null {
  if (!userId) return null;
  const all = loadAllConfigs();
  return all[userId] || null;
}

export function savePathaoConfig(userId: string, config: PathaoConfig) {
  if (!userId) return;
  const all = loadAllConfigs();
  all[userId] = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(all, null, 2), 'utf-8');
}

export function mountPathaoConfigRoutes(app: Express) {
  // Save Pathao credentials for logged-in user
  app.post('/api/settings/pathao', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const { baseUrl, clientId, clientSecret, username, password, storeId } = req.body || {};

    if (!clientId || !clientSecret || !username || !password || !storeId) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Preserve existing secrets if user sent masked values '••••••••'
    let finalClientSecret = clientSecret;
    let finalPassword = password;
    const existing = loadPathaoConfig(userId);

    if (clientSecret === '••••••••' && existing) {
      finalClientSecret = existing.clientSecret;
    }
    if (password === '••••••••' && existing) {
      finalPassword = existing.password;
    }

    savePathaoConfig(userId, {
      baseUrl: baseUrl || 'https://api-hermes.pathao.com',
      clientId: String(clientId).trim(),
      clientSecret: String(finalClientSecret).trim(),
      username: String(username).trim(),
      password: String(finalPassword).trim(),
      storeId: String(storeId).trim(),
    });

    return res.json({ success: true, message: 'Your Pathao credentials saved successfully.' });
  });

  // Prefill Settings page for logged-in user
  app.get('/api/settings/pathao', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const config = loadPathaoConfig(userId);

    if (!config) return res.json({ configured: false });

    return res.json({
      configured: true,
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      storeId: config.storeId,
      username: config.username,
      clientSecret: '••••••••',
      password: '••••••••',
    });
  });
}
