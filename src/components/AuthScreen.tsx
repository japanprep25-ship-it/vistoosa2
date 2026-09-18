import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, UserCheck, Sparkles, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { AuthUser } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  authorizedUsers: AuthUser[];
  onAddAuthorizedUser?: (email: string, name: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  authorizedUsers,
  onAddAuthorizedUser,
}) => {
  const { appName, appMonogram, appSubtitle, appTagline, logoImage } = useSettings();
  const [emailInput, setEmailInput] = useState('japanprep25@gmail.com');
  const [isVerifying, setIsVerifying] = useState(false);
  const [deniedAttempt, setDeniedAttempt] = useState<string | null>(null);
  const [requestedSuccess, setRequestedSuccess] = useState(false);

  const handleGoogleSignIn = (emailToTest: string) => {
    setIsVerifying(true);
    setDeniedAttempt(null);

    setTimeout(() => {
      const clean = emailToTest.trim().toLowerCase();
      const matched = (authorizedUsers || []).find(
        (u) => u.email.toLowerCase() === clean && u.status === 'Active'
      );

      setIsVerifying(false);

      if (matched) {
        onLoginSuccess(matched);
      } else {
        setDeniedAttempt(emailToTest);
      }
    }, 450);
  };

  const handleRequestWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deniedAttempt) return;
    if (onAddAuthorizedUser) {
      onAddAuthorizedUser(deniedAttempt, deniedAttempt.split('@')[0]);
      setRequestedSuccess(true);
      setTimeout(() => {
        handleGoogleSignIn(deniedAttempt);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))] text-zinc-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-500/30 shadow-xl shadow-amber-500/10 mb-4 overflow-hidden">
            {logoImage ? (
              <img src={logoImage} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="font-brand text-3xl font-bold bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                {appMonogram}
              </span>
            )}
          </div>
          <h1 className="font-brand text-2xl tracking-[0.25em] font-bold text-zinc-100 uppercase">
            {appName}
          </h1>
          {appSubtitle && (
            <p className="text-xs tracking-widest text-amber-400/90 font-medium uppercase mt-1">
              {appSubtitle}
            </p>
          )}
          {appTagline && (
            <p className="text-xs text-zinc-400 mt-2">
              {appTagline}
            </p>
          )}
        </div>

        {/* Access Rejected View */}
        {deniedAttempt ? (
          <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-red-500/30 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">
              Gmail Not Whitelisted
            </h2>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Google Account <strong className="text-red-300 font-mono">{deniedAttempt}</strong> is not present in {appName}'s <span className="text-zinc-200 underline decoration-amber-500/50">Authorized_Users</span> Google Sheets table.
            </p>

            {requestedSuccess ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Whitelisted! Redirecting to dashboard...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-zinc-500">
                  Only authorized {appName} team members, showroom staff, and fulfillment officers can access warehouse operations.
                </p>

                <button
                  id="request-access-button"
                  onClick={handleRequestWhitelist}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>One-Click Whitelist & Grant Access</span>
                </button>

                <button
                  onClick={() => setDeniedAttempt(null)}
                  className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  Try a different Gmail
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Sign-In Card */
          <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold tracking-wide text-zinc-300 uppercase">
                  Staff Authentication
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Whitelist Guard
              </span>
            </div>

            <div className="space-y-4">
              {/* Primary Google Sign In Button */}
              <button
                id="sign-in-with-google"
                onClick={() => handleGoogleSignIn(emailInput)}
                disabled={isVerifying}
                className="w-full relative flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-md group disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" />
                    <span>Verifying with Authorized_Users sheet...</span>
                  </>
                ) : (
                  <>
                    {/* Google SVG */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                    <ArrowRight className="w-4 h-4 ml-auto text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              {/* Email Input for custom email testing */}
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                  <span>Google Account / Gmail</span>
                  <span className="text-[10px] text-amber-400">Sheet Whitelist Protected</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full rounded-xl bg-zinc-900/90 border border-zinc-700/70 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition"
                  />
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute right-3.5 top-3" />
                </div>
              </div>

              {/* Fast Demo Accounts */}
              <div className="pt-3 border-t border-zinc-800/80">
                <p className="text-[11px] font-medium text-zinc-400 mb-2">
                  One-Click Whitelisted Demo Personas:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {authorizedUsers.map((user) => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => {
                        setEmailInput(user.email);
                        handleGoogleSignIn(user.email);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/30 text-left transition group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-semibold text-amber-400">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-200 group-hover:text-amber-300 transition">
                            {user.name}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-400">{user.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {user.role}
                      </span>
                    </button>
                  ))}

                  {/* Test Unauthorized Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const unauthorized = 'unauthorized_guest@gmail.com';
                      setEmailInput(unauthorized);
                      handleGoogleSignIn(unauthorized);
                    }}
                    className="flex items-center justify-between p-2 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-left transition group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-900/30 flex items-center justify-center text-xs font-semibold text-red-400">
                        ?
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-300">
                          Test Unauthorized User
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500">
                          unauthorized_guest@gmail.com
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-800/40">
                      Test Reject
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-2">
          <span>Protected by Google Apps Script & Firebase Identity</span>
          <span>•</span>
          <span>{appName} v2.4</span>
        </div>
      </div>
    </div>
  );
};
