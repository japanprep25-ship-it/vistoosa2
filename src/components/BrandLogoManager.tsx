import React, { useState, useRef } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  loadImageFromFile,
  generateAllLogoVariants,
  generateDarkLogoVariant,
  GeneratedVariants,
} from '../utils/imageProcessor';
import {
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  ShieldCheck,
  Moon,
  Sun,
  Smartphone,
} from 'lucide-react';

export const BrandLogoManager: React.FC = () => {
  const { meta, refetchBrandMeta, getLogoUrl } = useBrand();
  const { t, isBangla } = useLanguage();

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);

  const [stagedVariants, setStagedVariants] = useState<GeneratedVariants | null>(null);
  const [stagedDarkLogo, setStagedDarkLogo] = useState<string | null>(null);
  const [mainFileName, setMainFileInputName] = useState<string | null>(null);
  const [darkFileName, setDarkFileInputName] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Handle Main Logo File Selection
  const handleMainFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(
        isBangla
          ? 'ফাইল সাইজ খুব বড়। অনুগ্রহ করে ৫ মেগাবাইটের কম সাইজের ছবি আপলোড করুন।'
          : 'File size exceeds 5 MB limit. Please select a smaller image.',
        'error'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const img = await loadImageFromFile(file);
      const variants = generateAllLogoVariants(img);
      setStagedVariants(variants);
      setMainFileInputName(file.name);
      showToast(
        isBangla
          ? 'লোগো আইকন সফলভাবে প্রস্তুত করা হয়েছে! নিচে প্রিভিউ দেখে সংরক্ষণ করুন।'
          : 'Logo processed successfully! Preview below and click Save.'
      );
    } catch (err: any) {
      console.error('[Main Logo Process Error]:', err);
      showToast(err?.message || 'Failed to process image file.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Handle Dark Mode Logo File Selection
  const handleDarkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(
        isBangla
          ? 'ফাইল সাইজ খুব বড়। অনুগ্রহ করে ৫ মেগাবাইটের কম সাইজের ছবি আপলোড করুন।'
          : 'File size exceeds 5 MB limit.',
        'error'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const img = await loadImageFromFile(file);
      const darkVariant = generateDarkLogoVariant(img);
      setStagedDarkLogo(darkVariant);
      setDarkFileInputName(file.name);
      showToast(
        isBangla
          ? 'ডার্ক মোড লোগো সফলভাবে প্রস্তুত করা হয়েছে!'
          : 'Dark mode logo processed successfully!'
      );
    } catch (err: any) {
      console.error('[Dark Logo Process Error]:', err);
      showToast('Failed to process dark mode logo.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Save Brand Assets to Server & Firestore
  const handleSaveLogo = async () => {
    if (!stagedVariants) {
      showToast(
        isBangla ? 'অনুগ্রহ করে সংরক্ষণ করার জন্য প্রথমে একটি লোগো বেছে নিন।' : 'Please select a logo to upload first.',
        'error'
      );
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('vistoosa_auth_token') || '';

      const payload = {
        variants: stagedVariants,
        dark: stagedDarkLogo || undefined,
      };

      const res = await fetch('/api/brand/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        data = {
          success: false,
          message: `Server response (HTTP ${res.status}): ${resText.slice(0, 120)}`,
        };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}: Failed to save brand logo.`);
      }

      // Refresh global brand context
      await refetchBrandMeta();

      // Reset staged state
      setStagedVariants(null);
      setStagedDarkLogo(null);
      setMainFileInputName(null);
      setDarkFileInputName(null);

      showToast(
        isBangla
          ? 'ব্র্যান্ড লোগো এবং PWA আইকন সমস্ত ডিভাইসের জন্য সফলভাবে সংরক্ষণ করা হয়েছে!'
          : 'Brand logo and app icons updated across all devices successfully!'
      );
    } catch (err: any) {
      console.error('[Brand Logo Save Error]:', err);
      showToast(err?.message || 'Error saving brand logo to server.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Reset to Official Default Logo
  const handleResetLogo = async () => {
    if (
      !window.confirm(
        isBangla
          ? 'আপনি কি নিশ্চিত যে কাস্টম লোগো মুছে ডিফল্ট Vistoosa লোগোতে ফিরে যেতে চান?'
          : 'Are you sure you want to delete the custom logo and reset to official default Vistoosa assets?'
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const token = localStorage.getItem('vistoosa_auth_token') || '';

      const res = await fetch('/api/brand/logo', {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        data = {
          success: false,
          message: `Server response (HTTP ${res.status}): ${resText.slice(0, 120)}`,
        };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}: Failed to reset brand logo.`);
      }

      await refetchBrandMeta();
      setStagedVariants(null);
      setStagedDarkLogo(null);
      setMainFileInputName(null);
      setDarkFileInputName(null);

      showToast(
        isBangla ? 'ডিফল্ট Vistoosa ব্র্যান্ড লোগো পুনরুদ্ধার করা হয়েছে।' : 'Reset to default Vistoosa brand logo successfully.'
      );
    } catch (err: any) {
      console.error('[Brand Logo Reset Error]:', err);
      showToast(err?.message || 'Error resetting brand logo.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Preview Image Sources
  const mainPreviewSrc = stagedVariants ? stagedVariants['logo-512'] : meta.hasCustomLogo ? getLogoUrl(false) : '';
  const darkPreviewSrc = stagedDarkLogo
    ? stagedDarkLogo
    : stagedVariants
    ? stagedVariants['logo-512']
    : meta.hasCustomLogo
    ? getLogoUrl(true)
    : '';
  const iconPreviewSrc = stagedVariants
    ? stagedVariants['icon-512']
    : meta.hasCustomLogo
    ? `/api/brand/image/icon-512.png?v=${meta.version}`
    : '';

  return (
    <div className="p-6 rounded-2xl glass-panel border border-amber-500/30 bg-zinc-900/90 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span>{isBangla ? 'ব্র্যান্ড লোগো ও PWA আইকন কন্ট্রোল' : 'Brand Logo & App Icon Control'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold uppercase tracking-wider">
                Cross-Device Sync
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              {isBangla
                ? 'একবার আপলোড করলে সমস্ত ব্রাউজার, মোবাইল PWA লঞ্চার এবং হেডার লোগো সিঙ্ক হবে।'
                : 'Uploaded once to server and synced across all devices, mobile PWA launchers, and headers.'}
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              meta.hasCustomLogo
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                meta.hasCustomLogo ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
              }`}
            />
            {meta.hasCustomLogo
              ? isBangla
                ? 'কাস্টম ব্র্যান্ড লোগো সক্রিয়'
                : 'Custom Logo Active'
              : isBangla
              ? 'ডিফল্ট Vistoosa লোগো সক্রিয়'
              : 'Default Vistoosa Assets'}
          </span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* File Upload Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Slot 1: Main Brand Logo */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>{isBangla ? '১. প্রধান ব্র্যান্ড লোগো (Main Logo)' : '1. Main Brand Logo'}</span>
            </label>
            <span className="text-[10px] text-zinc-500">PNG / JPG / WebP &lt; 5MB</span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug">
            {isBangla
              ? 'অ্যাপ হেডার, সাইডবার, লগইন পেজ এবং মোবাইল লঞ্চার আইকনের জন্য প্রধান ট্রান্সপারেন্ট লোগো।'
              : 'Main transparent logo used for headers, sidebars, login screen, and app launcher icons.'}
          </p>

          <input
            type="file"
            ref={mainFileInputRef}
            onChange={handleMainFileChange}
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isProcessing || isSaving}
              onClick={() => mainFileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isBangla ? 'লোগো ফাইল বাছাই করুন' : 'Select Main Logo File'}</span>
            </button>

            {mainFileName && (
              <span className="text-[11px] text-emerald-400 font-mono truncate max-w-[150px]">
                {mainFileName}
              </span>
            )}
          </div>
        </div>

        {/* Slot 2: Optional Dark-Mode Logo */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-purple-400" />
              <span>{isBangla ? '২. ডার্ক মোড লোগো (ঐচ্ছিক)' : '2. Dark-Mode Logo (Optional)'}</span>
            </label>
            <span className="text-[10px] text-purple-400/80 font-mono">Transparent PNG</span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug">
            {isBangla
              ? 'যদি আপনার লোগোটি গাঢ় কালারের হয়, তবে ডার্ক ব্যাকগ্রাউন্ডের জন্য লাইট-কালার ভার্সন দিন।'
              : 'If your main logo is dark, provide a light-colored version for dark backgrounds.'}
          </p>

          <input
            type="file"
            ref={darkFileInputRef}
            onChange={handleDarkFileChange}
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isProcessing || isSaving}
              onClick={() => darkFileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isBangla ? 'ডার্ক লোগো ফাইল বেছে নিন' : 'Select Dark Logo File'}</span>
            </button>

            {darkFileName && (
              <span className="text-[11px] text-purple-300 font-mono truncate max-w-[150px]">
                {darkFileName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview Cards Section */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isBangla ? 'লাইভ প্রিভিউ (Real-Time UI Preview)' : 'Live Multi-UI Real-Time Preview'}</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Preview 1: Dark UI */}
          <div className="p-3.5 rounded-xl bg-[#0f0f14] border border-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">
              Dark Background UI
            </span>
            <div className="h-12 flex items-center justify-center p-1">
              {darkPreviewSrc ? (
                <img
                  src={darkPreviewSrc}
                  alt="Dark UI Preview"
                  className="max-h-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-zinc-600">Default Vistoosa Logo</span>
              )}
            </div>
            <span className="text-[9px] text-zinc-500">Header & Sidebar (Dark Mode)</span>
          </div>

          {/* Preview 2: Light UI */}
          <div className="p-3.5 rounded-xl bg-white text-zinc-900 border border-zinc-300 flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-[10px] text-zinc-800 font-bold tracking-wider uppercase">
              Light Background UI
            </span>
            <div className="h-12 flex items-center justify-center p-1">
              {mainPreviewSrc ? (
                <img
                  src={mainPreviewSrc}
                  alt="Light UI Preview"
                  className="max-h-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-zinc-400">Default Vistoosa Logo</span>
              )}
            </div>
            <span className="text-[9px] text-zinc-500">Export Reports & Light Theme</span>
          </div>

          {/* Preview 3: App Icon / PWA Launcher */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> PWA / Favicon
            </span>
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center overflow-hidden">
              {iconPreviewSrc ? (
                <img
                  src={iconPreviewSrc}
                  alt="PWA Icon Preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-zinc-400 font-mono">V</span>
              )}
            </div>
            <span className="text-[9px] text-zinc-500">iOS & Android Home Screen Icon</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
        <button
          type="button"
          disabled={!stagedVariants || isSaving}
          onClick={handleSaveLogo}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center gap-2 cursor-pointer disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>
            {isSaving
              ? isBangla
                ? 'সংরক্ষণ করা হচ্ছে...'
                : 'Saving Brand Assets...'
              : isBangla
              ? 'ব্র্যান্ড লোগো সংরক্ষণ ও সিঙ্ক করুন'
              : 'Save & Sync Brand Assets'}
          </span>
        </button>

        {meta.hasCustomLogo && (
          <button
            type="button"
            disabled={isResetting || isSaving}
            onClick={handleResetLogo}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 hover:border-red-500/40 text-zinc-300 font-medium text-xs transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40"
          >
            {isResetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            )}
            <span>{isBangla ? 'ডিফল্ট Vistoosa লোগোতে রিসেট করুন' : 'Reset to Default Vistoosa Assets'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
