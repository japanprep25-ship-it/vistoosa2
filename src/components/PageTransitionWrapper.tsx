import React, { useEffect, useState } from 'react';

interface PageTransitionWrapperProps {
  activeTab: string;
  children: React.ReactNode;
}

const TAB_METADATA: Record<string, { title: string; badge: string; color: string }> = {
  dashboard: {
    title: 'Business Intelligence & Executive Analytics',
    badge: 'LIVE METRICS ACTIVE',
    color: 'from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 text-amber-400',
  },
  orders: {
    title: 'Unified Order Engine & Real-Time Queue',
    badge: 'ORDER LEDGER SYNCED',
    color: 'from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/40 text-blue-400',
  },
  integrations: {
    title: 'Connect Channels & Webhook Integrations',
    badge: 'API MATRIX ONLINE',
    color: 'from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/40 text-emerald-400',
  },
  dispatch: {
    title: 'Warehouse Courier Dispatch & Scanner Hub',
    badge: 'DISPATCH SCANNER READY',
    color: 'from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/40 text-cyan-400',
  },
  inventory: {
    title: 'Warehouse Inventory & Stock SKU Control',
    badge: 'STOCK LEDGER UPDATED',
    color: 'from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/40 text-purple-400',
  },
  reconciliation: {
    title: 'Courier Payout & COGS Financial Reconciliation',
    badge: 'AUDIT BALANCE VERIFIED',
    color: 'from-amber-400/20 via-yellow-500/10 to-transparent border-amber-400/40 text-amber-300',
  },
  crm: {
    title: 'Customer Intelligence & VIP Retention CRM',
    badge: 'CUSTOMER RADAR ACTIVE',
    color: 'from-rose-500/20 via-pink-500/10 to-transparent border-rose-500/40 text-rose-400',
  },
  cogs: {
    title: 'Cash Register, Petty Cash & Daily Expenses',
    badge: 'CASH VAULT OPEN',
    color: 'from-emerald-400/20 via-teal-500/10 to-transparent border-emerald-400/40 text-emerald-300',
  },
  ai: {
    title: 'Veer AI Fashion Agent & Order Parser',
    badge: 'NEURAL AGENT READY',
    color: 'from-purple-400/20 via-amber-500/10 to-transparent border-purple-400/40 text-purple-300',
  },
  gas: {
    title: 'Google Apps Script & Database Schema',
    badge: 'SHEETS DB CONNECTED',
    color: 'from-teal-500/20 via-emerald-500/10 to-transparent border-teal-500/40 text-teal-400',
  },
  settings: {
    title: 'System Preferences & Brand Customization',
    badge: 'GLOBAL CONFIG SYNCED',
    color: 'from-zinc-500/20 via-zinc-500/10 to-transparent border-zinc-500/40 text-zinc-300',
  },
};

export const PageTransitionWrapper: React.FC<PageTransitionWrapperProps> = ({ activeTab, children }) => {
  const [animationClass, setAnimationClass] = useState<string>('page-transition-enter');
  const [showPulseBanner, setShowPulseBanner] = useState<boolean>(true);

  const meta = TAB_METADATA[activeTab] || {
    title: 'Vistoosa Workspace',
    badge: 'SYSTEM SYNCED',
    color: 'from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 text-amber-400',
  };

  useEffect(() => {
    // Set specific transition animation class per tab
    setAnimationClass(`page-anim-${activeTab}`);
    setShowPulseBanner(true);

    const timer = setTimeout(() => {
      setShowPulseBanner(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <div className={`relative w-full transition-all duration-500 ease-out ${animationClass}`}>
      {/* High-End Contextual Analytics Transition Indicator */}
      {showPulseBanner && (
        <div className="mb-4 p-2.5 px-4 rounded-xl bg-gradient-to-r border backdrop-blur-md flex items-center justify-between text-xs font-semibold animate-pulse shadow-xl transition-all">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full animate-ping bg-current ${meta.color.split(' ').pop()}`} />
            <span className="text-zinc-200 font-bold">{meta.title}</span>
          </div>
          <span className={`text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full border bg-black/40 ${meta.color}`}>
            {meta.badge}
          </span>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="w-full">{children}</div>
    </div>
  );
};
