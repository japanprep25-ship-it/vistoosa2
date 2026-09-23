// pathaoConfigStore.ts
// -----------------------------------------------------------------------
// Stores Pathao credentials per-user in Firestore collection `pathaoConfig`.
// Each user (userId) has an isolated configuration record.

import type { Express, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';
import { db } from './firebaseAdmin';

const PATHAO_COLLECTION = 'pathaoConfig';

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

export async function loadPathaoConfig(userId: string): Promise<PathaoConfig | null> {
  if (!userId) return null;

  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) return null;
    return doc.data() as PathaoConfig;
  } catch (err: any) {
    console.error(`[PathaoConfigStore]: Error loading Pathao config for user ${userId}:`, err?.message || err);
    return null;
  }
}

export async function savePathaoConfig(userId: string, config: PathaoConfig): Promise<void> {
  if (!userId) return;

  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(userId);
    await docRef.set(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error(`[PathaoConfigStore]: Error saving Pathao config for user ${userId}:`, err?.message || err);
  }
}

export function mountPathaoConfigRoutes(app: Express) {
  // Save Pathao credentials for logged-in user
  app.post('/api/settings/pathao', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { baseUrl, clientId, clientSecret, username, password, storeId } = req.body || {};

      if (!clientId || !clientSecret || !username || !password || !storeId) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }

      // Preserve existing secrets if user sent masked values '••••••••'
      let finalClientSecret = clientSecret;
      let finalPassword = password;
      const existing = await loadPathaoConfig(userId);

      if (clientSecret === '••••••••' && existing) {
        finalClientSecret = existing.clientSecret;
      }
      if (password === '••••••••' && existing) {
        finalPassword = existing.password;
      }

      await savePathaoConfig(userId, {
        baseUrl: baseUrl || 'https://api-hermes.pathao.com',
        clientId: String(clientId).trim(),
        clientSecret: String(finalClientSecret).trim(),
        username: String(username).trim(),
        password: String(finalPassword).trim(),
        storeId: String(storeId).trim(),
      });

      return res.json({ success: true, message: 'Your Pathao credentials saved successfully in Firestore.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save Pathao configuration.' });
    }
  });

  // Prefill Settings page for logged-in user
  app.get('/api/settings/pathao', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const config = await loadPathaoConfig(userId);

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
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to retrieve Pathao settings.' });
    }
  });
}
