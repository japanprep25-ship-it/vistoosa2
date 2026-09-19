import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  ArrowLeft,
  Key,
  Globe,
} from 'lucide-react';
import { AuthUser } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot_password';
type AuthStep = 'credentials' | 'otp_verify' | 'request_reset' | 'verify_reset_otp' | 'new_password';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const { appName, appMonogram, appSubtitle, appTagline, logoImage } = useSettings();
  const { setLanguage, t, isBangla } = useLanguage();

  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('credentials');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP metadata
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cooldown countdown timer for Resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Step 1: Login or Signup Password Submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.validEmailReq'));
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage(t('auth.passwordMinLength'));
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? { email: cleanEmail, password, name: name.trim() || undefined }
          : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid email or password');
      }

      if (mode === 'signup') {
        // Account created! Switch to Login mode so user signs in
        setMode('login');
        setPassword('');
        setSuccessMessage(t('auth.signupSuccessMsg'));
      } else if (data.token && data.user) {
        setSuccessMessage(t('auth.loginSuccessMsg'));
        setTimeout(() => {
          onLoginSuccess(
            {
              email: data.user.email,
              name: data.user.name,
              role: data.user.role || 'Admin',
              status: 'Active',
            },
            data.token
          );
        }, 400);
      } else if (data.requiresOtp) {
        setStep('otp_verify');
        setOtpCode('');
        setDebugOtp(data.debugOtp || null);
        setResendCooldown(60);
        setSuccessMessage(`${t('auth.otpSentMsg')} (${cleanEmail}).`);
      }
    } catch (err: any) {
      console.error('Auth Credentials Error:', err);
      setErrorMessage(err?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Verify Login / Signup OTP
  const handleOtpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage(t('auth.enter6DigitOtpErr'));
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/verify-signup-otp' : '/api/auth/verify-login-otp';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otpCode: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired OTP');
      }

      setSuccessMessage(t('auth.otpVerifiedMsg'));

      setTimeout(() => {
        onLoginSuccess(
          {
            email: data.user.email,
            name: data.user.name,
            role: data.user.role || 'Admin',
            status: 'Active',
          },
          data.token
        );
      }, 500);
    } catch (err: any) {
      console.error('OTP Verification Error:', err);
      setErrorMessage(err?.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Step 1: Request Reset OTP
  const handleRequestResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.validEmailReq'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/request-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No account found with this email address');
      }

      setStep('verify_reset_otp');
      setOtpCode('');
      setDebugOtp(data.debugOtp || null);
      setResendCooldown(60);
      setSuccessMessage(`${t('auth.otpSentMsg')} (${cleanEmail}).`);
    } catch (err: any) {
      console.error('Request Reset Error:', err);
      setErrorMessage(err?.message || 'Failed to send password reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Step 2: Verify Reset OTP
  const handleVerifyResetOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage(t('auth.enter6DigitOtpErr'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otpCode: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired OTP');
      }

      setStep('new_password');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(t('auth.otpVerifiedMsg'));
    } catch (err: any) {
      console.error('Verify Reset OTP Error:', err);
      setErrorMessage(err?.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Step 3: Set New Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage(t('auth.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccessMessage(t('auth.passwordResetSuccessMsg'));

      setTimeout(() => {
        onLoginSuccess(
          {
            email: data.user.email,
            name: data.user.name,
            role: data.user.role || 'Admin',
            status: 'Active',
          },
          data.token
        );
      }, 800);
    } catch (err: any) {
      console.error('Reset Password Error:', err);
      setErrorMessage(err?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const otpType = mode === 'forgot_password' ? 'forgot_password' : mode;
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: otpType }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend OTP');
      }

      setDebugOtp(data.debugOtp || null);
      setResendCooldown(60);
      setSuccessMessage(t('auth.otpSentMsg'));
    } catch (err: any) {
      console.error('Resend OTP Error:', err);
      setErrorMessage(err?.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToMode = (newMode: AuthMode) => {
    setMode(newMode);
    setStep(newMode === 'forgot_password' ? 'request_reset' : 'credentials');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpCode('');
    setDebugOtp(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))] text-zinc-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-500/30 shadow-xl shadow-amber-500/10 mb-3 overflow-hidden">
            {logoImage ? (
              <img src={logoImage} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="font-brand text-3xl font-bold bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                {appMonogram}
              </span>
            )}
          </div>
          <h1 className="font-brand text-2xl tracking-[0.2em] font-bold text-zinc-100 uppercase">
            {appName}
          </h1>
          {appSubtitle && (
            <p className="text-xs tracking-widest text-amber-400/90 font-medium uppercase mt-1">
              {appSubtitle}
            </p>
          )}
          {appTagline && <p className="text-xs text-zinc-400 mt-1.5">{appTagline}</p>}
        </div>

        {/* Main Auth Box */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-zinc-800/80 bg-zinc-900/90 backdrop-blur-xl relative overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800/80">
            <div className="pr-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>
                  {mode === 'forgot_password'
                    ? t('auth.forgotPasswordTitle')
                    : mode === 'login'
                    ? step === 'otp_verify'
                      ? t('auth.otpLoginTitle')
                      : t('auth.loginTitle')
                    : step === 'otp_verify'
                    ? t('auth.otpVerifyTitle')
                    : t('auth.signupTitle')}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {step === 'otp_verify' || step === 'verify_reset_otp'
                  ? `${t('auth.otpVerifySubtitle')} (${email})`
                  : step === 'new_password'
                  ? t('auth.newPasswordSubtitle')
                  : mode === 'forgot_password'
                  ? t('auth.forgotPasswordSubtitle')
                  : mode === 'login'
                  ? t('auth.loginSubtitle')
                  : t('auth.signupSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Language Toggle Button */}
              <button
                type="button"
                onClick={() => setLanguage(isBangla ? 'en' : 'bn')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-amber-500/40 text-amber-300 font-semibold text-xs transition cursor-pointer shadow-sm hover:border-amber-400"
                title={isBangla ? 'Switch to English' : 'বাংলা ভাষায় পরিবর্তন করুন'}
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>{isBangla ? 'English' : 'বাংলা'}</span>
              </button>

              {/* Back Button if in OTP or Reset Mode */}
              {(step !== 'credentials' || mode === 'forgot_password') && (
                <button
                  type="button"
                  onClick={() => resetToMode('login')}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  title="Back to Login"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('auth.back')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
              {mode === 'login' && step === 'credentials' && (
                <button
                  type="button"
                  onClick={() => resetToMode('signup')}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-[11px] shrink-0 transition cursor-pointer"
                >
                  {t('auth.signUpLink')}
                </button>
              )}
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Fallback OTP Banner for Instant Testing in Preview Mode */}
          {debugOtp && (step === 'otp_verify' || step === 'verify_reset_otp') && (
            <div className="p-3 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Studio Preview Demo Code:</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                GMAIL credentials not detected in .env. Your OTP verification code is:{' '}
                <strong className="font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 text-sm">
                  {debugOtp}
                </strong>
              </p>
            </div>
          )}

          {/* FORM TYPE 1: EMAIL + PASSWORD (STEP 1 LOGIN & SIGNUP) */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {/* Full Name field (Only on Sign Up) */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {t('auth.fullName')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Asif Mahmud"
                      className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition"
                    />
                    <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {t('auth.emailAddress')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition font-mono"
                  />
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    {t('auth.password')}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => resetToMode('forgot_password')}
                      className="text-[11px] text-amber-400 hover:underline font-medium cursor-pointer"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition font-mono"
                  />
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{t('auth.verifying')}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {mode === 'signup'
                        ? t('auth.signUpBtn')
                        : t('auth.signInBtn')}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM TYPE 2: 2FA OTP CODE ENTRY (STEP 2 LOGIN & SIGNUP) */}
          {step === 'otp_verify' && (
            <form onSubmit={handleOtpVerifySubmit} className="space-y-5">
              <div className="text-center p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800">
                <p className="text-xs text-zinc-300">
                  {t('auth.emailAddress')}: <strong className="text-amber-300 font-mono">{email}</strong>
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t('auth.otpVerifySubtitle')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2 text-center">
                  {t('auth.otpCodeLabel')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full rounded-2xl bg-zinc-950 border border-amber-500/50 py-3 text-center text-2xl font-bold tracking-[0.4em] font-mono text-amber-400 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{t('auth.verifying')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('auth.verifyAndLoginBtn')}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>

              {/* Resend OTP Action */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-xs text-amber-400 hover:underline font-semibold disabled:text-zinc-600 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resendCooldown > 0
                    ? `${t('auth.resendOtpIn')} ${resendCooldown}s`
                    : t('auth.resendOtp')}
                </button>
              </div>
            </form>
          )}

          {/* FORM TYPE 3: FORGOT PASSWORD STEP 1 (REQUEST RESET OTP) */}
          {mode === 'forgot_password' && step === 'request_reset' && (
            <form onSubmit={handleRequestResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {t('auth.emailAddress')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition font-mono"
                  />
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{t('auth.sending')}</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>{t('auth.sendResetOtpBtn')}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM TYPE 4: FORGOT PASSWORD STEP 2 (VERIFY RESET OTP) */}
          {mode === 'forgot_password' && step === 'verify_reset_otp' && (
            <form onSubmit={handleVerifyResetOtpSubmit} className="space-y-5">
              <div className="text-center p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800">
                <p className="text-xs text-zinc-300">
                  {t('auth.emailAddress')}: <strong className="text-amber-300 font-mono">{email}</strong>
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t('auth.otpVerifySubtitle')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2 text-center">
                  {t('auth.otpCodeLabel')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full rounded-2xl bg-zinc-950 border border-amber-500/50 py-3 text-center text-2xl font-bold tracking-[0.4em] font-mono text-amber-400 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{t('auth.verifying')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('auth.verifyAndLoginBtn')}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-xs text-amber-400 hover:underline font-semibold disabled:text-zinc-600 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resendCooldown > 0
                    ? `${t('auth.resendOtpIn')} ${resendCooldown}s`
                    : t('auth.resendOtp')}
                </button>
              </div>
            </form>
          )}

          {/* FORM TYPE 5: FORGOT PASSWORD STEP 3 (NEW PASSWORD FORM) */}
          {mode === 'forgot_password' && step === 'new_password' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {t('auth.newPassword')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition font-mono"
                  />
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {t('auth.confirmPassword')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition font-mono"
                  />
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{t('auth.saving')}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{t('auth.saveNewPasswordBtn')}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Navigation Link */}
          {step === 'credentials' && mode !== 'forgot_password' && (
            <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
              {mode === 'login' ? (
                <p className="text-xs text-zinc-400">
                  {t('auth.newHere')}{' '}
                  <button
                    type="button"
                    onClick={() => resetToMode('signup')}
                    className="text-amber-400 font-semibold hover:underline cursor-pointer ml-1"
                  >
                    {t('auth.signUpLink')}
                  </button>
                </p>
              ) : (
                <p className="text-xs text-zinc-400">
                  {t('auth.alreadyHaveAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => resetToMode('login')}
                    className="text-amber-400 font-semibold hover:underline cursor-pointer ml-1"
                  >
                    {t('auth.logInLink')}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Demo Admin Card Footer */}
        <div className="mt-5 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-1.5">
          <p className="text-[11px] text-zinc-400 font-medium">
            💡 {t('auth.demoAccount')}
          </p>
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-amber-300 bg-zinc-950/80 py-1.5 px-3 rounded-xl border border-zinc-800 inline-flex">
            <span>japanprep25@gmail.com</span>
            <span className="text-zinc-600">|</span>
            <span>Password: password123</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-zinc-500">
          Secured with Bcrypt, Nodemailer 2FA OTP & JWT Auth Token • {appName} ERP v2.5
        </div>
      </div>
    </div>
  );
};
