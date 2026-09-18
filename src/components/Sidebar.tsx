import React from 'react';
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
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  approvedDispatchCount,
  discrepancyCount,
}) => {
  const { appName } = useSettings();

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Business Dashboard',
      description: 'Revenue, Profit & Cash',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'orders' as ActiveTab,
      label: 'Order Engine',
      description: 'Multi-Channel Queues',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount}` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'cogs' as ActiveTab,
      label: 'Cash & Balance',
      description: 'Vault & COGS Engine',
      icon: Wallet,
      badge: '৳ Live',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'integrations' as ActiveTab,
      label: 'Connect Channels',
      description: 'Website, Pathao & FB Ads',
      icon: Share2,
      badge: 'API Hub',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'dispatch' as ActiveTab,
      label: 'Barcode Dispatch',
      description: 'Live Queue & Override',
      icon: ScanBarcode,
      badge: approvedDispatchCount > 0 ? `${approvedDispatchCount} ready` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Dual Inventory',
      description: 'Reserved vs Warehouse',
      icon: Layers,
    },
    {
      id: 'reconciliation' as ActiveTab,
      label: 'Pathao Courier',
      description: '1-Tk Discrepancy Matcher',
      icon: Truck,
      badge: discrepancyCount > 0 ? `${discrepancyCount} alert` : undefined,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    },
    {
      id: 'crm' as ActiveTab,
      label: 'CRM & WhatsApp',
      description: 'VIP vs Inactive Churn',
      icon: Users,
    },
    {
      id: 'ai' as ActiveTab,
      label: 'Veer (AI Fashion Agent)',
      description: 'Bengali Typo & Parser',
      icon: Bot,
    },
    {
      id: 'gas' as ActiveTab,
      label: 'GAS & DB Schema',
      description: 'Google Sheets Backend',
      icon: Database,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      description: 'Theme & Customization',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl p-3 h-[calc(100vh-57px)] sticky top-[57px]">
      <div className="px-3 py-2 mb-2">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {appName} Operations
        </p>
      </div>

      <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-300'
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

      {/* System Status Footnote */}
      <div className="p-3 mt-auto rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-[11px]">
        <div className="flex items-center gap-2 text-emerald-400 mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-semibold">All Systems Operational</span>
        </div>
        <p className="text-[10px] text-zinc-400 leading-snug">
          {appName} Systems Active
        </p>
      </div>
    </aside>
  );
};
