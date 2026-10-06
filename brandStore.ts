import type { Express, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from './firebaseAdmin';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const BRAND_COLLECTION = 'brandAssets';

interface BrandMeta {
  version: number;
  hasCustomLogo: boolean;
  hasDarkLogo: boolean;
}

// In-memory cache for server efficiency
let localMetaCache: BrandMeta = {
  version: Date.now(),
  hasCustomLogo: false,
  hasDarkLogo: false,
};

const imageBufferCache = new Map<string, { buffer: Buffer; updatedAt: number }>();

const BUNDLED_DEFAULTS: Record<string, string> = {
  'logo-512': path.resolve(process.cwd(), 'public/vistoosa-logo.png'),
  'logo-dark-512': path.resolve(process.cwd(), 'src/assets/images/vistoosa-logo-dark.png'),
  'icon-16': path.resolve(process.cwd(), 'public/favicon-16x16.png'),
  'icon-32': path.resolve(process.cwd(), 'public/favicon-32x32.png'),
  'icon-48': path.resolve(process.cwd(), 'public/favicon-48x48.png'),
  'icon-180': path.resolve(process.cwd(), 'public/apple-touch-icon.png'),
  'icon-192': path.resolve(process.cwd(), 'public/pwa-192x192.png'),
  'icon-512': path.resolve(process.cwd(), 'public/pwa-512x512.png'),
  'icon-maskable-512': path.resolve(process.cwd(), 'public/maskable-icon-512x512.png'),
  'maskable-512': path.resolve(process.cwd(), 'public/maskable-icon-512x512.png'),
};

const VALID_VARIANTS = new Set([
  'logo-512',
  'logo-dark-512',
  'icon-16',
  'icon-32',
  'icon-48',
  'icon-180',
  'icon-192',
  'icon-512',
  'icon-maskable-512',
  'maskable-512',
]);

// Helper to load meta from Firestore or cache
export async function getBrandMeta(): Promise<BrandMeta> {
  try {
    const metaDoc = await db.collection(BRAND_COLLECTION).doc('meta').get();
    if (metaDoc.exists) {
      const data = metaDoc.data() as BrandMeta;
      localMetaCache = {
        version: Number(data.version) || Date.now(),
        hasCustomLogo: Boolean(data.hasCustomLogo),
        hasDarkLogo: Boolean(data.hasDarkLogo),
      };
    }
  } catch (err) {
    // If Firestore fails or is offline, keep resilient local fallback
  }
  return localMetaCache;
}

export async function getBrandImageBuffer(variant: string): Promise<Buffer | null> {
  const meta = await getBrandMeta();
  const normalizedVariant = variant === 'maskable-512' ? 'icon-maskable-512' : variant;

  if (meta.hasCustomLogo) {
    const cached = imageBufferCache.get(normalizedVariant);
    if (cached && cached.updatedAt >= meta.version) {
      return cached.buffer;
    }

    try {
      const docRef = await db.collection(BRAND_COLLECTION).doc(normalizedVariant).get();
      if (docRef.exists) {
        const rawData = docRef.data()?.data;
        if (typeof rawData === 'string' && rawData.length > 0) {
          const cleanBase64 = rawData.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(cleanBase64, 'base64');
          imageBufferCache.set(normalizedVariant, { buffer, updatedAt: meta.version });
          return buffer;
        }
      }
    } catch (err) {
      console.warn(`[Brand Assets]: Failed to load custom variant "${normalizedVariant}" from Firestore:`, err);
    }
  }

  // Fallback to bundled static files
  const defaultPath = BUNDLED_DEFAULTS[normalizedVariant] || BUNDLED_DEFAULTS['logo-512'];
  if (fs.existsSync(defaultPath)) {
    return fs.readFileSync(defaultPath);
  }

  return null;
}

export function mountBrandRoutes(app: Express) {
  // GET /api/brand/meta (PUBLIC)
  app.get('/api/brand/meta', async (_req, res) => {
    const meta = await getBrandMeta();
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.json({
      success: true,
      version: meta.version,
      hasCustomLogo: meta.hasCustomLogo,
      hasDarkLogo: meta.hasDarkLogo,
    });
  });

  // GET /api/brand/image/:variant.png (PUBLIC)
  app.get('/api/brand/image/:variant.png', async (req, res) => {
    try {
      const variant = req.params.variant.replace(/\.png$/, '');
      const meta = await getBrandMeta();
      const buffer = await getBrandImageBuffer(variant);

      if (!buffer) {
        return res.status(404).send('Image variant not found');
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('ETag', `W/"${meta.version}-${variant}"`);
      return res.send(buffer);
    } catch (err: any) {
      console.error('[Brand Image Route Error]:', err);
      return res.status(500).send('Failed to serve brand image');
    }
  });

  // GET /api/brand/favicon.ico (PUBLIC)
  app.get('/api/brand/favicon.ico', async (_req, res) => {
    try {
      const meta = await getBrandMeta();
      const buffer = await getBrandImageBuffer('icon-32');

      if (buffer) {
        res.setHeader('Content-Type', 'image/x-icon');
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.setHeader('ETag', `W/"${meta.version}-favicon"`);
        return res.send(buffer);
      }

      const defaultIco = path.resolve(process.cwd(), 'public/favicon.ico');
      if (fs.existsSync(defaultIco)) {
        return res.sendFile(defaultIco);
      }
      return res.status(404).send('Favicon not found');
    } catch {
      return res.status(500).send('Error serving favicon');
    }
  });

  // GET /api/brand/manifest.webmanifest (PUBLIC)
  app.get('/api/brand/manifest.webmanifest', async (_req, res) => {
    const meta = await getBrandMeta();
    const v = meta.version;

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');

    const manifest = {
      name: 'Vistoosa Management System',
      short_name: 'Vistoosa',
      description: 'Vistoosa Management System - Male Fashion & Operations Intelligence Platform',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#0f0f14',
      background_color: '#0f0f14',
      id: '/',
      icons: [
        {
          src: `/api/brand/image/icon-192.png?v=${v}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/brand/image/icon-512.png?v=${v}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/brand/image/icon-maskable-512.png?v=${v}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    return res.json(manifest);
  });

  // POST /api/brand/logo (ADMIN/OWNER ONLY)
  app.post('/api/brand/logo', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userRole = req.user?.role?.toLowerCase() || '';
      const isAdminOrOwner =
        userRole.includes('admin') ||
        userRole.includes('owner') ||
        userRole.includes('manager') ||
        req.user?.email === 'admin@vistoosa.com';

      if (!isAdminOrOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or Owner privileges required to update brand assets.',
        });
      }

      const { variants, dark } = req.body || {};
      if (!variants || typeof variants !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload. Expecting "variants" object.',
        });
      }

      const batch = db.batch();
      const newVersion = Date.now();
      let hasDarkLogo = false;

      // Validate and process variants
      const allKeys = Object.keys(variants);
      if (dark && typeof dark === 'string') {
        variants['logo-dark-512'] = dark;
        hasDarkLogo = true;
      }

      for (const [key, base64Val] of Object.entries(variants)) {
        const normKey = key === 'maskable-512' ? 'icon-maskable-512' : key;
        if (!VALID_VARIANTS.has(normKey) && normKey !== 'logo-dark-512') {
          continue;
        }

        if (typeof base64Val !== 'string') {
          continue;
        }

        const cleanBase64 = base64Val.replace(/^data:image\/\w+;base64,/, '');
        // Validate size (max 700 KB)
        if (cleanBase64.length > 950000) {
          return res.status(400).json({
            success: false,
            message: `Variant "${normKey}" exceeds maximum allowed size (700 KB).`,
          });
        }

        const docRef = db.collection(BRAND_COLLECTION).doc(normKey);
        batch.set(docRef, {
          data: cleanBase64,
          updatedAt: newVersion,
        });

        // Update local image buffer cache
        const buffer = Buffer.from(cleanBase64, 'base64');
        imageBufferCache.set(normKey, { buffer, updatedAt: newVersion });
      }

      // Check if dark logo doc exists or was uploaded
      if (variants['logo-dark-512']) {
        hasDarkLogo = true;
      }

      const metaRef = db.collection(BRAND_COLLECTION).doc('meta');
      const newMeta: BrandMeta = {
        version: newVersion,
        hasCustomLogo: true,
        hasDarkLogo,
      };

      batch.set(metaRef, newMeta);
      await batch.commit();

      localMetaCache = newMeta;

      return res.json({
        success: true,
        message: 'Brand logo assets updated successfully across all devices.',
        version: newVersion,
        hasCustomLogo: true,
        hasDarkLogo,
      });
    } catch (err: any) {
      console.error('[Brand Assets Save Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update brand assets: ' + (err?.message || 'Server error'),
      });
    }
  });

  // DELETE /api/brand/logo (ADMIN/OWNER ONLY)
  app.delete('/api/brand/logo', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userRole = req.user?.role?.toLowerCase() || '';
      const isAdminOrOwner =
        userRole.includes('admin') ||
        userRole.includes('owner') ||
        userRole.includes('manager') ||
        req.user?.email === 'admin@vistoosa.com';

      if (!isAdminOrOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or Owner privileges required to reset brand assets.',
        });
      }

      const batch = db.batch();
      for (const variant of VALID_VARIANTS) {
        batch.delete(db.collection(BRAND_COLLECTION).doc(variant));
      }

      const newVersion = Date.now();
      const newMeta: BrandMeta = {
        version: newVersion,
        hasCustomLogo: false,
        hasDarkLogo: false,
      };

      batch.set(db.collection(BRAND_COLLECTION).doc('meta'), newMeta);
      await batch.commit();

      localMetaCache = newMeta;
      imageBufferCache.clear();

      return res.json({
        success: true,
        message: 'Brand logo reset to default official Vistoosa assets.',
        version: newVersion,
        hasCustomLogo: false,
        hasDarkLogo: false,
      });
    } catch (err: any) {
      console.error('[Brand Assets Reset Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset brand assets: ' + (err?.message || 'Server error'),
      });
    }
  });
}
