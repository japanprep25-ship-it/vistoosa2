import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemePreset = 'amber' | 'emerald' | 'blue' | 'rose' | 'purple';
export type FontPreset = 'default' | 'modern' | 'classic' | 'playful';

interface SettingsData {
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
}

const defaultSettings: SettingsData = {
  appName: 'Vistoosa',
  appMonogram: 'V',
  appSubtitle: 'Haute Couture',
  appTagline: 'Dhaka Fulfillment Hub • 100% Free Tier Cloud',
  themePreset: 'amber',
  fontPreset: 'default',
  logoImage: null,
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
  }
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
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

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
    document.title = settings.appName;
  }, [settings.appName]);

  const updateSettings = (newSettings: Partial<SettingsData>) => {
    setSettings(s => ({ ...s, ...newSettings }));
  };

  const toggleDarkMode = () => updateSettings({ isDarkMode: !settings.isDarkMode });

  const customTheme = themeColors[settings.themePreset];
  const activeFonts = fontConfigurations[settings.fontPreset];

  return (
    <SettingsContext.Provider value={{ ...settings, updateSettings, toggleDarkMode }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Quicksand:wght@400;500;600;700&display=swap');
          
          :root {
            --font-brand: ${activeFonts.brand};
            --font-body: ${activeFonts.body};
            ${customTheme ? `
              --color-amber-200: ${customTheme[200]} !important;
              --color-amber-300: ${customTheme[300]} !important;
              --color-amber-400: ${customTheme[400]} !important;
              --color-amber-500: ${customTheme[500]} !important;
              --color-amber-600: ${customTheme[600]} !important;
            ` : ''}
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
