import React, { useState, useEffect, useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import { BrandLogoManager } from './BrandLogoManager';
import { useSettings, ThemePreset, FontPreset } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Save,
  Sparkles,
  Moon,
  Sun,
  Type,
  Palette,
  Globe,
  CheckCircle2,
  Users,
  Shield,
  KeyRound,
  UserPlus,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  AlertCircle,
  X,
  CheckSquare,
  Square,
  Settings as SettingsIcon,
  Database,
  Crown,
  Mail,
  RotateCcw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { AuthUser } from '../types';

export const ALL_PAGES = [
  { key: 'dashboard', label: 'Business Dashboard' },
  { key: 'orders', label: 'Order Engine' },
  { key: 'cogs', label: 'Cash & Balance' },
  { key: 'integrations', label: 'Connect Channels' },
  { key: 'dispatch', label: 'Barcode Dispatch' },
  { key: 'inventory', label: 'Dual Inventory' },
  { key: 'reconciliation', label: 'Pathao Courier' },
  { key: 'crm', label: 'CRM & WhatsApp' },
  { key: 'ai', label: 'Veer (AI)' },
  { key: 'gas', label: 'GAS & DB Schema' },
  { key: 'settings', label: 'Settings' },
];

interface SettingsViewProps {
  currentUser?: AuthUser | null;
  token?: string | null;
  onOpenGasModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, token, onOpenGasModal }) => {
  const settings = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'access' | 'logo'>('general');

  const [formData, setFormData] = useState({
    appName: settings.appName,
    appMonogram: settings.appMonogram,
    appSubtitle: settings.appSubtitle,
    appTagline: settings.appTagline,
    themePreset: settings.themePreset,
    fontPreset: settings.fontPreset,
    logoImage: settings.logoImage,
  });

  // Access / Team Users state
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [resettingUser, setResettingUser] = useState<any | null>(null);

  // Add User Form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserDesignation, setNewUserDesignation] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Owner' | 'Admin' | 'Staff'>('Staff');
  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, boolean>>({
    dashboard: true,
    orders: true,
  });

  // Edit User Permissions Form
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editRole, setEditRole] = useState<'Owner' | 'Admin' | 'Staff'>('Staff');
  const [editDesignation, setEditDesignation] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Disabled'>('Active');

  // Reset Password Form
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const isAdminOrOwner = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';

  const fetchTeamUsers = async () => {
    if (!isAdminOrOwner) return;
    setIsLoadingUsers(true);
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeamUsers(data.users || []);
      }
    } catch (err) {
      console.warn('Failed to fetch team users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdminOrOwner && activeSettingsTab === 'access') {
      fetchTeamUsers();
    }
  }, [isAdminOrOwner, activeSettingsTab]);

  const handleSave = () => {
    settings.updateSettings(formData);
    setSaveToast(t('settings.languageSaved'));
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleLanguageChange = (lang: 'en' | 'bn') => {
    setLanguage(lang);
    setSaveToast(lang === 'bn' ? 'ভাষা পরিবর্তন সফল হয়েছে' : 'Language updated to English');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          role: newUserRole,
          permissions: newUserPermissions,
          designation: newUserDesignation,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create user');
      }
      setSaveToast('Team user created successfully.');
      setIsAddUserOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserDesignation('');
      setNewUserRole('Staff');
      fetchTeamUsers();
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}`,
        },
        body: JSON.stringify({
          name: editingUser.name,
          role: editRole,
          designation: editDesignation,
          permissions: editPermissions,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update user');
      }
      setSaveToast('User updated successfully.');
      setEditingUser(null);
      fetchTeamUsers();
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (newPasswordInput.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch(`/api/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}`,
        },
        body: JSON.stringify({ newPassword: newPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password');
      }
      setSaveToast('Password reset successfully.');
      setResettingUser(null);
      setNewPasswordInput('');
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete user');
      }
      setSaveToast('User deleted successfully.');
      fetchTeamUsers();
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete user');
    }
  };

  // Mother Gmail Change State (Requirement 3)
  const [isMotherModalOpen, setIsMotherModalOpen] = useState(false);
  const [motherOtpStep, setMotherOtpStep] = useState<'email' | 'otp'>('email');
  const [newMotherEmail, setNewMotherEmail] = useState('');
  const [motherOtpCode, setMotherOtpCode] = useState('');
  const [isMotherLoading, setIsMotherLoading] = useState(false);
  const [motherCooldown, setMotherCooldown] = useState<number>(0);
  const [motherDebugOtp, setMotherDebugOtp] = useState<string | null>(null);
  const [motherError, setMotherError] = useState<string | null>(null);

  useEffect(() => {
    if (motherCooldown <= 0) return;
    const t = setInterval(() => setMotherCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [motherCooldown]);

  const handleRequestMotherOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMotherError(null);
    const cleanEmail = newMotherEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMotherError('Please enter a valid new Mother Gmail address.');
      return;
    }
    if (cleanEmail === settings.motherGmail.toLowerCase()) {
      setMotherError('This is already the current Mother Gmail.');
      return;
    }

    setIsMotherLoading(true);
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch('/api/settings/mother-gmail/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch verification OTP.');
      }

      setMotherOtpStep('otp');
      setMotherCooldown(60);
      setMotherDebugOtp(data.debugOtp || null);
      setSaveToast(`OTP sent to current Mother Gmail (${data.currentMotherGmail || settings.motherGmail})`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setMotherError(err.message || 'Failed to send OTP.');
    } finally {
      setIsMotherLoading(false);
    }
  };

  const handleVerifyMotherChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMotherError(null);
    const cleanOtp = motherOtpCode.trim();
    if (cleanOtp.length !== 6) {
      setMotherError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsMotherLoading(true);
    try {
      const activeToken = token || localStorage.getItem('vistoosa_auth_token') || '';
      const res = await fetch('/api/settings/mother-gmail/verify-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken.replace(/^"|"$/g, '')}`,
        },
        body: JSON.stringify({
          newMotherGmail: newMotherEmail.trim().toLowerCase(),
          otpCode: cleanOtp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Verification failed.');
      }

      settings.updateMotherGmail(data.motherGmail || newMotherEmail.trim().toLowerCase());
      setIsMotherModalOpen(false);
      setSaveToast(`👑 Mother Gmail successfully updated to ${data.motherGmail || newMotherEmail}!`);
      setTimeout(() => setSaveToast(null), 4000);
      fetchTeamUsers();
    } catch (err: any) {
      setMotherError(err.message || 'Failed to transfer Mother Gmail ownership.');
    } finally {
      setIsMotherLoading(false);
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="text-amber-500" /> {t('settings.title')}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrOwner && (
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setActiveSettingsTab('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeSettingsTab === 'general'
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveSettingsTab('logo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeSettingsTab === 'logo'
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Logo & Branding
              </button>
              <button
                onClick={() => setActiveSettingsTab('access')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeSettingsTab === 'access'
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Access & Team
              </button>
            </div>
          )}
          {activeSettingsTab === 'general' && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20 text-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {t('settings.saveSettings')}
            </button>
          )}
        </div>
      </div>

      {saveToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeSettingsTab === 'general' ? (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-zinc-900/90 to-zinc-900/90 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">
                    {t('settings.languageSection')}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {t('settings.languageDescription')}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-semibold">
                {language === 'en' ? 'English' : 'বাংলা'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  language === 'en'
                    ? 'bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/10 text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold">English</p>
                  <p className="text-xs opacity-75">Standard ERP Terminology</p>
                </div>
                {language === 'en' && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('bn')}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  language === 'bn'
                    ? 'bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/10 text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold">বাংলা</p>
                  <p className="text-xs opacity-75">সম্পূর্ণ বাংলা ইন্টারফেস</p>
                </div>
                {language === 'bn' && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-zinc-800 space-y-6">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-500" /> Branding & Theme Presets
              </h3>
              <p className="text-xs text-zinc-400">
                Customize application colors, typography, and brand monogram.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">Application Name</label>
                <input
                  type="text"
                  value={formData.appName}
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">Monogram Letter</label>
                <input
                  type="text"
                  maxLength={3}
                  value={formData.appMonogram}
                  onChange={(e) => setFormData({ ...formData, appMonogram: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-3">Color Accent Preset</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, themePreset: theme.id })}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                      formData.themePreset === theme.id
                        ? 'bg-zinc-900 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-900'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${theme.colorClass} shrink-0`} />
                    <span className="text-xs font-medium text-zinc-200 text-left">{theme.name}</span>
                    {formData.themePreset === theme.id && <Sparkles className="w-3.5 h-3.5 ml-auto text-amber-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* GAS Integration Card */}
          <div className="p-6 rounded-2xl glass-panel border border-emerald-500/30 bg-emerald-900/10 space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-emerald-100 flex items-center gap-2">
                 <Database className="w-5 h-5 text-emerald-500" /> GAS & DB Schema
               </h3>
               <button
                 onClick={onOpenGasModal}
                 className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl text-xs transition"
               >
                 View Integration Panel
               </button>
             </div>
             <p className="text-xs text-emerald-400/80">
               Configure and manage your Google Apps Script database schema and endpoints.
             </p>
          </div>
        </div>
      ) : activeSettingsTab === 'logo' ? (
        <BrandLogoManager />
      ) : (
        <div className="space-y-6">
          {/* Mother Gmail Master Ownership Card (Requirement 3 & 4) */}
          <div className="p-6 rounded-2xl glass-panel border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-zinc-900/90 to-zinc-900/90 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-md shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {language === 'bn' ? '👑 মাদার জিমেইল (Master Account)' : '👑 Mother Gmail (Master Account)'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Root Owner
                    </span>
                  </div>
                  <p className="text-xs font-mono text-amber-400 font-semibold mt-1">
                    {settings.motherGmail}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-md">
                    {language === 'bn'
                      ? 'শুধুমাত্র এই মাদার জিমেইল সব API ইন্টিগ্রেশন এবং কোর সেটিংস এক্সেস করতে পারে। মাদার জিমেইল পরিবর্তন করতে বর্তমান জিমেইলে ওটিপি ভেরিফিকেশন কোড প্রয়োজন।'
                      : 'Only this Mother Gmail account has authority to access and configure API integrations. Changing Mother Gmail requires a 6-digit OTP sent to this address.'}
                  </p>
                </div>
              </div>

              {isAdminOrOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMotherModalOpen(true);
                    setMotherOtpStep('email');
                    setNewMotherEmail('');
                    setMotherOtpCode('');
                    setMotherDebugOtp(null);
                    setMotherError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer shrink-0"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{language === 'bn' ? 'মাদার জিমেইল পরিবর্তন করুন' : 'Change Mother Gmail'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-amber-500/30 bg-zinc-900/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" /> Team Access & Per-Page Permissions
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Create team accounts, assign roles (Owner / Staff), and configure precise module access permissions.
                </p>
              </div>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Add Team User
              </button>
            </div>

            {isLoadingUsers ? (
              <div className="py-12 text-center text-zinc-400 text-xs font-mono">Loading team accounts...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono">
                      <th className="py-3 px-4">Name & Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {teamUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-zinc-100">{u.name}</p>
                          {u.designation && <p className="text-[11px] text-amber-400 font-medium">💼 {u.designation}</p>}
                          <p className="text-[11px] text-zinc-400 font-mono">{u.email}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                              u.role === 'Owner'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                              u.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditRole(u.role);
                              setEditDesignation(u.designation || '');
                              setEditStatus(u.status);
                              setEditPermissions({ ...(u.permissions || {}) });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition cursor-pointer inline-flex items-center gap-1"
                            title="Edit Permissions"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Permissions
                          </button>
                          <button
                            onClick={() => {
                              setResettingUser(u);
                              setNewPasswordInput('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition cursor-pointer inline-flex items-center gap-1"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-blue-400" /> Password
                          </button>
                          {u.email !== currentUser?.email && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer inline-flex items-center"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" /> Add New Team Member
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Rahim Ahmed"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address (Login ID)</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="staff@vistoosa.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Password (Min 8 Characters)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Designation / পদবী</label>
                <input
                  type="text"
                  value={newUserDesignation}
                  onChange={(e) => setNewUserDesignation(e.target.value)}
                  placeholder="e.g. Operations Specialist / Executive Admin"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Role / পদবী বা রোল (Manually Typed)</label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g. Managing Director / Admin / Staff"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Per-Page Permissions (Manual Access)</label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all: Record<string, boolean> = {};
                        ALL_PAGES.forEach((p) => (all[p.key] = true));
                        setNewUserPermissions(all);
                      }}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserPermissions({})}
                      className="text-[11px] text-zinc-400 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
                  {ALL_PAGES.map((page) => (
                    <label
                      key={page.key}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer text-xs text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={!!newUserPermissions[page.key]}
                        onChange={(e) =>
                          setNewUserPermissions({ ...newUserPermissions, [page.key]: e.target.checked })
                        }
                        className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 w-4 h-4 bg-zinc-950"
                      />
                      <span>{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold text-xs shadow-lg hover:from-amber-400 hover:to-amber-500 transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" /> Edit Permissions: {editingUser.name}
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUserSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Designation / পদবী</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Operations Manager"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Role / পদবী (Manually Typed)</label>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      placeholder="e.g. Managing Director / Admin"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Account Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled (Blocked)</option>
                    </select>
                  </div>
                </div>
              </div>

              {editRole.toLowerCase() !== 'owner' ? (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Per-Page Permissions (Manual Access)</label>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          ALL_PAGES.forEach((p) => (all[p.key] = true));
                          setEditPermissions(all);
                        }}
                        className="text-[11px] text-amber-400 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPermissions({})}
                        className="text-[11px] text-zinc-400 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
                    {ALL_PAGES.map((page) => (
                      <label
                        key={page.key}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer text-xs text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          checked={!!editPermissions[page.key]}
                          onChange={(e) =>
                            setEditPermissions({ ...editPermissions, [page.key]: e.target.checked })
                          }
                          className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 w-4 h-4 bg-zinc-950"
                        />
                        <span>{page.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  👑 Owners have full administrative access to all pages and settings.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold text-xs shadow-lg hover:from-amber-400 hover:to-amber-500 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resettingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" /> Reset Password
              </h3>
              <button onClick={() => setResettingUser(null)} className="text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Set a new temporary password for <span className="text-zinc-200 font-bold">{resettingUser.name}</span> (min 8 characters).
            </p>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <input
                type="password"
                required
                minLength={8}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mother Gmail OTP Change Modal (Requirement 3) */}
      {isMotherModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-zinc-100">
                  {language === 'bn' ? 'মাদার জিমেইল পরিবর্তন করুন' : 'Change Mother Gmail'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMotherModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {motherError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{motherError}</span>
              </div>
            )}

            {motherOtpStep === 'email' ? (
              <form onSubmit={handleRequestMotherOtp} className="space-y-4">
                <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <p className="text-[11px] text-zinc-400">Current Mother Gmail:</p>
                  <p className="text-xs font-mono font-bold text-amber-400">{settings.motherGmail}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {language === 'bn' ? 'নতুন মাদার জিমেইল এড্রেস' : 'New Mother Gmail Address'}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={newMotherEmail}
                      onChange={(e) => setNewMotherEmail(e.target.value)}
                      placeholder="new.owner@gmail.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1.5">
                    {language === 'bn'
                      ? 'বর্তমান মাদার জিমেইলে একটি ৬-সংখ্যার ওটিপি কোড পাঠানো হবে।'
                      : 'A 6-digit OTP will be dispatched to current Mother Gmail to authorize transfer.'}
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMotherModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMotherLoading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isMotherLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>{language === 'bn' ? 'ওটিপি কোড পাঠান' : 'Send Verification OTP'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyMotherChange} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1 text-center">
                  <p className="text-[11px] text-zinc-400">
                    OTP sent to current: <strong className="text-amber-300 font-mono">{settings.motherGmail}</strong>
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    New Target Owner: <strong className="text-emerald-400 font-mono">{newMotherEmail}</strong>
                  </p>
                </div>

                {motherDebugOtp && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1 text-center">
                    <p className="text-[11px] text-zinc-300">
                      Preview Verification OTP:{' '}
                      <strong className="font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 text-sm">
                        {motherDebugOtp}
                      </strong>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2 text-center">
                    {language === 'bn' ? '৬-ডিজিট ওটিপি কোড লিখুন' : 'Enter 6-Digit OTP Code'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={motherOtpCode}
                    onChange={(e) => setMotherOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full rounded-2xl bg-zinc-900 border border-amber-500/50 py-3 text-center text-2xl font-bold tracking-[0.4em] font-mono text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (motherCooldown <= 0) {
                        handleRequestMotherOtp({ preventDefault: () => {} } as any);
                      }
                    }}
                    disabled={motherCooldown > 0 || isMotherLoading}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1.5 disabled:text-zinc-600 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {motherCooldown > 0 ? `Resend OTP (${motherCooldown}s)` : 'Resend OTP'}
                    </span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMotherOtpStep('email')}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isMotherLoading || motherOtpCode.length !== 6}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isMotherLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>{language === 'bn' ? 'মালিকানা হস্তান্তর করুন' : 'Confirm Transfer'}</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
