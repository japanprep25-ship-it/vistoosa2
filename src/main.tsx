import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SettingsProvider } from './contexts/SettingsContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BrandProvider } from './contexts/BrandContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandProvider>
      <SettingsProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </SettingsProvider>
    </BrandProvider>
  </StrictMode>,
);
