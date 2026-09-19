import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageCode, translations, Translations } from '../i18n/translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: keyof Translations) => string;
  isBangla: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  // Load language preference from backend on initial mount or session restore
  useEffect(() => {
    const fetchSavedLanguage = async () => {
      const token = localStorage.getItem('vistoosa_auth_token');
      if (!token) return;

      try {
        const res = await fetch('/api/settings/language', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && (data.language === 'en' || data.language === 'bn')) {
          setLanguageState(data.language);
        }
      } catch (err) {
        console.warn('Could not fetch user language preference:', err);
      }
    };

    fetchSavedLanguage();
  }, []);

  const setLanguage = async (newLang: LanguageCode) => {
    setLanguageState(newLang);

    // Save per-user preference on server
    const token = localStorage.getItem('vistoosa_auth_token');
    if (token) {
      try {
        await fetch('/api/settings/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ language: newLang }),
        });
      } catch (err) {
        console.warn('Could not save language preference to server:', err);
      }
    }
  };

  const t = (key: keyof Translations): string => {
    const currentDict = translations[language] || translations['en'];
    return currentDict[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isBangla: language === 'bn',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
