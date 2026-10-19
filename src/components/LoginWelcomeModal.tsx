import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import {
  Sparkles,
  ShieldCheck,
  Crown,
  KeyRound,
  ArrowRight,
  Check,
  CheckCircle2,
  Smartphone,
  Lock,
} from 'lucide-react';
import { AuthUser } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginWelcomeModalProps {
  user: AuthUser;
  motherGmail?: string;
  onComplete: () => void;
}

export const LoginWelcomeModal: React.FC<LoginWelcomeModalProps> = ({
  user,
  motherGmail,
  onComplete,
}) => {
  const { isBangla } = useLanguage();
  const [rememberChoice, setRememberChoice] = useState<'yes' | 'no' | null>(() => {
    const saved = localStorage.getItem('vistoosa_remember_credentials');
    if (saved === 'true') return 'yes';
    if (saved === 'false') return 'no';
    return null;
  });

  const [progress, setProgress] = useState(0);
  const [hasPromptAnswered, setHasPromptAnswered] = useState(false);

  const cleanUserEmail = user.email.trim().toLowerCase();
  const isMother = motherGmail ? cleanUserEmail === motherGmail.trim().toLowerCase() : false;

  // Compute designation badge
  let designationTitle = user.role || 'Staff';
  let designationBadge = '💼 Staff Specialist';
  let badgeClass = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  if (isMother) {
    designationTitle = isBangla ? 'মাদার অ্যাডমিন ও সিস্টেম ওনার' : 'Mother Admin & System Owner';
    designationBadge = isBangla ? '👑 চিফ এক্সিকিউটিভ / প্রধান ওনার' : '👑 Chief Executive / Mother Owner';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/20';
  } else if (user.role === 'Owner') {
    designationTitle = isBangla ? 'সিস্টেম ওনার' : 'System Owner';
    designationBadge = isBangla ? '👑 সিস্টেম ওনার' : '👑 System Owner';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else if (user.role === 'Admin') {
    designationTitle = isBangla ? 'এক্সিকিউটিভ অ্যাডমিনিস্ট্রেটর' : 'Executive Administrator';
    designationBadge = isBangla ? '🛡️ অ্যাডমিন' : '🛡️ Executive Admin';
    badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  } else {
    designationTitle = isBangla ? 'স্টাফ স্পেশালিস্ট' : 'Operations Specialist';
    designationBadge = isBangla ? '💼 স্টাফ' : '💼 Operations Staff';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  }

  // Handle saving credential choice
  const handleSelectRemember = (choice: 'yes' | 'no') => {
    setRememberChoice(choice);
    setHasPromptAnswered(true);
    if (choice === 'yes') {
      localStorage.setItem('vistoosa_remember_credentials', 'true');
    } else {
      localStorage.setItem('vistoosa_remember_credentials', 'false');
    }
  };

  // Progress countdown to smoothly enter the app (stay for 3 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        // If not answered yet, hold progress at 90% until user answers Yes/No
        if (rememberChoice === null && prev >= 90) {
          return 90;
        }
        return prev + (100 / (3000 / 50));
      });
    }, 50);

    return () => clearInterval(timer);
  }, [rememberChoice]);

  // When progress reaches 100% and choice is made, transition
  useEffect(() => {
    if (progress >= 100 && rememberChoice !== null) {
      const exitTimer = setTimeout(() => {
        onComplete();
      }, 200);
      return () => clearTimeout(exitTimer);
    }
  }, [progress, rememberChoice, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl transition-all duration-500">
      {/* Background ambient gold luxury glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_30%,rgba(245,158,11,0.18),rgba(0,0,0,0))] pointer-events-none" />

      <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/40 bg-zinc-900/95 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Emblem */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-zinc-950 border border-amber-500/50 flex items-center justify-center shadow-xl shadow-amber-500/20">
          <BrandLogo heightPx={56} className="mx-auto" />
          <div className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-amber-500 text-zinc-950 shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Welcome Greeting */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider mx-auto bg-amber-500/10 border-amber-500/30 text-amber-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{isBangla ? 'লগইন সফল • ৩ সেকেন্ড ওয়েলকাম' : 'Authentication Successful • 3s Welcome'}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {isBangla ? 'স্বাগতম, ' : 'Welcome, '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
              {user.name || cleanUserEmail.split('@')[0]}
            </span>
            <span className="text-amber-400 font-semibold text-base sm:text-lg block mt-1.5 tracking-wide">
              {user.designation || user.role}
            </span>
          </h1>

          {/* Designation & Role Badge */}
          <div className="pt-1 flex flex-col items-center justify-center gap-1">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold tracking-wide ${badgeClass}`}>
              {isMother && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
              <span>{designationBadge}</span>
              <span className="text-zinc-400 font-normal">({designationTitle})</span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-1">
              {cleanUserEmail}
            </p>
          </div>
        </div>

        {/* Reminder / Stay Logged In Prompt (Requirement) */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-left space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <span>{isBangla ? 'পাসওয়ার্ড সেভ করে লগইন থাকতে চান? (Stay Log In)' : 'Stay logged in? (Save credentials)'}</span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isBangla
                  ? 'এটিতে হ্যাঁ বা না সিলেক্ট করার পর আপনি মূল ওয়েব অ্যাপে প্রবেশ করতে পারবেন।'
                  : 'Please select Yes or No to proceed into the web application.'}
              </p>
            </div>
          </div>

          {/* Toggle buttons for Stay Logged In */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSelectRemember('yes')}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                rememberChoice === 'yes'
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-md shadow-amber-500/30'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/80'
              }`}
            >
              {rememberChoice === 'yes' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <span>{isBangla ? 'হ্যাঁ (Yes)' : 'Yes, Stay In'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectRemember('no')}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                rememberChoice === 'no'
                  ? 'bg-zinc-800 text-white border-zinc-600 font-bold'
                  : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
              }`}
            >
              {rememberChoice === 'no' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <span>{isBangla ? 'না (No)' : 'No'}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Continue Button */}
        <div className="space-y-3 pt-1">
          <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-75 ease-out shadow-sm shadow-amber-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (rememberChoice === null) {
                alert(isBangla ? 'দয়া করে "হ্যাঁ" অথবা "না" সিলেক্ট করুন' : 'Please select Yes or No to continue.');
                return;
              }
              onComplete();
            }}
            className={`w-full py-3 px-4 rounded-2xl font-extrabold text-xs tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              rememberChoice === null
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/25 active:scale-[0.99]'
            }`}
          >
            <span>
              {rememberChoice === null
                ? (isBangla ? '⚠️ প্রথমে হ্যাঁ বা না সিলেক্ট করুন' : '⚠️ Please select Yes or No to Enter')
                : (isBangla ? 'ওয়ার্কস্পেসে প্রবেশ করুন' : 'Enter Vistoosa ERP')}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
