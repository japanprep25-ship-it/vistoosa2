import React, { useRef } from 'react';
import { useSettings, ThemePreset, FontPreset } from '../contexts/SettingsContext';
import { Save, Sparkles, Moon, Sun, Type, Palette, Image as ImageIcon, Upload, X } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const settings = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = React.useState({
    appName: settings.appName,
    appMonogram: settings.appMonogram,
    appSubtitle: settings.appSubtitle,
    appTagline: settings.appTagline,
    themePreset: settings.themePreset,
    fontPreset: settings.fontPreset,
    logoImage: settings.logoImage,
  });

  const handleSave = () => {
    settings.updateSettings(formData);
    // Optional: show a toast notification here
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const themes: { id: ThemePreset; name: string; colorClass: string }[] = [
    { id: 'amber', name: 'Premium Gold (Default)', colorClass: 'bg-amber-500' },
    { id: 'emerald', name: 'Royal Emerald', colorClass: 'bg-emerald-500' },
    { id: 'blue', name: 'Executive Navy', colorClass: 'bg-blue-500' },
    { id: 'rose', name: 'Rose Quartz', colorClass: 'bg-rose-500' },
    { id: 'purple', name: 'Deep Amethyst', colorClass: 'bg-purple-500' },
  ];

  const fonts: { id: FontPreset; name: string; desc: string }[] = [
    { id: 'default', name: 'Premium Classic', desc: 'Cinzel & Plus Jakarta Sans' },
    { id: 'modern', name: 'Clean Modern', desc: 'Montserrat & Inter' },
    { id: 'classic', name: 'Editorial Serif', desc: 'Playfair Display & Lora' },
    { id: 'playful', name: 'Soft Geometric', desc: 'Outfit & Quicksand' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="text-amber-500" /> System Configurations
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Customize application branding, themes, and display settings.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branding Settings */}
        <div className="p-6 rounded-2xl glass-panel space-y-6">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Type className="w-5 h-5 text-amber-500" />
            Branding & Identity
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Application Name
              </label>
              <input
                type="text"
                value={formData.appName}
                onChange={(e) => setFormData(prev => ({ ...prev, appName: e.target.value }))}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="e.g. Vistoosa"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Brand Logo
              </label>
              
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
                  {formData.logoImage ? (
                    <img src={formData.logoImage} alt="Brand Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-brand text-2xl bg-gradient-to-b from-amber-200 to-amber-600 bg-clip-text text-transparent">
                      {formData.appMonogram || 'V'}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload}
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors border border-zinc-700"
                    >
                      <Upload className="w-4 h-4" /> Upload Custom Logo
                    </button>
                    {formData.logoImage && (
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, logoImage: null }))}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium rounded-lg transition-colors border border-rose-500/20"
                        title="Remove Logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-zinc-500 font-medium">OR</span>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.appMonogram}
                      onChange={(e) => setFormData(prev => ({ ...prev, appMonogram: e.target.value }))}
                      className="w-[120px] bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors font-brand"
                      placeholder="Monogram"
                      disabled={!!formData.logoImage}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Subtitle Badge
              </label>
              <input
                type="text"
                value={formData.appSubtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, appSubtitle: e.target.value }))}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="e.g. Haute Couture"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Tagline / Description
              </label>
              <input
                type="text"
                value={formData.appTagline}
                onChange={(e) => setFormData(prev => ({ ...prev, appTagline: e.target.value }))}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="e.g. Dhaka Fulfillment Hub"
              />
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="p-6 rounded-2xl glass-panel space-y-6">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Palette className="w-5 h-5 text-amber-500" />
            Display Theme
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Typography Stack
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fonts.map(font => (
                  <button
                    key={font.id}
                    onClick={() => setFormData(prev => ({ ...prev, fontPreset: font.id }))}
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                      formData.fontPreset === font.id 
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`text-sm font-semibold ${formData.fontPreset === font.id ? 'text-amber-500' : 'text-zinc-300'}`}>
                        {font.name}
                      </span>
                      {formData.fontPreset === font.id && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <span className="text-xs text-zinc-500">{font.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Accent Color Preset
              </label>
              <div className="grid grid-cols-1 gap-3">
                {themes.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setFormData(prev => ({ ...prev, themePreset: theme.id }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      formData.themePreset === theme.id 
                        ? 'bg-amber-500/10 border-amber-500/50 text-zinc-200 shadow-sm' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${theme.colorClass} border-2 border-zinc-950 shadow-inner`} />
                    <span className="text-sm font-medium">{theme.name}</span>
                    {formData.themePreset === theme.id && (
                      <Sparkles className="w-4 h-4 ml-auto text-amber-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Appearance Mode
              </label>
              <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => settings.updateSettings({ isDarkMode: false })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    !settings.isDarkMode 
                      ? 'bg-zinc-100 text-zinc-900 shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Light Mode
                </button>
                <button
                  onClick={() => settings.updateSettings({ isDarkMode: true })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.isDarkMode 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700' 
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Extracted simple icon helper for the title
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
