import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface BrandMeta {
  version?: number;
  hasCustomLogo?: boolean;
  hasDarkLogo?: boolean;
  logoUrl?: string;
  darkLogoUrl?: string;
  faviconUrl?: string;
  appIconUrl?: string;
  updatedAt?: number;
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
  updatedAt: Date.now(),
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [meta, setMeta] = useState<BrandMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to sync DOM head link tags
  const syncDomHeadTags = useCallback((currentMeta: BrandMeta) => {
    // Update Favicon links
    const favIco = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/x-icon"]');
    if (favIco && currentMeta.faviconUrl) favIco.href = currentMeta.faviconUrl;

    // Update Apple Touch Icon
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon && currentMeta.appIconUrl) appleIcon.href = currentMeta.appIconUrl;

    // Update OG Image
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage && currentMeta.logoUrl) ogImage.content = currentMeta.logoUrl;
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      // 1. Fetch from backend server API (resilient, backed by in-memory/disk/admin SDK)
      try {
        const res = await fetch('/api/brand/meta');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            const v = data.version || Date.now();
            const serverMeta: BrandMeta = {
              version: v,
              hasCustomLogo: Boolean(data.hasCustomLogo),
              hasDarkLogo: Boolean(data.hasDarkLogo),
              logoUrl: data.hasCustomLogo ? `/api/brand/image/logo-512.png?v=${v}` : '/vistoosa-logo.png',
              darkLogoUrl: data.hasDarkLogo ? `/api/brand/image/logo-dark-512.png?v=${v}` : undefined,
              faviconUrl: `/api/brand/favicon.ico?v=${v}`,
              appIconUrl: `/api/brand/image/icon-192.png?v=${v}`,
              updatedAt: v,
            };
            setMeta((prev) => ({ ...prev, ...serverMeta }));
            syncDomHeadTags(serverMeta);
          }
        }
      } catch (apiErr) {
        // Fallback silently
      }

      // 2. Fetch from Firestore doc if available
      try {
        const docRef = doc(db, 'settings', 'branding');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as BrandMeta;
          setMeta((prev) => ({ ...prev, ...data }));
          syncDomHeadTags(data);
        }
      } catch (firestoreErr) {
        // Firestore read restricted or offline; handled gracefully
      }
    } catch (err) {
      console.warn('[BrandContext]: Unable to fetch brand metadata:', err);
    } finally {
      setIsLoading(false);
    }
  }, [syncDomHeadTags]);

  useEffect(() => {
    // Initial fetch via API & Firestore
    fetchMeta();

    // Listen to real-time changes with mandatory error handler callback
    const docRef = doc(db, 'settings', 'branding');
    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as BrandMeta;
          setMeta((prev) => ({ ...prev, ...data }));
          syncDomHeadTags(data);
        }
        setIsLoading(false);
      },
      (error) => {
        // CRITICAL error callback: catches permission-denied without throwing uncaught errors
        console.info('[BrandContext]: Firestore real-time snapshot restricted:', error.message);
        setIsLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [fetchMeta, syncDomHeadTags]);

  const getLogoUrl = useCallback(
    (isDark = true) => {
      if (isDark && meta.darkLogoUrl) {
        return meta.darkLogoUrl;
      }
      if (isDark && meta.hasDarkLogo) {
        return `/api/brand/image/logo-dark-512.png?v=${meta.version || Date.now()}`;
      }
      if (meta.logoUrl) {
        return meta.logoUrl;
      }
      if (meta.hasCustomLogo) {
        return `/api/brand/image/logo-512.png?v=${meta.version || Date.now()}`;
      }
      return '/vistoosa-logo.png';
    },
    [meta]
  );

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
