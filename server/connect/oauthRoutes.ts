// server/connect/oauthRoutes.ts
// -----------------------------------------------------------------------
// Meta Channels OAuth & Verification Routes (Facebook, Instagram & WhatsApp)
// -----------------------------------------------------------------------

import crypto from 'crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../authMiddleware';
import { loadMetaConfig, saveMetaConfig } from '../../metaIntegrationService';
import { db, isFirestoreQuotaExceeded, markFirestoreQuotaExceeded, isQuotaExceededError } from '../../firebaseAdmin';

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const DEFAULT_APP_URL = process.env.APP_URL || 'https://vistoosa2.onrender.com';

function getAppUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return DEFAULT_APP_URL;
}

// Check if user has Owner / Admin rights
function isOwner(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  const role = req.user.role as string;
  return role === 'Owner' || role === 'Admin' || role === 'Super Admin';
}

function requireOwnerRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!isOwner(req)) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted. Only the Owner account has permission to connect or disconnect Meta channels.',
    });
  }
  next();
}

// Cryptographic state signing for CSRF & OAuth security
function signOAuthState(userId: string, appSecret: string): string {
  const payload = {
    csrf: crypto.randomBytes(16).toString('hex'),
    userId,
    exp: Date.now() + 15 * 60 * 1000, // 15 mins expiry
  };
  const jsonStr = JSON.stringify(payload);
  const b64 = Buffer.from(jsonStr).toString('base64url');
  const secretKey = process.env.TOKEN_ENCRYPTION_KEY || appSecret || 'vistoosa_oauth_state_secret_2026';
  const hmac = crypto.createHmac('sha256', secretKey).update(b64).digest('base64url');
  return `${b64}.${hmac}`;
}

function verifyOAuthState(stateStr: string, appSecret: string): { valid: boolean; userId?: string; error?: string } {
  try {
    if (!stateStr || !stateStr.includes('.')) {
      return { valid: false, error: 'Invalid state format' };
    }
    const [b64, signature] = stateStr.split('.');
    const secretKey = process.env.TOKEN_ENCRYPTION_KEY || appSecret || 'vistoosa_oauth_state_secret_2026';
    const expected = crypto.createHmac('sha256', secretKey).update(b64).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { valid: false, error: 'State signature mismatch' };
    }

    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false, error: 'OAuth state has expired. Please try connecting again.' };
    }

    return { valid: true, userId: payload.userId };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid state payload' };
  }
}

// In-memory cache for metaConnections to prevent excessive Firestore reads
const metaConnectionMemoryCache = new Map<string, any>();

async function getStoredConnection(userId: string): Promise<any | null> {
  if (metaConnectionMemoryCache.has(userId)) {
    return metaConnectionMemoryCache.get(userId);
  }
  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await db.collection('metaConnections').doc(userId).get();
      if (snap.exists) {
        const data = snap.data();
        metaConnectionMemoryCache.set(userId, data);
        return data;
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
    }
  }
  return null;
}

async function setStoredConnection(userId: string, data: any): Promise<void> {
  const existing = metaConnectionMemoryCache.get(userId) || {};
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  metaConnectionMemoryCache.set(userId, merged);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection('metaConnections').doc(userId).set(merged, { merge: true });
    } catch (err: any) {
      if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
    }
  }
}

async function removeStoredConnectionFields(userId: string, fieldsToRemove: string[]): Promise<void> {
  const existing = metaConnectionMemoryCache.get(userId) || {};
  for (const f of fieldsToRemove) {
    delete existing[f];
  }
  metaConnectionMemoryCache.set(userId, existing);

  if (!isFirestoreQuotaExceeded()) {
    try {
      const updates: any = {};
      for (const f of fieldsToRemove) {
        updates[f] = null;
      }
      await db.collection('metaConnections').doc(userId).set(updates, { merge: true });
    } catch (err: any) {
      if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
    }
  }
}

