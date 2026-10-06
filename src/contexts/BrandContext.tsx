import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface BrandMeta {
  version: number;
  hasCustomLogo: boolean;
  hasDarkLogo: boolean;
}

interface BrandContextType {
  meta: BrandMeta;
  isLoading: boolean;
  refetchBrandMeta: () => Promise<void>;
  getLogoUrl: (isDark?: boolean) => string;
}

const DEFAULT_META: BrandMeta = {
  version: Date.now(),
  hasCustomLogo: false,
  hasDarkLogo: false,
};

const LOCAL_STORAGE_KEY = 'vistoosa_brand_meta';

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [meta, setMeta] = useState<BrandMeta>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.version === 'number') {
          return {
            version: parsed.version,
            hasCustomLogo: Boolean(parsed.hasCustomLogo),
            hasDarkLogo: Boolean(parsed.hasDarkLogo),
          };
        }
      }
    } catch {
      // Speed hint fallback
    }
    return DEFAULT_META;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to sync DOM head link tags
  const syncDomHeadTags = useCallback((currentMeta: BrandMeta) => {
    const v = currentMeta.version;

    // Update Favicon links
    const favIco = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/x-icon"]');
    if (favIco) favIco.href = `/api/brand/favicon.ico?v=${v}`;

    const fav16 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="16x16"]');
    if (fav16) fav16.href = `/api/brand/image/icon-16.png?v=${v}`;

    const fav32 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="32x32"]');
    if (fav32) fav32.href = `/api/brand/image/icon-32.png?v=${v}`;

    const fav48 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="48x48"]');
    if (fav48) fav48.href = `/api/brand/image/icon-48.png?v=${v}`;

    // Update Apple Touch Icon
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = `/api/brand/image/icon-180.png?v=${v}`;

    // Update Manifest Link
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = `/api/brand/manifest.webmanifest?v=${v}`;

    // Update OG Image
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.content = `/api/brand/image/logo-512.png?v=${v}`;
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const rawToken = typeof window !== 'undefined' ? localStorage.getItem('vistoosa_auth_token') || '' : '';
      const token = rawToken.replace(/^"|"$/g, '');
      const res = await fetch('/api/brand/meta', {
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          success: false,
          message: `Server returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 120)}`,
        };
      }

      if (res.ok && data && data.success && typeof data.version === 'number') {
        const newMeta: BrandMeta = {
          version: data.version,
          hasCustomLogo: Boolean(data.hasCustomLogo),
          hasDarkLogo: Boolean(data.hasDarkLogo),
        };

        setMeta((prev) => {
          if (
            prev.version !== newMeta.version ||
            prev.hasCustomLogo !== newMeta.hasCustomLogo ||
            prev.hasDarkLogo !== newMeta.hasDarkLogo
          ) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newMeta));
            syncDomHeadTags(newMeta);
            return newMeta;
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('[BrandContext]: Unable to poll brand metadata:', err);
    } finally {
      setIsLoading(false);
    }
  }, [syncDomHeadTags]);

  useEffect(() => {
    fetchMeta();

    // Re-fetch when window gains focus or tab becomes visible
    const handleFocus = () => {
      fetchMeta();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchMeta();
      }
    });

    // Poll every 5 minutes (300,000 ms)
    const interval = setInterval(fetchMeta, 300000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [fetchMeta]);

  useEffect(() => {
    syncDomHeadTags(meta);
  }, [meta, syncDomHeadTags]);

  const getLogoUrl = useCallback((isDark = true) => {
    if (!meta.hasCustomLogo) {
      return '';
    }
    if (isDark && meta.hasDarkLogo) {
      return `/api/brand/image/logo-dark-512.png?v=${meta.version}`;
    }
    return `/api/brand/image/logo-512.png?v=${meta.version}`;
  }, [meta]);

  return (
    <BrandContext.Provider value={{ meta, isLoading, refetchBrandMeta: fetchMeta, getLogoUrl }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand must be used within BrandProvider');
  }
  return ctx;
};
