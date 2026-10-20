// pathaoConfigStore.ts
// -----------------------------------------------------------------------
// Stores Pathao credentials per-user in Firestore collection `pathaoConfig`.
// Each user (userId) has an isolated configuration record.

import type { Express, Response } from 'express';
import { extractOptionalAuth, AuthenticatedRequest } from './authMiddleware';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
} from './firebaseAdmin';

const PATHAO_COLLECTION = 'pathaoConfig';

// In-memory cache for high resilience during cloud quota limits
const inMemoryPathao = new Map<string, PathaoConfig>();

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

export async function loadPathaoConfig(userId: string = 'usr_admin_default'): Promise<PathaoConfig | null> {
  const uid = userId || 'usr_admin_default';

  const local = inMemoryPathao.get(uid);
  if (local) return local;

  if (isFirestoreQuotaExceeded()) {
    return local || null;
  }

  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) return local || null;
    const data = doc.data() as PathaoConfig;
    inMemoryPathao.set(uid, data);
    return data;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return inMemoryPathao.get(uid) || null;
  }
}

export async function savePathaoConfig(userId: string = 'usr_admin_default', config: PathaoConfig): Promise<void> {
  const uid = userId || 'usr_admin_default';

  inMemoryPathao.set(uid, config);

  if (isFirestoreQuotaExceeded()) {
    return;
  }

  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(uid);
    await docRef.set(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }
}

export function mountPathaoConfigRoutes(app: Express) {
  // Save Pathao credentials for user
  app.post('/api/settings/pathao', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_admin_default';
      const payload = req.body || {};
      const existing = (await loadPathaoConfig(userId)) || {
        baseUrl: 'https://api-hermes.pathao.com',
        clientId: '',
        clientSecret: '',
        username: '',
        password: '',
        storeId: '',
      };

      let finalClientSecret = payload.clientSecret !== undefined ? String(payload.clientSecret).trim() : existing.clientSecret;
      let finalPassword = payload.password !== undefined ? String(payload.password).trim() : existing.password;

      if ((finalClientSecret === '••••••••' || finalClientSecret === '') && existing.clientSecret) {
        finalClientSecret = existing.clientSecret;
      }
      if ((finalPassword === '••••••••' || finalPassword === '') && existing.password) {
        finalPassword = existing.password;
      }

      const conf: PathaoConfig = {
        baseUrl: (payload.baseUrl && String(payload.baseUrl).trim()) || existing.baseUrl || 'https://api-hermes.pathao.com',
        clientId: payload.clientId !== undefined && String(payload.clientId).trim() !== '' ? String(payload.clientId).trim() : existing.clientId,
        clientSecret: finalClientSecret,
        username: (payload.username || payload.merchantId) !== undefined && String(payload.username || payload.merchantId).trim() !== ''
          ? String(payload.username || payload.merchantId).trim()
          : existing.username,
        password: finalPassword,
        storeId: payload.storeId !== undefined && String(payload.storeId).trim() !== '' ? String(payload.storeId).trim() : existing.storeId,
      };

      await savePathaoConfig(userId, conf);

      return res.json({ success: true, message: 'Your Pathao credentials saved successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save Pathao configuration.' });
    }
  });

  // Prefill Settings page for user
  app.get('/api/settings/pathao', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_admin_default';
      const config = await loadPathaoConfig(userId);

      if (!config) return res.json({ configured: false });

      return res.json({
        configured: true,
        baseUrl: config.baseUrl,
        clientId: config.clientId,
        storeId: config.storeId,
        username: config.username,
        clientSecret: config.clientSecret,
        password: config.password,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to retrieve Pathao settings.' });
    }
  });
}
