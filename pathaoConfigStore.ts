import type { Express, Response } from 'express';
import { extractOptionalAuth, AuthenticatedRequest } from './authMiddleware';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  incrementFirestoreReads,
} from './firebaseAdmin';

const PATHAO_COLLECTION = 'pathaoConfig';
const inMemoryPathao = new Map<string, PathaoConfig>();

const pendingPathaoSaves: Array<{ userId: string; config: any; timestamp: number }> = [];

setInterval(async () => {
  if (pendingPathaoSaves.length === 0 || isFirestoreQuotaExceeded()) return;
  const item = pendingPathaoSaves.shift();
  if (!item) return;
  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(item.userId);
    await docRef.set({ ...item.config, updatedAt: new Date().toISOString() }, { merge: true });
    console.info(`[PathaoConfig Background Sync]: Successfully flushed pending save for user ${item.userId}`);
  } catch (err) {
    pendingPathaoSaves.push(item);
  }
}, 2 * 60 * 1000);

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
}

export async function loadPathaoConfig(userId: string = 'usr_vistoosa_mother'): Promise<PathaoConfig | null> {
  const uid = userId || 'usr_vistoosa_mother';

  const local = inMemoryPathao.get(uid);
  if (local) return local;

  if (isFirestoreQuotaExceeded()) {
    return local || null;
  }

  try {
    const docRef = db.collection(PATHAO_COLLECTION).doc(uid);
    const doc = await docRef.get();
    incrementFirestoreReads('settings');

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

export async function savePathaoConfig(
  userId: string = 'usr_vistoosa_mother',
  config: PathaoConfig
): Promise<{ persisted: boolean; error?: string }> {
  const uid = userId || 'usr_vistoosa_mother';

  inMemoryPathao.set(uid, config);

  if (isFirestoreQuotaExceeded()) {
    pendingPathaoSaves.push({ userId: uid, config, timestamp: Date.now() });
    return { persisted: false, error: 'Firestore quota exceeded' };
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
    return { persisted: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    pendingPathaoSaves.push({ userId: uid, config, timestamp: Date.now() });
    return { persisted: false, error: err?.message || 'Database write error' };
  }
}

export function resolveOwnerUserId(req: any): string {
  if (req && req.userId && req.userId !== 'usr_admin_default') {
    return req.userId;
  }
  return 'usr_vistoosa_mother';
}

export function mountPathaoConfigRoutes(app: Express) {
  app.post('/api/settings/pathao', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = resolveOwnerUserId(req);
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

      const result = await savePathaoConfig(userId, conf);

      return res.json({
        success: true,
        persisted: result.persisted,
        message: result.persisted
          ? 'Pathao credentials saved successfully.'
          : `Saved only temporarily in server memory. Database error: ${result.error || 'Unknown'}`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save Pathao configuration.' });
    }
  });

  app.get('/api/settings/pathao', extractOptionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = resolveOwnerUserId(req);
      const config = await loadPathaoConfig(userId);

      if (!config) return res.json({ configured: false });

      return res.json({
        configured: true,
        baseUrl: config.baseUrl,
        clientId: config.clientId,
        storeId: config.storeId,
        username: config.username,
        clientSecret: config.clientSecret ? '••••••••' : '',
        password: config.password ? '••••••••' : '',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to retrieve Pathao settings.' });
    }
  });
}
