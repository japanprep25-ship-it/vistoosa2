import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  ScanBarcode,
  Layers,
  Truck,
  Users,
  Wallet,
  Bot,
  Database,
  ShieldCheck,
  Share2,
  Settings,
  X,
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';

export type ActiveTab =
  | 'dashboard'
  | 'orders'
  | 'dispatch'
  | 'inventory'
  | 'reconciliation'
  | 'cogs'
  | 'integrations'
  | 'crm'
  | 'ai'
  | 'gas'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingOrdersCount: number;
  approvedDispatchCount: number;
  discrepancyCount: number;
  isOpen?: boolean;
  onClose?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  approvedDispatchCount,
  discrepancyCount,
  isOpen,
  onClose,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isDrawerOpen = isOpen !== undefined ? isOpen : (isOpenMobile || false);
  const handleClose = onClose || onCloseMobile;
  const { appName, appMonogram } = useSettings();
  const { t } = useLanguage();

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen && handleClose) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, handleClose]);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: t('nav.dashboard'),
      description: 'Revenue, Profit & Cash',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'orders' as ActiveTab,
      label: t('nav.orders'),
      description: 'Multi-Channel Queues',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount}` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'cogs' as ActiveTab,
      label: t('nav.cash'),
      description: 'Vault & COGS Engine',
      icon: Wallet,
      badge: '৳ Live',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'integrations' as ActiveTab,
      label: t('nav.integrations'),
      description: 'Website, Pathao & FB Ads',
      icon: Share2,
      badge: 'API Hub',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'dispatch' as ActiveTab,
      label: t('nav.dispatch'),
      description: 'Live Queue & Override',
      icon: ScanBarcode,
      badge: approvedDispatchCount > 0 ? `${approvedDispatchCount}` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'inventory' as ActiveTab,
      label: t('nav.inventory'),
      description: 'Reserved vs Warehouse',
      icon: Layers,
    },
    {
      id: 'reconciliation' as ActiveTab,
      label: t('nav.reconciliation'),
      description: '1-Tk Discrepancy Matcher',
      icon: Truck,
      badge: discrepancyCount > 0 ? `${discrepancyCount}` : undefined,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    },
    {
      id: 'crm' as ActiveTab,
      label: t('nav.crm'),
      description: 'VIP vs Inactive Churn',
      icon: Users,
    },
    {
      id: 'ai' as ActiveTab,
      label: t('nav.ai'),
      description: 'Bengali Typo & Parser',
      icon: Bot,
    },
    {
      id: 'gas' as ActiveTab,
      label: t('nav.gas'),
      description: 'Google Sheets Backend',
      icon: Database,
    },
    {
      id: 'settings' as ActiveTab,
      label: t('nav.settings'),
      description: 'Language & Theme',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* 1. Backdrop Overlay (Universal) */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 2. Slide-in Navigation Drawer (Universal) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-800/90 backdrop-blur-2xl flex flex-col p-4 shadow-2xl transition-transform duration-300 ease-in-out h-full overflow-hidden ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shadow-md shadow-amber-500/5">
              {appMonogram}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 font-brand">
                {appName}
              </h2>
              <p className="text-[10px] text-amber-400/80 font-medium">Operations Menu</p>
            </div>
          </div>
          {handleClose && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 active:scale-95 transition cursor-pointer"
              aria-label="Close menu"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Drawer Nav Items */}
        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={`drawer-${item.id}`}
                id={`drawer-nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (handleClose) handleClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{item.label}</p>
                    <p className="text-[10px] text-zinc-500 leading-tight">{item.description}</p>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer Footnote */}
        <div className="p-3 mt-auto rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] shrink-0">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">All Systems Operational</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-snug">
            {appName} Systems Active
          </p>
        </div>
      </aside>
    </>
  );
};
