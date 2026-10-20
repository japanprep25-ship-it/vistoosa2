import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface BrandMeta {
  logoUrl?: string;
  darkLogoUrl?: string;
  faviconUrl?: string;
  appIconUrl?: string;
  updatedAt: number;
}

interface BrandContextType {
  meta: BrandMeta;
  isLoading: boolean;
  refetchBrandMeta: () => Promise<void>;
  getLogoUrl: (isDark?: boolean) => string;
}

const DEFAULT_META: BrandMeta = {
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
      const docRef = doc(db, 'settings', 'branding');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as BrandMeta;
        setMeta(data);
        syncDomHeadTags(data);
      }
    } catch (err) {
      console.warn('[BrandContext]: Unable to fetch brand metadata:', err);
    } finally {
      setIsLoading(false);
    }
  }, [syncDomHeadTags]);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'branding');
    const unsub = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as BrandMeta;
            setMeta(data);
            syncDomHeadTags(data);
        }
        setIsLoading(false);
    });
    return unsub;
  }, [syncDomHeadTags]);

  const getLogoUrl = useCallback((isDark = true) => {
    if (isDark && meta.darkLogoUrl) {
      return meta.darkLogoUrl;
    }
    return meta.logoUrl || '';
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
