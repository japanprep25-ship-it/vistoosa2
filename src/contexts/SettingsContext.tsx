import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type ThemePreset = 'amber' | 'emerald' | 'blue' | 'rose' | 'purple';
export type FontPreset = 'default' | 'modern' | 'classic' | 'playful';

export interface SettingsData {
  appName: string;
  appMonogram: string;
  appSubtitle: string;
  appTagline: string;
  themePreset: ThemePreset;
  fontPreset: FontPreset;
  logoImage: string | null;
  isDarkMode: boolean;
}

interface SettingsContextType extends SettingsData {
  updateSettings: (newSettings: Partial<SettingsData>) => void;
  toggleDarkMode: () => void;
  refetchSettings: () => Promise<void>;
}

const defaultSettings: SettingsData = {
  appName: 'Vistoosa Management System',
  appMonogram: 'V',
  appSubtitle: 'Management System',
  appTagline: '',
  themePreset: 'amber',
  fontPreset: 'default',
  logoImage: '/logo_white.png',
  isDarkMode: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const themeColors = {
  amber: null, // default
  emerald: {
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
  },
  blue: {
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },
  rose: {
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
  },
  purple: {
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
  },
};

const fontConfigurations: Record<FontPreset, { brand: string; body: string }> = {
  default: { brand: "'Cinzel', serif", body: "'Plus Jakarta Sans', sans-serif" },
  modern: { brand: "'Montserrat', sans-serif", body: "'Inter', sans-serif" },
  classic: { brand: "'Playfair Display', serif", body: "'Lora', serif" },
  playful: { brand: "'Outfit', sans-serif", body: "'Quicksand', sans-serif" },
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsData>(() => {
    const saved = localStorage.getItem('vistoosa-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed,
          logoImage: defaultSettings.logoImage,
        };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const fetchGlobalSettings = useCallback(async () => {
    try {
      const rawToken = typeof window !== 'undefined' ? localStorage.getItem('vistoosa_auth_token') || '' : '';
      const token = rawToken.replace(/^"|"$/g, '');

      const res = await fetch('/api/settings/global', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (res.ok && data && data.success && data.settings) {
        const serverS = data.settings;
        setSettings((prev) => {
          const merged: SettingsData = {
            appName: serverS.appName || prev.appName || defaultSettings.appName,
            appMonogram: serverS.appMonogram || prev.appMonogram || defaultSettings.appMonogram,
            appSubtitle: serverS.appSubtitle || prev.appSubtitle || defaultSettings.appSubtitle,
            appTagline: serverS.appTagline ?? prev.appTagline ?? defaultSettings.appTagline,
            themePreset: serverS.themePreset || prev.themePreset || defaultSettings.themePreset,
            fontPreset: serverS.fontPreset || prev.fontPreset || defaultSettings.fontPreset,
            logoImage: defaultSettings.logoImage,
            isDarkMode: typeof serverS.isDarkMode === 'boolean' ? serverS.isDarkMode : prev.isDarkMode,
          };
          localStorage.setItem('vistoosa-settings', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('[SettingsContext]: Failed to fetch global server settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchGlobalSettings();

    const handleFocus = () => {
      fetchGlobalSettings();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchGlobalSettings();
      }
    });

    const interval = setInterval(fetchGlobalSettings, 180000); // 3 minutes

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [fetchGlobalSettings]);

  useEffect(() => {
    localStorage.setItem('vistoosa-settings', JSON.stringify(settings));
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Sync title tag
  useEffect(() => {
    if (settings.appName) {
      document.title = settings.appName;
    }
  }, [settings.appName]);

  const updateSettings = async (newSettings: Partial<SettingsData>) => {
    setSettings((s) => {
      const updated = { ...s, ...newSettings };
      localStorage.setItem('vistoosa-settings', JSON.stringify(updated));
      return updated;
    });

    // Sync to Firestore server for all devices
    try {
      const rawToken = typeof window !== 'undefined' ? localStorage.getItem('vistoosa_auth_token') || '' : '';
      const token = rawToken.replace(/^"|"$/g, '');

      await fetch('/api/settings/global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newSettings),
      });
    } catch (err) {
      console.warn('[SettingsContext]: Failed to sync updated settings to server:', err);
    }
  };

  const toggleDarkMode = () => updateSettings({ isDarkMode: !settings.isDarkMode });

  const customTheme = themeColors[settings.themePreset] || null;
  const activeFonts = fontConfigurations[settings.fontPreset] || fontConfigurations.default;

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        updateSettings,
        toggleDarkMode,
        refetchSettings: fetchGlobalSettings,
      }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Quicksand:wght@400;500;600;700&display=swap');
          
          :root {
            --font-brand: ${activeFonts.brand};
            --font-body: ${activeFonts.body};
            ${
              customTheme
                ? `
              --color-amber-200: ${customTheme[200]} !important;
              --color-amber-300: ${customTheme[300]} !important;
              --color-amber-400: ${customTheme[400]} !important;
              --color-amber-500: ${customTheme[500]} !important;
              --color-amber-600: ${customTheme[600]} !important;
            `
                : ''
            }
          }
        `}
      </style>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
