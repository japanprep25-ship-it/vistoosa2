// inboxChannelsService.ts
// -----------------------------------------------------------------------
// Omnichannel Meta & WhatsApp Integration Service (Channels, OAuth, Inbox, Webhooks, SSE)
// -----------------------------------------------------------------------

import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  incrementFirestoreReads,
} from './firebaseAdmin';
import { parseOrderWithGemini } from './metaIntegrationService';
import { detectDistrict } from './src/utils/districtDetector';

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';

function getAppUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'https://vistoosa2.onrender.com';
}

function getEncryptionKey(appSecret?: string): Buffer {
  let secret = process.env.TOKEN_ENCRYPTION_KEY || appSecret;
  if (!secret) {
    secret = 'vistoosa_default_encryption_key_32_bytes_long!!';
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptSecret(plainText: string, appSecret?: string): string {
  if (!plainText || plainText.includes('••••')) return plainText;
  try {
    const key = getEncryptionKey(appSecret);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (err) {
    return plainText;
  }
}

export function decryptSecret(cipherText: string, appSecret?: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  try {
    const [ivHex, tagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return cipherText;
    const key = getEncryptionKey(appSecret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return cipherText;
  }
}

// In-memory fallback stores & pending write queues (Section B & PART 1)
const pendingWritesQueue: Array<{ collection: string; docId: string; data: any; timestamp: number }> = [];

setInterval(async () => {
  if (pendingWritesQueue.length === 0 || isFirestoreQuotaExceeded()) return;
  const item = pendingWritesQueue.shift();
  if (!item) return;
  try {
    await db.collection(item.collection).doc(item.docId).set({ ...item.data, updatedAt: new Date().toISOString() }, { merge: true });
    console.info(`[Background Sync]: Flushed pending write for ${item.collection}/${item.docId}`);
  } catch (err) {
    pendingWritesQueue.push(item);
  }
}, 2 * 60 * 1000);

// SSE clients map by userId
const sseClients = new Map<string, Response[]>();

export function broadcastSseEvent(userId: string, eventType: string, payload: any) {
  const clients = sseClients.get(userId);
  if (!clients || clients.length === 0) return;
  const dataStr = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(dataStr);
    } catch {}
  });
}

let globalOrderCreationHook: ((order: any) => void) | null = null;

// Migration from old metaConfig / integrationsConfig
async function checkAndRunMigration() {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
    if (credSnap.exists) return; // already migrated

    // Try loading old global config
    const oldMetaDoc = await db.collection('metaConfig').doc('global').get();
    let appId = '';
    let appSecret = '';
    let verifyToken = 'vistoosa_meta_secret_token_2026';
    let pageId = '';
    let pageAccessToken = '';
    let igId = '';
    let waPhoneId = '';
    let wabaId = '';
    let waToken = '';

    if (oldMetaDoc.exists) {
      const d = oldMetaDoc.data() || {};
      appId = d.metaAppId || '';
      appSecret = d.metaAppSecret || '';
      verifyToken = d.metaVerifyToken || verifyToken;
      pageId = d.pageId || '';
      pageAccessToken = d.pageAccessToken || '';
      igId = d.instagramBusinessAccountId || '';
      waPhoneId = d.whatsappPhoneNumberId || '';
      wabaId = d.whatsappBusinessAccountId || '';
      waToken = d.whatsappAccessToken || '';
    }

    if (!appId) appId = process.env.META_APP_ID || '';
    if (!appSecret) appSecret = process.env.META_APP_SECRET || '';
    if (!pageAccessToken) pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || '';
    if (!pageId) pageId = process.env.META_PAGE_ID || '';

    if (appId || pageAccessToken) {
      const ownerId = 'usr_vistoosa_mother';
      await db.collection('system_settings').doc('meta_credentials').set({
        appId,
        appSecret: encryptSecret(appSecret, appSecret),
        verifyToken,
        updatedAt: new Date().toISOString(),
      });

      if (pageId && pageAccessToken) {
        const channelId = `fb_${pageId}`;
        await db.collection('users').doc(ownerId).collection('channels').doc(channelId).set({
          type: 'facebook',
          externalId: pageId,
          displayName: `Facebook Page (${pageId})`,
          accessToken: encryptSecret(pageAccessToken, appSecret),
          status: 'connected',
          connectedAt: new Date().toISOString(),
        });
        await db.collection('mt_page_index').doc(pageId).set({ userId: ownerId });
      }

      if (igId) {
        const channelId = `ig_${igId}`;
        await db.collection('users').doc(ownerId).collection('channels').doc(channelId).set({
          type: 'instagram',
          externalId: igId,
          displayName: `Instagram Account (${igId})`,
          accessToken: encryptSecret(pageAccessToken, appSecret),
          status: 'connected',
          connectedAt: new Date().toISOString(),
        });
        await db.collection('mt_page_index').doc(igId).set({ userId: ownerId });
      }

      if (waPhoneId && waToken) {
        const channelId = `wa_${waPhoneId}`;
        await db.collection('users').doc(ownerId).collection('channels').doc(channelId).set({
          type: 'whatsapp',
          externalId: waPhoneId,
          displayName: `WhatsApp Number (${waPhoneId})`,
          accessToken: encryptSecret(waToken, appSecret),
          wabaId: wabaId || '',
          status: 'connected',
          connectedAt: new Date().toISOString(),
        });
        await db.collection('mt_wa_index').doc(waPhoneId).set({ userId: ownerId });
      }
      console.info('[Migration]: Successfully migrated legacy Meta credentials to Firestore system_settings & channels.');
    }
  } catch (err) {
    console.warn('[Migration Warning]:', err);
  }
}

checkAndRunMigration();

// Helper to sign OAuth state for Part 2
function signOAuthState(userId: string, appSecret: string): string {
  const payload = {
    csrf: crypto.randomBytes(16).toString('hex'),
    userId,
    exp: Date.now() + 10 * 60 * 1000, // 10 mins expiry
  };
  const jsonStr = JSON.stringify(payload);
  const b64 = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', appSecret || 'vistoosa_state_secret').update(b64).digest('base64url');
  return `${b64}.${hmac}`;
}

function verifyOAuthState(stateStr: string, appSecret: string): { valid: boolean; userId?: string; error?: string } {
  try {
    if (!stateStr || !stateStr.includes('.')) return { valid: false, error: 'Invalid state format' };
    const [b64, signature] = stateStr.split('.');
    const expected = crypto.createHmac('sha256', appSecret || 'vistoosa_state_secret').update(b64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { valid: false, error: 'State signature mismatch' };
    }
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return { valid: false, error: 'OAuth state expired' };
    return { valid: true, userId: payload.userId };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid state' };
  }
}

// -----------------------------------------------------------------------
// Mount Omnichannel Routes
// -----------------------------------------------------------------------

export function mountInboxChannelsRoutes(app: Express, orderCreationHook?: (order: any) => void) {
  globalOrderCreationHook = orderCreationHook || null;
  // 1. GET /api/connect/channels -> Get connected channels for current user
  app.get('/api/connect/channels', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_admin_default';
      const channelsSnap = await db.collection('users').doc(userId).collection('channels').get();
      incrementFirestoreReads('channels');
      const channels = channelsSnap.docs.map(d => ({ id: d.id, ...d.data(), accessToken: '••••••••' }));
      return res.json({ success: true, channels });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load channels' });
    }
  });

  // 2. GET /api/settings/meta-credentials -> Get Meta App credentials (masked)
  app.get('/api/settings/meta-credentials', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      let appId = process.env.META_APP_ID || '';
      let appSecret = process.env.META_APP_SECRET || '';
      let verifyToken = process.env.META_VERIFY_TOKEN || 'vistoosa_meta_secret_token_2026';

      if (!isFirestoreQuotaExceeded()) {
        const snap = await db.collection('system_settings').doc('meta_credentials').get();
        incrementFirestoreReads('settings');
        if (snap.exists) {
          const d = snap.data() || {};
          if (d.appId) appId = d.appId;
          if (d.appSecret) appSecret = decryptSecret(d.appSecret, appId);
          if (d.verifyToken) verifyToken = d.verifyToken;
        }
      }

      return res.json({
        success: true,
        appId,
        appSecret: appSecret ? '••••••••' : '',
        verifyToken,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load credentials' });
    }
  });

  // 3. POST /api/settings/meta-credentials -> Save Meta App credentials
  app.post('/api/settings/meta-credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { appId, appSecret, verifyToken } = req.body || {};
      const cleanAppId = String(appId || '').trim();
      let cleanSecret = String(appSecret || '').trim();
      const cleanVerify = String(verifyToken || '').trim() || 'vistoosa_meta_secret_token_2026';

      if (cleanSecret === '••••••••' || !cleanSecret) {
        // Keep existing encrypted secret
        const snap = await db.collection('system_settings').doc('meta_credentials').get();
        if (snap.exists) {
          cleanSecret = snap.data()?.appSecret || '';
        }
      } else {
        cleanSecret = encryptSecret(cleanSecret, cleanAppId);
      }

      const dataToSave = { appId: cleanAppId, appSecret: cleanSecret, verifyToken: cleanVerify };

      if (isFirestoreQuotaExceeded()) {
        pendingWritesQueue.push({ collection: 'system_settings', docId: 'meta_credentials', data: dataToSave, timestamp: Date.now() });
        return res.json({ success: true, persisted: false, message: 'Saved only in server memory (Database quota limit reached)' });
      }

      await db.collection('system_settings').doc('meta_credentials').set({ ...dataToSave, updatedAt: new Date().toISOString() }, { merge: true });
      return res.json({ success: true, persisted: true, message: 'Meta credentials saved successfully to Firestore.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save credentials' });
    }
  });

  // 4. GET /api/auth/facebook/start -> Start OAuth popup
  app.get('/api/auth/facebook/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const snap = await db.collection('system_settings').doc('meta_credentials').get();
      const creds = snap.exists ? snap.data() || {} : {};
      const appId = creds.appId || process.env.META_APP_ID;
      const appSecret = decryptSecret(creds.appSecret || process.env.META_APP_SECRET || '', appId);

      if (!appId || !appSecret) {
        return res.status(400).json({ success: false, message: 'Meta App ID and App Secret must be configured first.' });
      }

      const appUrl = getAppUrl(req);
      const redirectUri = `${appUrl}/api/auth/facebook/callback`;
      const state = signOAuthState(req.userId || 'usr_vistoosa_mother', appSecret);

      const scopes = [
        'pages_show_list',
        'pages_messaging',
        'pages_manage_metadata',
        'pages_read_engagement',
        'instagram_basic',
        'instagram_manage_messages',
      ].join(',');

      const url = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

      return res.json({ success: true, url });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to start OAuth' });
    }
  });

  // 5. GET /api/auth/facebook/callback -> OAuth callback
  app.get('/api/auth/facebook/callback', async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query as Record<string, string>;
    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;

    const renderResultPage = (success: boolean, title: string, message: string, payload?: any) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; background: #0f0f14; color: #f4f4f5; padding: 40px; text-align: center; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; max-width: 420px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h2 { color: ${success ? '#10b981' : '#ef4444'}; margin-top: 0; }
          p { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
          .btn { background: #27272a; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${success ? '✅ Success' : '⚠️ Connection Failed'}</h2>
          <p>${message}</p>
          <button class="btn" onclick="window.close()">Close Window</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'FB_CONNECT_RESULT', ok: ${success}, payload: ${JSON.stringify(payload || {})} }, '${appUrl}');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body>
      </html>
    `;

    if (error || error_description) {
      return res.send(renderResultPage(false, 'Cancelled', error_description || error || 'Facebook login cancelled.'));
    }

    try {
      const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
      const creds = credSnap.exists ? credSnap.data() || {} : {};
      const appId = creds.appId || process.env.META_APP_ID;
      const appSecret = decryptSecret(creds.appSecret || process.env.META_APP_SECRET || '', appId);

      const stateCheck = verifyOAuthState(state, appSecret);
      if (!stateCheck.valid) {
        return res.send(renderResultPage(false, 'Security Check Failed', stateCheck.error || 'Invalid state.'));
      }
      const userId = stateCheck.userId || 'usr_vistoosa_mother';

      const tokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;

      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        return res.send(renderResultPage(false, 'Token Exchange Failed', tokenData.error?.message || 'Failed to exchange code.'));
      }

      const userAccessToken = tokenData.access_token;

      // Get Pages
      const pagesUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(
        userAccessToken
      )}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();

      if (!pagesRes.ok || !Array.isArray(pagesData.data) || pagesData.data.length === 0) {
        return res.send(renderResultPage(false, 'No Pages Found', 'No Facebook Pages found for this account. Ensure you are an Admin of at least one Page.'));
      }

      // Automatically connect the first Page (stateless / single page flow or prompt)
      const page = pagesData.data[0];
      const pageId = page.id;
      const pageName = page.name;
      const pageToken = page.access_token;
      const igId = page.instagram_business_account?.id;
      const igUsername = page.instagram_business_account?.username;

      // Check if page already bound to another user in mt_page_index
      const pageIndexRef = db.collection('mt_page_index').doc(pageId);
      const pageIndexSnap = await pageIndexRef.get();
      if (pageIndexSnap.exists && pageIndexSnap.data()?.userId !== userId) {
        return res.send(renderResultPage(false, 'Page Already Claimed', `This Facebook Page is already connected to another Vistoosa account.`));
      }

      // Save Page Channel
      const channelId = `fb_${pageId}`;
      const encPageToken = encryptSecret(pageToken, appSecret);
      await db.collection('users').doc(userId).collection('channels').doc(channelId).set({
        type: 'facebook',
        externalId: pageId,
        displayName: pageName,
        accessToken: encPageToken,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });
      await pageIndexRef.set({ userId });

      // Subscribe webhook for page
      try {
        await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,message_deliveries,message_reads&access_token=${encodeURIComponent(pageToken)}`, {
          method: 'POST',
        });
      } catch (e) {}

      // If Instagram account present
      if (igId) {
        const igChannelId = `ig_${igId}`;
        await db.collection('users').doc(userId).collection('channels').doc(igChannelId).set({
          type: 'instagram',
          externalId: igId,
          displayName: `Instagram (@${igUsername || igId})`,
          accessToken: encPageToken,
          status: 'connected',
          connectedAt: new Date().toISOString(),
        });
        await db.collection('mt_page_index').doc(igId).set({ userId });
      }

      return res.send(renderResultPage(true, 'Connected Successfully', `Facebook Page "${pageName}" connected successfully!`, { pageId, pageName }));
    } catch (err: any) {
      return res.send(renderResultPage(false, 'Error', err?.message || 'OAuth processing failed.'));
    }
  });

  // 6. POST /api/connect/whatsapp/connect -> Connect WhatsApp Manually or via Embedded Signup
  app.post('/api/connect/whatsapp/connect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const { phoneNumberId, wabaId, accessToken, verifiedName } = req.body || {};
      const cleanPhoneId = String(phoneNumberId || '').trim();
      const cleanWaba = String(wabaId || '').trim();
      const cleanToken = String(accessToken || '').trim();

      if (!cleanPhoneId || !cleanToken) {
        return res.status(400).json({ success: false, message: 'Phone Number ID and Access Token are required.' });
      }

      const waIndexRef = db.collection('mt_wa_index').doc(cleanPhoneId);
      const waIndexSnap = await waIndexRef.get();
      if (waIndexSnap.exists && waIndexSnap.data()?.userId !== userId) {
        return res.status(400).json({ success: false, message: 'This WhatsApp number is already connected to another account.' });
      }

      const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
      const appSecret = credSnap.exists ? credSnap.data()?.appSecret : '';

      const channelId = `wa_${cleanPhoneId}`;
      await db.collection('users').doc(userId).collection('channels').doc(channelId).set({
        type: 'whatsapp',
        externalId: cleanPhoneId,
        displayName: verifiedName || `WhatsApp (${cleanPhoneId})`,
        accessToken: encryptSecret(cleanToken, appSecret),
        wabaId: cleanWaba,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });
      await waIndexRef.set({ userId });

      return res.json({ success: true, message: 'WhatsApp channel connected successfully!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to connect WhatsApp' });
    }
  });

  // 7. POST /api/connect/channels/disconnect -> Disconnect channel
  app.post('/api/connect/channels/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const { channelId, externalId, type } = req.body || {};
      if (!channelId) return res.status(400).json({ success: false, message: 'Channel ID required' });

      await db.collection('users').doc(userId).collection('channels').doc(channelId).delete();
      if (externalId) {
        if (type === 'whatsapp') {
          await db.collection('mt_wa_index').doc(externalId).delete();
        } else {
          await db.collection('mt_page_index').doc(externalId).delete();
        }
      }

      return res.json({ success: true, message: 'Channel disconnected successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to disconnect channel' });
    }
  });

  // 8. GET /api/inbox/conversations -> Load conversation list for logged-in user
  app.get('/api/inbox/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const snap = await db.collection('users').doc(userId).collection('conversations').orderBy('lastUpdated', 'desc').limit(50).get();
      incrementFirestoreReads('conversations');
      const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, conversations });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load conversations' });
    }
  });

  // 9. GET /api/inbox/messages/:conversationId -> Load message history
  app.get('/api/inbox/messages/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const convId = req.params.conversationId;
      const convRef = db.collection('users').doc(userId).collection('conversations').doc(convId);

      // Mark unread = 0
      await convRef.set({ unreadCount: 0 }, { merge: true });

      const msgsSnap = await convRef.collection('messages').orderBy('timestamp', 'asc').limit(50).get();
      incrementFirestoreReads('messages');
      const messages = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return res.json({ success: true, messages });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load messages' });
    }
  });

  // 10. POST /api/inbox/send -> Send message or photo to customer
  app.post('/api/inbox/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || 'usr_vistoosa_mother';
      const { conversationId, text, mediaId, mediaUrl } = req.body || {};
      if (!conversationId) return res.status(400).json({ success: false, message: 'Conversation ID required' });

      const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
      const convSnap = await convRef.get();
      if (!convSnap.exists) return res.status(404).json({ success: false, message: 'Conversation not found' });
      const convData = convSnap.data() || {};
      const channel = convData.channel; // facebook, instagram, whatsapp
      const customerId = convData.externalCustomerId || convData.senderId;

      // Find channel token
      const channelsSnap = await db.collection('users').doc(userId).collection('channels').where('type', '==', channel === 'instagram' ? 'instagram' : channel === 'whatsapp' ? 'whatsapp' : 'facebook').get();
      incrementFirestoreReads('channels');
      if (channelsSnap.empty) {
        return res.status(400).json({ success: false, error: 'No connected channel found for this conversation type' });
      }

      const channelDoc = channelsSnap.docs[0].data();
      const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
      const appSecret = credSnap.exists ? credSnap.data()?.appSecret : '';
      const accessToken = decryptSecret(channelDoc.accessToken, appSecret);

      let sendResOk = false;
      let metaMessageId = '';
      let errorReason = '';

      const finalMediaUrl = mediaUrl || (mediaId ? `${getAppUrl(req)}/media/${mediaId}` : '');

      if (channel === 'whatsapp') {
        const phoneNumId = channelDoc.externalId;
        const cleanPhone = customerId.replace(/\D/g, '');
        const recipient = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone.replace(/^0/, '')}`;

        let bodyPayload: any;
        if (finalMediaUrl) {
          bodyPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'image',
            image: { link: finalMediaUrl, caption: text || '' },
          };
        } else {
          bodyPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'text',
            text: { body: text },
          };
        }

        const waRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });
        const waData = await waRes.json();
        if (waRes.ok && waData.messages?.[0]?.id) {
          sendResOk = true;
          metaMessageId = waData.messages[0].id;
        } else {
          errorReason = waData.error?.message || 'WhatsApp send error';
        }
      } else {
        // Messenger or Instagram
        let messagePayload: any;
        if (finalMediaUrl) {
          messagePayload = {
            recipient: { id: customerId },
            message: {
              attachment: {
                type: 'image',
                payload: { url: finalMediaUrl, is_reusable: true },
              },
            },
          };
        } else {
          messagePayload = {
            messaging_type: 'RESPONSE',
            recipient: { id: customerId },
            message: { text },
          };
        }

        const fbRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(accessToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload),
        });
        const fbData = await fbRes.json();
        if (fbRes.ok && fbData.message_id) {
          sendResOk = true;
          metaMessageId = fbData.message_id;
        } else {
          errorReason = fbData.error?.message || 'Meta send error';
        }
      }

      if (!sendResOk) {
        return res.status(400).json({ success: false, error: errorReason || 'Failed to send message via Meta API' });
      }

      const newMsg = {
        sender: 'agent',
        text: text || '',
        attachmentUrl: finalMediaUrl || null,
        mid: metaMessageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };

      await convRef.collection('messages').add(newMsg);
      await convRef.set({
        lastMessage: text || '[Photo]',
        lastMessageSender: 'agent',
        lastUpdated: new Date().toISOString(),
      }, { merge: true });

      // Pause bot for 12 hours on manual reply
      await convRef.set({ botPausedUntil: new Date(Date.now() + 12 * 3600 * 1000).toISOString() }, { merge: true });

      return res.json({ success: true, messageId: metaMessageId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to send message' });
    }
  });

  // 11. POST /api/inbox/media -> Store compressed photo in inbox_media/{randomId} (7 day expiry)
  app.post('/api/inbox/media', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dataUrl, contentType } = req.body || {};
      if (!dataUrl) return res.status(400).json({ success: false, message: 'Data URL required' });

      const mediaId = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      await db.collection('inbox_media').doc(mediaId).set({
        dataUrl,
        contentType: contentType || 'image/jpeg',
        expiresAt,
        createdAt: new Date().toISOString(),
      });

      const publicUrl = `${getAppUrl(req)}/media/${mediaId}`;
      return res.json({ success: true, mediaId, publicUrl });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to store media' });
    }
  });

  // 12. GET /media/:id -> Public media serving route
  app.get('/media/:id', async (req: Request, res: Response) => {
    try {
      const mediaId = req.params.id;
      const snap = await db.collection('inbox_media').doc(mediaId).get();
      if (!snap.exists) return res.status(404).send('Media not found');
      const data = snap.data() || {};
      const dataUrl = data.dataUrl;
      const contentType = data.contentType || 'image/jpeg';

      if (!dataUrl || !dataUrl.includes(',')) return res.status(404).send('Invalid media format');
      const base64Data = dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(buffer);
    } catch (err) {
      return res.status(500).send('Error loading media');
    }
  });

  // 13. GET /api/inbox/stream -> Server-Sent Events (SSE) real-time stream
  app.get('/api/inbox/stream', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId || 'usr_vistoosa_mother';
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientList = sseClients.get(userId);
    if (!clientList) {
      clientList = [];
      sseClients.set(userId, clientList);
    }
    clientList.push(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(':\n\n');
      } catch {}
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const list = sseClients.get(userId);
      if (list) {
        const idx = list.indexOf(res);
        if (idx !== -1) list.splice(idx, 1);
      }
    });
  });

  // 14. Compliance: GET /privacy and POST /api/meta/data-deletion
  app.get('/privacy', (_req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Privacy Policy - Vistoosa</title><style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#121212;color:#e4e4e7;}</style></head><body><h1>Privacy Policy</h1><p>At Vistoosa, we value your privacy. We collect your name, phone number, address, and order details provided through our website, Facebook Messenger, Instagram, and WhatsApp solely to process your orders and deliver products. We never sell your personal information.</p></body></html>`);
  });

  app.post('/api/meta/data-deletion', async (req: Request, res: Response) => {
    try {
      const { signed_request } = req.body || {};
      // Return confirmation code and status URL for Meta compliance
      const confirmationCode = `vistoosa_del_${Math.floor(100000 + Math.random() * 900000)}`;
      return res.json({
        url: `${getAppUrl(req)}/data-deletion-status?id=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Data deletion error' });
    }
  });

  // 15. GET /api/health -> Public health endpoint
  app.get('/api/health', async (_req, res) => {
    let channelsConnected = 0;
    try {
      const channelsSnap = await db.collectionGroup('channels').get();
      channelsConnected = channelsSnap.size;
    } catch {}

    res.json({
      ok: true,
      uptime: process.uptime(),
      firestore: {
        ok: !isFirestoreQuotaExceeded(),
        quotaExceeded: isFirestoreQuotaExceeded(),
      },
      channelsConnected,
      timestamp: new Date().toISOString(),
    });
  });
}

// -----------------------------------------------------------------------
// Webhook Router & Inbound Message Processor (Part 3)
// -----------------------------------------------------------------------

export async function processMetaWebhookEvent(payload: any) {
  const objectType = payload.object;
  const entries = payload.entry || [];

  for (const entry of entries) {
    const entryId = entry.id; // pageId or wabaId or instagramId

    // Resolve owner userId via mt_page_index or mt_wa_index
    let userId = '';
    const pageIndexSnap = await db.collection('mt_page_index').doc(entryId).get();
    if (pageIndexSnap.exists) {
      userId = pageIndexSnap.data()?.userId || '';
    } else {
      const waIndexSnap = await db.collection('mt_wa_index').doc(entryId).get();
      if (waIndexSnap.exists) {
        userId = waIndexSnap.data()?.userId || '';
      }
    }

    if (!userId) {
      // Fallback to mother owner if unindexed
      userId = 'usr_vistoosa_mother';
    }

    if (objectType === 'page' || objectType === 'instagram') {
      const channel = objectType === 'instagram' ? 'instagram' : 'messenger';
      const messagings = entry.messaging || [];

      for (const msgEvent of messagings) {
        const senderId = msgEvent.sender?.id;
        const message = msgEvent.message;
        if (!senderId || !message) continue;

        const mid = message.mid;
        // De-duplicate by mid in Firestore or memory
        if (mid) {
          const midRef = db.collection('processed_mids').doc(mid);
          const midSnap = await midRef.get();
          if (midSnap.exists) continue;
          await midRef.set({ createdAt: new Date().toISOString() });
        }

        const text = message.text || '';
        let attachmentUrl: string | undefined;
        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
          attachmentUrl = message.attachments[0]?.payload?.url;
        }

        const conversationId = `${channel}_${senderId}`;
        const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
        const convSnap = await convRef.get();

        let senderName = `Customer #${senderId.slice(-4)}`;
        let profilePic = '';

        if (!convSnap.exists || !convSnap.data()?.senderName || convSnap.data()?.senderName.startsWith('Customer')) {
          // Fetch real name once
          try {
            const chanSnap = await db.collection('users').doc(userId).collection('channels').where('type', '==', channel).get();
            if (!chanSnap.empty) {
              const chanDoc = chanSnap.docs[0].data();
              const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
              const token = decryptSecret(chanDoc.accessToken, credSnap.exists ? credSnap.data()?.appSecret : '');
              const fields = channel === 'instagram' ? 'name,username,profile_pic' : 'first_name,last_name,profile_pic';
              const userRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${senderId}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
              const userData = await userRes.json();
              if (userRes.ok && !userData.error) {
                senderName = channel === 'instagram' ? (userData.name || userData.username || senderName) : (`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || senderName);
                profilePic = typeof userData.profile_pic === 'string' ? userData.profile_pic : (userData.profile_pic?.data?.url || '');
              }
            }
          } catch {}
        } else {
          senderName = convSnap.data()?.senderName;
          profilePic = convSnap.data()?.profilePic || '';
        }

        const newMsg = {
          sender: 'customer',
          text: text || '',
          attachmentUrl: attachmentUrl || null,
          mid: mid || null,
          status: 'delivered',
          timestamp: new Date().toISOString(),
        };

        await convRef.collection('messages').add(newMsg);

        const currentUnread = convSnap.exists ? (convSnap.data()?.unreadCount || 0) : 0;
        await convRef.set({
          senderId,
          externalCustomerId: senderId,
          senderName,
          profilePic: profilePic || null,
          channel,
          lastMessage: text || '[Photo]',
          lastMessageSender: 'customer',
          lastUpdated: new Date().toISOString(),
          unreadCount: currentUnread + 1,
        }, { merge: true });

        // Broadcast SSE event
        broadcastSseEvent(userId, 'new_message', { conversationId, message: newMsg });

        // AI Auto-reply check
        const userSettingsSnap = await db.collection('users').doc(userId).get();
        const autoReplyEnabled = userSettingsSnap.exists ? userSettingsSnap.data()?.aiAutoReplyEnabled === true : false;
        const botPausedUntil = convSnap.exists ? convSnap.data()?.botPausedUntil : null;
        const isBotPaused = botPausedUntil && new Date(botPausedUntil).getTime() > Date.now();

        if (autoReplyEnabled && !isBotPaused && text) {
          try {
            // Call Gemini parser with 20s timeout
            const messagesList = [{ sender: 'customer' as const, text, timestamp: new Date().toISOString() }];
            const parsed = await parseOrderWithGemini(messagesList, senderName);

            if (parsed.suggested_reply) {
              // Send reply via Meta API
              const chanSnap = await db.collection('users').doc(userId).collection('channels').where('type', '==', channel).get();
              if (!chanSnap.empty) {
                const credSnap = await db.collection('system_settings').doc('meta_credentials').get();
                const token = decryptSecret(chanSnap.docs[0].data().accessToken, credSnap.exists ? credSnap.data()?.appSecret : '');
                const replyRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messaging_type: 'RESPONSE',
                    recipient: { id: senderId },
                    message: { text: parsed.suggested_reply },
                  }),
                });
                const replyData = await replyRes.json();
                if (replyRes.ok && replyData.message_id) {
                  const botMsg = {
                    sender: 'bot',
                    text: parsed.suggested_reply,
                    mid: replyData.message_id,
                    status: 'sent',
                    timestamp: new Date().toISOString(),
                  };
                  await convRef.collection('messages').add(botMsg);
                  broadcastSseEvent(userId, 'new_message', { conversationId, message: botMsg });
                }
              }
            }

            // If complete order, add to orders queue
            if (parsed.confidence === 'complete' && parsed.phone_number && parsed.address && globalOrderCreationHook) {
              const newOrder = {
                id: `VIS-META-${Math.floor(1000 + Math.random() * 9000)}`,
                customerName: parsed.customer_name || senderName,
                phone: parsed.phone_number,
                address: parsed.address,
                city: parsed.city,
                channel: channel === 'instagram' ? 'Instagram' : 'Facebook',
                source: channel,
                senderId,
                items: [{
                  id: `item-${Date.now()}`,
                  productName: parsed.product_name || 'Supima Cotton Pique Polo',
                  sku: `POLO-NVY-${parsed.size || 'M'}`,
                  color: parsed.color || 'Midnight Navy',
                  size: parsed.size || 'M',
                  quantity: parsed.quantity || 1,
                  unitPrice: 1650,
                }],
                totalAmount: 1650 * (parsed.quantity || 1) + 60,
                deliveryFee: 60,
                paymentMethod: parsed.payment_method || 'Cash on Delivery',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                notes: `Auto-parsed from ${channel} chat.`,
              };
              globalOrderCreationHook(newOrder);
            }
          } catch (aiErr) {
            console.warn('[AI Auto-Reply Error]:', aiErr);
          }
        }
      }
    } else if (objectType === 'whatsapp_business_account') {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value || {};
        const messages = val.messages || [];
        const contacts = val.contacts || [];

        for (const msg of messages) {
          const senderId = msg.from;
          const msgId = msg.id;
          if (msgId) {
            const midRef = db.collection('processed_mids').doc(msgId);
            const midSnap = await midRef.get();
            if (midSnap.exists) continue;
            await midRef.set({ createdAt: new Date().toISOString() });
          }

          const contact = contacts.find((c: any) => c.wa_id === senderId);
          const senderName = contact?.profile?.name || `Customer #${senderId.slice(-4)}`;

          let text = '';
          let attachmentUrl: string | undefined;
          if (msg.type === 'text') text = msg.text?.body || '';
          else if (msg.type === 'image') {
            text = msg.image?.caption || 'Customer sent an image';
            attachmentUrl = msg.image?.link || msg.image?.id;
          }

          if (!text && !attachmentUrl) continue;

          const conversationId = `whatsapp_${senderId}`;
          const convRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
          const convSnap = await convRef.get();

          const newMsg = {
            sender: 'customer',
            text: text || '',
            attachmentUrl: attachmentUrl || null,
            mid: msgId || null,
            status: 'delivered',
            timestamp: new Date().toISOString(),
          };

          await convRef.collection('messages').add(newMsg);
          const currentUnread = convSnap.exists ? (convSnap.data()?.unreadCount || 0) : 0;
          await convRef.set({
            senderId,
            externalCustomerId: senderId,
            senderName,
            channel: 'whatsapp',
            lastMessage: text || '[Photo]',
            lastMessageSender: 'customer',
            lastUpdated: new Date().toISOString(),
            unreadCount: currentUnread + 1,
          }, { merge: true });

          broadcastSseEvent(userId, 'new_message', { conversationId, message: newMsg });
        }
      }
    }
  }
}
