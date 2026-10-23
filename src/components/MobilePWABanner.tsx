import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';

export const MobilePWABanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { isBangla } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('vistoosa_pwa_banner_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('vistoosa_pwa_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // If already installed, or dismissed, or neither installable nor iOS, don't render
  if (isInstalled || isDismissed) {
    return null;
  }

  // Only render on mobile screen
  return (
    <>
      <div
        id="mobile-pwa-install-banner"
        className="block md:hidden bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-950 border-b border-amber-500/30 px-3 py-2 text-zinc-100 shadow-md transition-all animate-in slide-in-from-top duration-300"
      >
        <div className="flex items-center justify-between gap-2.5">
          {/* App Icon & Details */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Vistoosa App"
              className="w-8 h-8 rounded-xl border border-amber-500/40 object-cover shrink-0 shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight flex items-center gap-1.5">
                <span>Vistoosa Mobile App</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  PWA
                </span>
              </p>
              <p className="text-[10px] text-zinc-400 truncate leading-tight">
                {isBangla ? 'ফোনে ইনস্টল করে দ্রুত কাজ করুন' : 'Install on phone for quick access'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isBangla ? 'ইনস্টল' : 'Install'}</span>
              </button>
            )}

            {isIOS && !isInstallable && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isBangla ? 'যোগ করুন' : 'Add to iOS'}</span>
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 active:scale-90 transition-all cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-700/80 p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">iPhone / iPad এ ইনস্টল করুন</h3>
                  <p className="text-[10px] text-zinc-400">Safari ব্রাউজার দিয়ে সহজে হোম স্ক্রিনে যোগ করুন</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Safari এর নিচে থাকা <strong className="text-white inline-flex items-center gap-1 mx-0.5"><Share className="w-3.5 h-3.5 text-amber-400" /> Share</strong> বাটনে ট্যাপ করুন।
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  তালিকা স্ক্রল করে <strong className="text-amber-400">"Add to Home Screen"</strong> (হোম স্ক্রিনে যোগ করুন) অপশনটি চাপুন।
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  উপরে ডানপাশে <strong className="text-emerald-400">Add</strong> চাপুন। আপনার ফোনে মোবাইল অ্যাপ হিসেবে যুক্ত হয়ে যাবে!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg transition active:scale-95"
            >
              বুঝেছি / Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