export function mountConnectRoutes(app: Express) {
  // ---------------------------------------------------------------------
  // 1. GET /api/connect/status -> Overview of connected channels
  // ---------------------------------------------------------------------
  app.get('/api/connect/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();
      const userId = req.userId || 'usr_admin_default';
      const stored = await getStoredConnection(userId);

      const hasAppId = Boolean(config.metaAppId && config.metaAppId.trim() !== '');
      const hasAppSecret = Boolean(config.metaAppSecret && config.metaAppSecret.trim() !== '');

      const isFbConnected = Boolean(config.pageId && config.pageAccessToken);
      const isIgConnected = Boolean(config.instagramBusinessAccountId);
      const isWaConnected = Boolean(config.whatsappPhoneNumberId && config.whatsappAccessToken);

      return res.json({
        success: true,
        appConfigured: hasAppId && hasAppSecret,
        metaAppId: config.metaAppId || '',
        facebook: {
          connected: isFbConnected,
          pageId: config.pageId || '',
          pageName: stored?.pageName || (config.pageId ? `Page (${config.pageId})` : ''),
          connectedAt: stored?.connectedAt || null,
        },
        instagram: {
          connected: isIgConnected,
          instagramBusinessAccountId: config.instagramBusinessAccountId || '',
          username: stored?.igUsername || '',
        },
        whatsapp: {
          connected: isWaConnected,
          phoneNumberId: config.whatsappPhoneNumberId || '',
          wabaId: config.whatsappBusinessAccountId || '',
          verifiedName: stored?.waVerifiedName || (config.whatsappPhoneNumberId ? 'WhatsApp Cloud API' : ''),
        },
        isOwner: isOwner(req),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to load connection status' });
    }
  });

  // ---------------------------------------------------------------------
  // 2. GET /api/auth/facebook/start -> Builds OAuth Login URL with signed state
  // ---------------------------------------------------------------------
  app.get('/api/auth/facebook/start', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();

      if (!config.metaAppId || !config.metaAppSecret) {
        return res.status(400).json({
          success: false,
          message: 'Set App ID and App Secret in Settings > Connect Channels first.',
        });
      }

      const appUrl = getAppUrl(req);
      const redirectUri = `${appUrl}/api/auth/facebook/callback`;
      const signedState = signOAuthState(req.userId || 'usr_admin_default', config.metaAppSecret);

      const scopes = [
        'pages_show_list',
        'pages_messaging',
        'pages_manage_metadata',
        'pages_read_engagement',
        'instagram_basic',
        'instagram_manage_messages',
      ].join(',');

      const oauthUrl = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?client_id=${encodeURIComponent(
        config.metaAppId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(
        signedState
      )}&scope=${encodeURIComponent(scopes)}&response_type=code`;

      // If user hit directly in popup window
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect(oauthUrl);
      }

      return res.json({
        success: true,
        url: oauthUrl,
        redirectUri,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to start Facebook OAuth flow',
      });
    }
  });

  // ---------------------------------------------------------------------
  // 3. GET /api/auth/facebook/callback -> OAuth Redirect Callback Handler
  // ---------------------------------------------------------------------
  app.get('/api/auth/facebook/callback', async (req: Request, res: Response) => {
    const { code, state, error, error_description, error_reason } = req.query as Record<string, string>;
    const config = await loadMetaConfig();
    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;

    // Render helper for popup response
    const renderPopupHtml = (title: string, content: string) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f0f14; color: #f4f4f5; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          h2 { margin-top: 0; color: #fbbf24; font-size: 20px; display: flex; align-items: center; gap: 8px; }
          p { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
          .error-box { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 12px; border-radius: 12px; font-size: 12px; margin-bottom: 16px; word-break: break-word; }
          .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: bold; cursor: pointer; border: none; text-decoration: none; transition: 0.2s; box-sizing: border-box; }
          .btn-primary { background: #10b981; color: #09090b; }
          .btn-primary:hover { background: #34d399; }
          .btn-close { background: #27272a; color: #d4d4d8; margin-top: 10px; }
          .btn-close:hover { background: #3f3f46; }
          .page-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #27272a; border: 1px solid #3f3f46; border-radius: 12px; margin-bottom: 8px; }
          .page-info { display: flex; flex-direction: column; gap: 2px; text-align: left; }
          .page-name { font-weight: bold; color: #fff; font-size: 13px; }
          .page-meta { font-size: 11px; color: #9ca3af; }
          .btn-select { padding: 6px 14px; border-radius: 8px; background: #3b82f6; color: #fff; border: none; font-size: 12px; font-weight: bold; cursor: pointer; }
          .btn-select:hover { background: #60a5fa; }
        </style>
      </head>
      <body>
        <div class="card">
          ${content}
        </div>
      </body>
      </html>
    `;

    // 1. Check for Meta-side OAuth cancel or error
    if (error || error_description || error_reason) {
      const msg = error_description || error_reason || error || 'Facebook authentication was cancelled.';
      return res.send(
        renderPopupHtml(
          'Connection Cancelled',
          `<h2>⚠️ Connection Cancelled</h2>
           <div class="error-box">${msg}</div>
           <p>You can close this window and try connecting again from the Vistoosa dashboard.</p>
           <button class="btn btn-close" onclick="window.close()">Close Window</button>
           <script>
             if (window.opener) {
               window.opener.postMessage({ type: 'FB_OAUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
             }
           </script>`
        )
      );
    }

    // 2. Validate signed state
    const stateCheck = verifyOAuthState(state, config.metaAppSecret);
    if (!stateCheck.valid) {
      return res.status(400).send(
        renderPopupHtml(
          'Invalid State',
          `<h2>⚠️ Security Check Failed</h2>
           <div class="error-box">${stateCheck.error || 'Invalid or expired OAuth state.'}</div>
           <p>The login session expired or was altered. Please restart the connection process.</p>
           <button class="btn btn-close" onclick="window.close()">Close Window</button>`
        )
      );
    }

    const userId = stateCheck.userId || 'usr_admin_default';

    if (!code) {
      return res.status(400).send(
        renderPopupHtml(
          'Missing Code',
          `<h2>⚠️ Authorization Code Missing</h2>
           <div class="error-box">No authorization code was returned by Meta.</div>
           <button class="btn btn-close" onclick="window.close()">Close Window</button>`
        )
      );
    }

    try {
      // 3. Exchange code for Short-Lived User Access Token
      const tokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(
        config.metaAppId
      )}&client_secret=${encodeURIComponent(config.metaAppSecret)}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code=${encodeURIComponent(code)}`;

      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        const errorMsg = tokenData.error?.message || 'Failed to exchange authorization code for user token.';
        return res.status(400).send(
          renderPopupHtml(
            'Token Exchange Failed',
            `<h2>⚠️ Meta Error</h2>
             <div class="error-box">${errorMsg}</div>
             <p>Check that your Meta App Secret is correct and the OAuth Redirect URI matches in Meta Developers.</p>
             <button class="btn btn-close" onclick="window.close()">Close Window</button>`
          )
        );
      }

      const shortLivedUserToken = tokenData.access_token;

      // 4. Exchange for Long-Lived User Access Token (60-day validity)
      const longTokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        config.metaAppId
      )}&client_secret=${encodeURIComponent(config.metaAppSecret)}&fb_exchange_token=${encodeURIComponent(
        shortLivedUserToken
      )}`;

      const longTokenRes = await fetch(longTokenUrl);
      const longTokenData = await longTokenRes.json();
      const userAccessToken = (longTokenRes.ok && longTokenData.access_token) ? longTokenData.access_token : shortLivedUserToken;

      // 5. Query /me/accounts with field expansions for Pages & Instagram Business Accounts
      const accountsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,category,instagram_business_account{id,username}&access_token=${encodeURIComponent(
        userAccessToken
      )}`;

      const accountsRes = await fetch(accountsUrl);
      const accountsData = await accountsRes.json();

      if (!accountsRes.ok || !Array.isArray(accountsData.data) || accountsData.data.length === 0) {
        const noPageMsg = accountsData.error?.message || 'No Facebook Pages found for this account. Ensure you are an Admin of at least one Facebook Page and granted permissions.';
        return res.send(
          renderPopupHtml(
            'No Pages Found',
            `<h2>⚠️ No Pages Found</h2>
             <div class="error-box">${noPageMsg}</div>
             <p>Make sure you select your Facebook Page when logging into Meta.</p>
             <button class="btn btn-close" onclick="window.close()">Close Window</button>
             <script>
               if (window.opener) {
                 window.opener.postMessage({ type: 'FB_OAUTH_ERROR', error: ${JSON.stringify(noPageMsg)} }, '*');
               }
             </script>`
          )
        );
      }

      const pages = accountsData.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
        igBusinessAccountId: p.instagram_business_account?.id || null,
        igUsername: p.instagram_business_account?.username || null,
      }));

      // Render Page Selection UI in the popup
      const pagesListHtml = pages
        .map(
          (p: any) => `
        <div class="page-item">
          <div class="page-info">
            <span class="page-name">${p.name}</span>
            <span class="page-meta">ID: ${p.id} ${p.igUsername ? `• Instagram: @${p.igUsername}` : ''}</span>
          </div>
          <button class="btn-select" onclick="selectPage('${p.id}')">Connect</button>
        </div>
      `
        )
        .join('');

      return res.send(
        renderPopupHtml(
          'Select Page',
          `<h2>✨ Choose Your Facebook Page</h2>
           <p>Select the Page you want to connect to Vistoosa for automated Messenger & Instagram order processing:</p>
           <div id="pages-container">${pagesListHtml}</div>
           <div id="status-box" style="display:none;" class="error-box"></div>
           <script>
             const pages = ${JSON.stringify(pages)};
             const userId = ${JSON.stringify(userId)};

             // Notify opener window as well
             if (window.opener) {
               window.opener.postMessage({ type: 'FB_PAGES_LIST', pages }, '*');
             }

             async function selectPage(pageId) {
               const p = pages.find(item => item.id === pageId);
               if (!p) return;

               const statusBox = document.getElementById('status-box');
               statusBox.style.display = 'block';
               statusBox.style.background = 'rgba(59, 130, 246, 0.1)';
               statusBox.style.borderColor = 'rgba(59, 130, 246, 0.3)';
               statusBox.style.color = '#93c5fd';
               statusBox.innerText = 'Connecting Page and subscribing webhooks...';

               try {
                 const res = await fetch('/api/connect/facebook/select-internal', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     pageId: p.id,
                     pageName: p.name,
                     pageAccessToken: p.accessToken,
                     igBusinessAccountId: p.igBusinessAccountId,
                     igUsername: p.igUsername,
                     userId: userId
                   })
                 });
                 const data = await res.json();
                 if (data.success) {
                   statusBox.style.background = 'rgba(16, 185, 129, 0.1)';
                   statusBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                   statusBox.style.color = '#6ee7b7';
                   statusBox.innerText = 'Connected successfully! Closing window...';

                   if (window.opener) {
                     window.opener.postMessage({
                       type: 'FB_OAUTH_SUCCESS',
                       pageId: p.id,
                       pageName: p.name,
                       igBusinessAccountId: p.igBusinessAccountId,
                       igUsername: p.igUsername
                     }, '*');
                   }
                   setTimeout(() => window.close(), 1200);
                 } else {
                   statusBox.style.background = 'rgba(239, 68, 68, 0.1)';
                   statusBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                   statusBox.style.color = '#fca5a5';
                   statusBox.innerText = data.message || 'Failed to connect page.';
                 }
               } catch (err) {
                 statusBox.style.background = 'rgba(239, 68, 68, 0.1)';
                 statusBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                 statusBox.style.color = '#fca5a5';
                 statusBox.innerText = 'Network error while connecting page.';
               }
             }
           </script>`
        )
      );
    } catch (err: any) {
      return res.status(500).send(
        renderPopupHtml(
          'Internal Error',
          `<h2>⚠️ Server Error</h2>
           <div class="error-box">${err?.message || 'An unexpected error occurred during OAuth processing.'}</div>
           <button class="btn btn-close" onclick="window.close()">Close Window</button>`
        )
      );
    }
  });

  // ---------------------------------------------------------------------
  // 4. Internal & Authenticated Page Selection Handler
  // ---------------------------------------------------------------------
  async function executePageSelection(
    pageId: string,
    pageName: string,
    pageAccessToken: string,
    igBusinessAccountId: string | null,
    igUsername: string | null,
    userId: string
  ): Promise<{ success: boolean; message: string; subscribed?: boolean }> {
    if (!pageId || !pageAccessToken) {
      return { success: false, message: 'Page ID and Page Access Token are required.' };
    }

    // 1. Subscribe Page to Webhook Subscribed Apps
    let subscribed = false;
    let subscribeError: string | null = null;
    try {
      const subUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
        pageId
      )}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,message_deliveries,message_reads&access_token=${encodeURIComponent(
        pageAccessToken
      )}`;

      const subRes = await fetch(subUrl, { method: 'POST' });
      const subData = await subRes.json();
      if (subRes.ok && (subData.success === true || subData.result === 'success')) {
        subscribed = true;
      } else {
        subscribeError = subData.error?.message || 'Meta subscribed_apps call failed';
        console.warn(`[Meta Webhook Subscription Warning]:`, subData);
      }
    } catch (subErr: any) {
      subscribeError = subErr?.message || 'Subscription request failed';
      console.warn(`[Meta Webhook Subscription Error]:`, subErr);
    }

    // 2. Save via existing saveMetaConfig
    await saveMetaConfig({
      pageId: String(pageId).trim(),
      pageAccessToken: String(pageAccessToken).trim(),
      ...(igBusinessAccountId ? { instagramBusinessAccountId: String(igBusinessAccountId).trim() } : {}),
    });

    // 3. Record in metaConnections collection (never store raw token in client-facing metaConnections)
    await setStoredConnection(userId, {
      pageId: String(pageId).trim(),
      pageName: pageName || `Page ${pageId}`,
      igBusinessAccountId: igBusinessAccountId || null,
      igUsername: igUsername || null,
      connectedAt: new Date().toISOString(),
      webhookSubscribed: subscribed,
    });

    return {
      success: true,
      subscribed,
      message: subscribed
        ? `Page "${pageName}" connected and subscribed to live webhooks!`
        : `Page "${pageName}" connected. Note: Webhook subscription returned: ${subscribeError || 'verify permissions'}.`,
    };
  }

  // Internal endpoint called by OAuth popup script
  app.post('/api/connect/facebook/select-internal', async (req: Request, res: Response) => {
    try {
      const { pageId, pageName, pageAccessToken, igBusinessAccountId, igUsername, userId } = req.body || {};
      const result = await executePageSelection(
        pageId,
        pageName,
        pageAccessToken,
        igBusinessAccountId,
        igUsername,
        userId || 'usr_admin_default'
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to select page' });
    }
  });

  // Authenticated endpoint called by UI when selecting from client list
  app.post('/api/connect/facebook/select', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pageId, pageName, pageAccessToken, igBusinessAccountId, igUsername } = req.body || {};
      const result = await executePageSelection(
        pageId,
        pageName,
        pageAccessToken,
        igBusinessAccountId,
        igUsername,
        req.userId || 'usr_admin_default'
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to select page' });
    }
  });

  // ---------------------------------------------------------------------
  // 5. POST /api/connect/facebook/disconnect -> Disconnect Page & Webhook
  // ---------------------------------------------------------------------
  app.post('/api/connect/facebook/disconnect', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();
      const pageId = config.pageId;
      const pageToken = config.pageAccessToken;

      // Unsubscribe from Meta Webhook if credentials exist
      if (pageId && pageToken) {
        try {
          const unsubUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
            pageId
          )}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`;
          await fetch(unsubUrl, { method: 'DELETE' });
        } catch (e) {
          console.warn('[Meta Disconnect Unsubscribe Warning]:', e);
        }
      }

      // Clear from saved config using existing saveMetaConfig
      await saveMetaConfig({
        pageId: '',
        pageAccessToken: '',
        instagramBusinessAccountId: '',
      });

      // Clear from metaConnections
      const userId = req.userId || 'usr_admin_default';
      await removeStoredConnectionFields(userId, ['pageId', 'pageName', 'connectedAt', 'webhookSubscribed', 'igBusinessAccountId', 'igUsername']);

      return res.json({
        success: true,
        message: 'Facebook Page and Instagram disconnected successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to disconnect Facebook Page',
      });
    }
  });

  // ---------------------------------------------------------------------
  // 6. POST /api/connect/instagram/select & disconnect
  // ---------------------------------------------------------------------
  app.post('/api/connect/instagram/select', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { instagramBusinessAccountId, igUsername } = req.body || {};
      if (!instagramBusinessAccountId) {
        return res.status(400).json({ success: false, message: 'Instagram Business Account ID is required.' });
      }

      await saveMetaConfig({
        instagramBusinessAccountId: String(instagramBusinessAccountId).trim(),
      });

      const userId = req.userId || 'usr_admin_default';
      await setStoredConnection(userId, {
        igBusinessAccountId: String(instagramBusinessAccountId).trim(),
        igUsername: igUsername || null,
      });

      return res.json({
        success: true,
        message: `Instagram Professional Account ${igUsername ? `@${igUsername} ` : ''}connected successfully!`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save Instagram account' });
    }
  });

  app.post('/api/connect/instagram/disconnect', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await saveMetaConfig({ instagramBusinessAccountId: '' });
      const userId = req.userId || 'usr_admin_default';
      await removeStoredConnectionFields(userId, ['igBusinessAccountId', 'igUsername']);

      return res.json({
        success: true,
        message: 'Instagram Professional Account disconnected successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to disconnect Instagram' });
    }
  });

  // ---------------------------------------------------------------------
  // WhatsApp Embedded Signup & Cloud API Management Routes
  // ---------------------------------------------------------------------

  function formatMetaError(metaErr: any): string {
    if (!metaErr) return 'Unknown error from Meta Graph API';
    const code = metaErr.code;
    const subcode = metaErr.error_subcode;
    const rawMsg = metaErr.message || '';

    let mapped = '';
    if (code === 100 && (subcode === 33 || rawMsg.includes('code') || rawMsg.includes('expired') || rawMsg.includes('already used'))) {
      mapped = 'Login code expired or already used, please try again (মেটা লগইন কোডের মেয়াদ শেষ বা ব্যবহার হয়ে গেছে, আবার চেষ্টা করুন)';
    } else if (rawMsg.includes('authorization code has expired') || rawMsg.includes('already been used')) {
      mapped = 'Login code expired or already used, please try again (মেটা লগইন কোডের মেয়াদ শেষ বা ব্যবহার হয়ে গেছে, আবার চেষ্টা করুন)';
    } else if (code === 190) {
      mapped = 'Access token invalid or expired (অ্যাক্সেস টোকেন অবৈধ বা মেয়াদোত্তীর্ণ)';
    } else if (code === 133005) {
      mapped = 'Two-step verification PIN mismatch (টু-স্টেপ ভেরিফিকেশন পিন মেলেনি)';
    } else if (code === 133006) {
      mapped = 'Phone number needs verification before Cloud API registration (নম্বর ভেরিফিকেশন সম্পন্ন করা প্রয়োজন)';
    } else if (code === 133010) {
      mapped = 'Phone number not registered on WhatsApp Cloud API (নম্বরটি ক্লাউড এপিআইতে নিবন্ধিত নয়)';
    } else if (code && code >= 131000 && code <= 131999) {
      mapped = 'WhatsApp messaging restrictions or payment method required in Meta Business Manager (মেসেজিং সীমাবদ্ধতা বা পেমেন্ট মেথড যোগ করতে হবে)';
    } else if (code === 4 || code === 17 || code === 613 || rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('too many')) {
      mapped = 'Too many registration attempts. Please wait before retrying (অতিরিক্ত চেষ্টার কারণে সাময়িক ব্লক, অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন)';
    } else if (code === 100) {
      mapped = `Invalid parameter sent to Meta Graph API (${rawMsg}) (মেটা এপিআই প্যারামিটার ত্রুটি)`;
    } else {
      mapped = rawMsg || 'Meta Graph API returned an error';
    }

    const codeTag = code ? ` [Meta Code: ${code}${subcode ? ` / Subcode: ${subcode}` : ''}]` : '';
    return `${mapped}${codeTag}`;
  }

  // 1. GET /api/whatsapp/embedded-signup/config -> Client Config for Embedded Signup
  app.get('/api/whatsapp/embedded-signup/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();
      const appId = config.metaAppId || process.env.META_APP_ID || '';
      const configId = config.whatsappEmbeddedConfigId || process.env.WHATSAPP_EMBEDDED_CONFIG_ID || '';
      const graphVersion = process.env.GRAPH_API_VERSION || GRAPH_API_VERSION || 'v21.0';

      return res.json({
        success: true,
        appId,
        configId,
        graphVersion,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to retrieve WhatsApp Embedded Signup configuration',
      });
    }
  });

  // 2. POST /api/whatsapp/embedded-signup/complete -> Exchange Code, Register & Subscribe
  app.post('/api/whatsapp/embedded-signup/complete', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    const steps: { name: string; ok: boolean; error?: string; detail?: string }[] = [];

    try {
      const { code, phoneNumberId, wabaId } = req.body || {};

      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is missing or invalid.',
        });
      }

      const cleanPhoneId = String(phoneNumberId || '').trim();
      const cleanWabaId = String(wabaId || '').trim();

      if (!cleanPhoneId || !/^\d+$/.test(cleanPhoneId)) {
        return res.status(400).json({
          success: false,
          message: 'Phone Number ID is missing or must contain digits only.',
        });
      }

      if (!cleanWabaId || !/^\d+$/.test(cleanWabaId)) {
        return res.status(400).json({
          success: false,
          message: 'WABA ID is missing or must contain digits only.',
        });
      }

      const config = await loadMetaConfig();
      const appId = config.metaAppId || process.env.META_APP_ID || '';
      const appSecret = config.metaAppSecret || process.env.META_APP_SECRET || '';

      if (!appId || !appSecret) {
        return res.status(400).json({
          success: false,
          message: 'Meta App ID and App Secret must be configured in Settings > Connect Channels first.',
        });
      }

      // Step A: Token exchange
      let businessAccessToken = '';
      try {
        const tokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(
          appId
        )}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code.trim())}`;

        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
          const errDetail = formatMetaError(tokenData.error);
          steps.push({ name: 'Getting token', ok: false, error: errDetail });
          return res.status(400).json({
            success: false,
            message: `Failed to acquire WhatsApp access token: ${errDetail}`,
            steps,
          });
        }

        businessAccessToken = tokenData.access_token;
        steps.push({ name: 'Getting token', ok: true, detail: 'Acquired business token from Meta' });
      } catch (err: any) {
        steps.push({ name: 'Getting token', ok: false, error: err?.message || 'Network error fetching token' });
        return res.status(500).json({ success: false, message: 'Network error getting token', steps });
      }

      // Step B: Token info & scopes
      let tokenExpiresAt: string | null = null;
      try {
        const debugUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?input_token=${encodeURIComponent(
          businessAccessToken
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;

        const debugRes = await fetch(debugUrl);
        const debugData = await debugRes.json();

        if (debugRes.ok && debugData.data) {
          const info = debugData.data;
          const scopes: string[] = info.scopes || [];
          if (!scopes.includes('whatsapp_business_messaging') && !scopes.includes('whatsapp_business_management')) {
            console.warn('[WhatsApp Embedded Signup]: whatsapp_business_messaging scope might be missing in token');
          }
          if (info.expires_at && info.expires_at > 0) {
            tokenExpiresAt = new Date(info.expires_at * 1000).toISOString();
          }
          steps.push({ name: 'Checking token info', ok: true, detail: tokenExpiresAt ? `Expires at ${tokenExpiresAt}` : 'Never-expiring token' });
        } else {
          steps.push({ name: 'Checking token info', ok: true, detail: 'Token verified' });
        }
      } catch {
        steps.push({ name: 'Checking token info', ok: true, detail: 'Proceeded without debug_token' });
      }

      // Step C: Number info
      let verifiedName = 'WhatsApp Cloud API';
      let displayNumber = '';
      let qualityRating = 'UNKNOWN';
      try {
        let numberUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
          cleanPhoneId
        )}?fields=verified_name,display_phone_number,quality_rating,platform_type&access_token=${encodeURIComponent(
          businessAccessToken
        )}`;

        let numRes = await fetch(numberUrl);
        let numData = await numRes.json();

        if (!numRes.ok || numData.error) {
          // Retry with fewer fields if platform_type is rejected
          numberUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
            cleanPhoneId
          )}?fields=verified_name,display_phone_number,quality_rating&access_token=${encodeURIComponent(
            businessAccessToken
          )}`;
          numRes = await fetch(numberUrl);
          numData = await numRes.json();
        }

        if (numRes.ok && !numData.error) {
          verifiedName = numData.verified_name || numData.display_phone_number || verifiedName;
          displayNumber = numData.display_phone_number || '';
          qualityRating = numData.quality_rating || qualityRating;
          steps.push({ name: 'Checking number', ok: true, detail: `Verified: ${verifiedName} (${displayNumber || cleanPhoneId})` });
        } else {
          const errDetail = formatMetaError(numData.error);
          steps.push({ name: 'Checking number', ok: false, error: errDetail });
          return res.status(400).json({
            success: false,
            message: `Could not retrieve phone number details from Meta: ${errDetail}`,
            steps,
          });
        }
      } catch (err: any) {
        steps.push({ name: 'Checking number', ok: false, error: err?.message || 'Network error fetching number info' });
        return res.status(500).json({ success: false, message: 'Network error checking phone number', steps });
      }

      // Step D: Register number on Cloud API
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      try {
        const regUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(cleanPhoneId)}/register`;
        const regRes = await fetch(regUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${businessAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin,
          }),
        });
        const regData = await regRes.json();

        if (regRes.ok && (regData.success || regData.id)) {
          steps.push({ name: 'Registering number', ok: true, detail: 'Number registered on WhatsApp Cloud API' });
        } else {
          const errMsg = regData.error?.message || '';
          const errCode = regData.error?.code;
          // If already registered, mark step ok
          if (errCode === 133015 || errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('is already registered')) {
            steps.push({ name: 'Registering number', ok: true, detail: 'Number is already registered on Cloud API' });
          } else {
            const errDetail = formatMetaError(regData.error);
            steps.push({ name: 'Registering number', ok: false, error: errDetail });
            return res.status(400).json({
              success: false,
              message: `Registration failed on Meta: ${errDetail}`,
              steps,
            });
          }
        }
      } catch (err: any) {
        steps.push({ name: 'Registering number', ok: false, error: err?.message || 'Network error registering number' });
        return res.status(500).json({ success: false, message: 'Network error registering number', steps });
      }

      // Step E: Subscribe webhook on WABA
      try {
        const subUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(cleanWabaId)}/subscribed_apps`;
        const subRes = await fetch(subUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${businessAccessToken}`,
          },
        });
        const subData = await subRes.json();

        if (subRes.ok && (subData.success || subData.id)) {
          steps.push({ name: 'Subscribing webhook', ok: true, detail: 'WABA subscribed to app webhooks' });
        } else {
          const errDetail = formatMetaError(subData.error);
          steps.push({ name: 'Subscribing webhook', ok: false, error: errDetail });
        }
      } catch (err: any) {
        steps.push({ name: 'Subscribing webhook', ok: false, error: err?.message || 'Network error subscribing app' });
      }

      // Step F: Save configuration permanently via existing saveMetaConfig
      const savedConfig = await saveMetaConfig({
        whatsappPhoneNumberId: cleanPhoneId,
        whatsappBusinessAccountId: cleanWabaId,
        whatsappAccessToken: businessAccessToken,
        whatsappRegistrationPin: pin,
        whatsappVerifiedName: verifiedName,
        whatsappDisplayNumber: displayNumber,
        whatsappConnectedAt: new Date().toISOString(),
        whatsappTokenExpiresAt: tokenExpiresAt,
      });

      const isPersisted = savedConfig.persisted !== false;
      steps.push({
        name: 'Saving',
        ok: true,
        detail: isPersisted ? 'Configuration saved permanently to Firestore' : 'Saved in memory (Database quota limit warning)',
      });

      // Update metaConnections for active user
      const userId = req.userId || 'usr_admin_default';
      await setStoredConnection(userId, {
        waVerifiedName: verifiedName,
        waDisplayPhone: displayNumber || null,
        waQualityRating: qualityRating || null,
      });

      return res.json({
        success: true,
        persisted: isPersisted,
        steps,
        summary: {
          verifiedName,
          displayNumber,
          qualityRating,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Unexpected server error during WhatsApp Embedded Signup completion',
        steps,
      });
    }
  });

  // 3. GET /api/whatsapp/status -> Read Saved Config & Query Graph for Real-Time Status
  app.get('/api/whatsapp/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();
      if (!config.whatsappPhoneNumberId || !config.whatsappAccessToken) {
        return res.json({
          connected: false,
          verifiedName: '',
          displayNumber: '',
          qualityRating: null,
          webhookSubscribed: false,
          tokenExpiresAt: null,
        });
      }

      let verifiedName = config.whatsappVerifiedName || '';
      let displayNumber = config.whatsappDisplayNumber || '';
      let qualityRating: string | null = null;
      let webhookSubscribed = false;

      // Query phone number details from Meta Graph
      try {
        const numUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
          config.whatsappPhoneNumberId
        )}?fields=verified_name,display_phone_number,quality_rating&access_token=${encodeURIComponent(
          config.whatsappAccessToken
        )}`;
        const numRes = await fetch(numUrl);
        const numData = await numRes.json();
        if (numRes.ok && !numData.error) {
          verifiedName = numData.verified_name || verifiedName;
          displayNumber = numData.display_phone_number || displayNumber;
          qualityRating = numData.quality_rating || null;
        }
      } catch (err) {
        console.warn('[WhatsApp Status]: Could not query phone number from Meta Graph', err);
      }

      // Query subscribed apps on WABA if WABA ID is configured
      if (config.whatsappBusinessAccountId) {
        try {
          const subUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
            config.whatsappBusinessAccountId
          )}/subscribed_apps?access_token=${encodeURIComponent(config.whatsappAccessToken)}`;
          const subRes = await fetch(subUrl);
          const subData = await subRes.json();
          if (subRes.ok && Array.isArray(subData.data)) {
            webhookSubscribed = subData.data.length > 0;
          }
        } catch (err) {
          console.warn('[WhatsApp Status]: Could not query subscribed_apps', err);
        }
      }

      return res.json({
        connected: true,
        verifiedName: verifiedName || 'WhatsApp Cloud API',
        displayNumber,
        qualityRating,
        webhookSubscribed,
        tokenExpiresAt: config.whatsappTokenExpiresAt || null,
        phoneNumberId: config.whatsappPhoneNumberId,
        wabaId: config.whatsappBusinessAccountId || '',
      });
    } catch (err: any) {
      return res.status(500).json({
        connected: false,
        message: err?.message || 'Failed to check WhatsApp status',
      });
    }
  });

  // 4. POST /api/whatsapp/disconnect -> Disconnect WABA App & Clear Stored Credentials
  const handleWhatsappDisconnect = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await loadMetaConfig();

      // Unsubscribe app from WABA if available
      if (config.whatsappBusinessAccountId && config.whatsappAccessToken) {
        try {
          const unsubUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
            config.whatsappBusinessAccountId
          )}/subscribed_apps`;
          await fetch(unsubUrl, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${config.whatsappAccessToken}`,
            },
          });
        } catch (err) {
          console.warn('[WhatsApp Disconnect]: Error unsubscribing app from WABA:', err);
        }
      }

      // Clear WhatsApp fields while preserving App ID, App Secret, Verify Token, and Embedded Config ID
      const updated = await saveMetaConfig({
        whatsappPhoneNumberId: '',
        whatsappBusinessAccountId: '',
        whatsappAccessToken: '',
        whatsappRegistrationPin: '',
        whatsappVerifiedName: '',
        whatsappDisplayNumber: '',
        whatsappConnectedAt: '',
        whatsappTokenExpiresAt: null,
      });

      const userId = req.userId || 'usr_admin_default';
      await removeStoredConnectionFields(userId, ['waVerifiedName', 'waDisplayPhone', 'waQualityRating']);

      return res.json({
        success: true,
        persisted: updated.persisted !== false,
        message: 'WhatsApp Cloud API disconnected successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to disconnect WhatsApp',
      });
    }
  };

  app.post('/api/whatsapp/disconnect', requireAuth, requireOwnerRole, handleWhatsappDisconnect);
  app.post('/api/connect/whatsapp/disconnect', requireAuth, requireOwnerRole, handleWhatsappDisconnect);

  // 5. POST /api/connect/whatsapp/verify-and-save -> Manual Verification Form Handler (Preserved)
  app.post('/api/connect/whatsapp/verify-and-save', requireAuth, requireOwnerRole, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { whatsappPhoneNumberId, whatsappBusinessAccountId, whatsappAccessToken } = req.body || {};

      if (!whatsappPhoneNumberId || !whatsappAccessToken) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp Phone Number ID and Permanent Access Token are required.',
        });
      }

      // Verify token and phone number against Graph API
      const verifyUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
        String(whatsappPhoneNumberId).trim()
      )}?fields=verified_name,display_phone_number,code_verification_status,quality_rating&access_token=${encodeURIComponent(
        String(whatsappAccessToken).trim()
      )}`;

      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (!response.ok || data.error) {
        const errorMsg = formatMetaError(data.error);
        return res.status(400).json({
          success: false,
          message: `Meta WhatsApp API Error: ${errorMsg}`,
          metaError: data.error,
        });
      }

      const verifiedName = data.verified_name || data.display_phone_number || 'Verified WhatsApp';

      // Save via existing saveMetaConfig
      const saved = await saveMetaConfig({
        whatsappPhoneNumberId: String(whatsappPhoneNumberId).trim(),
        whatsappBusinessAccountId: whatsappBusinessAccountId ? String(whatsappBusinessAccountId).trim() : '',
        whatsappAccessToken: String(whatsappAccessToken).trim(),
        whatsappVerifiedName: verifiedName,
        whatsappDisplayNumber: data.display_phone_number || '',
        whatsappConnectedAt: new Date().toISOString(),
      });

      // Record in metaConnections
      const userId = req.userId || 'usr_admin_default';
      await setStoredConnection(userId, {
        waVerifiedName: verifiedName,
        waDisplayPhone: data.display_phone_number || null,
        waQualityRating: data.quality_rating || null,
      });

      return res.json({
        success: true,
        persisted: saved.persisted !== false,
        message: `WhatsApp Cloud API verified! Connected as "${verifiedName}".`,
        verifiedName,
        displayPhoneNumber: data.display_phone_number,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to verify WhatsApp Cloud API credentials',
      });
    }
  });
}
