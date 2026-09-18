import React from 'react';
import { LogOut, Database, Sparkles, Moon, Sun, Menu, X } from 'lucide-react';
import { AuthUser } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useSettings } from '../contexts/SettingsContext';

interface NavbarProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenGasModal: () => void;
  onOpenAiDrawer: () => void;
  pendingOrdersCount: number;
  approvedDispatchCount: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onOpenGasModal,
  onOpenAiDrawer,
  pendingOrdersCount,
  approvedDispatchCount,
  isDarkMode = true,
  onToggleDarkMode,
  onToggleSidebar,
  isSidebarOpen = false,
}) => {
  const { appName, appMonogram, appSubtitle, appTagline, logoImage } = useSettings();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl px-3 sm:px-4 py-2.5 transition-colors shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Hamburger Menu (☰) & Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Clean Hamburger Icon Button (☰) */}
          <button
            id="navbar-hamburger-btn"
            onClick={onToggleSidebar}
            className="w-9 h-9 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 hover:from-zinc-750 hover:to-zinc-850 text-amber-400 hover:text-amber-300 border border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-500/10 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shrink-0"
            aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation (☰)'}
            title={isSidebarOpen ? 'Close navigation' : 'Open navigation (☰)'}
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-amber-400" />
            ) : (
              <Menu className="w-5 h-5 text-amber-400" />
            )}
          </button>

          <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5 overflow-hidden">
            {logoImage ? (
              <img src={logoImage} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="font-brand text-xl font-bold bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                {appMonogram}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-brand text-sm font-bold tracking-[0.2em] text-zinc-100 uppercase">
                {appName}
              </span>
              {appSubtitle && (
                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold tracking-wider uppercase">
                  {appSubtitle}
                </span>
              )}
            </div>
            {appTagline && (
              <p className="text-[10px] text-zinc-400 font-medium">
                {appTagline}
              </p>
            )}
          </div>
        </div>

        {/* Center: Live Quick Indicators */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-zinc-400">Pending Orders:</span>
            <span className="font-semibold text-amber-300">{pendingOrdersCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">Ready to Pack:</span>
            <span className="font-semibold text-emerald-300">{approvedDispatchCount}</span>
          </div>
        </div>

        {/* Right: Actions, PWA Button, AI Assistant, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Quick AI Assistant Trigger */}
          <button
            id="navbar-ai-assistant-btn"
            onClick={onOpenAiDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-amber-500/20 hover:from-purple-500/30 hover:to-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium active:scale-95 transition"
            title="Open Veer (Vistoosa AI Fashion Agent)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="hidden sm:inline">Veer (AI)</span>
          </button>

          {/* Google Sheets GAS Code & Webhook Connection */}
          <button
            id="navbar-gas-modal-btn"
            onClick={onOpenGasModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-medium active:scale-95 transition"
            title="Google Apps Script & Database Schema"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>GAS API & Schema</span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-300" />}
          </button>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-zinc-200 leading-tight">{user.name}</p>
              <p className="text-[10px] text-amber-400 font-mono">{user.role}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-amber-400">
              {user.name.charAt(0)}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
