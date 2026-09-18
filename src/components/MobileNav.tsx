import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Share2,
  ScanBarcode,
  Layers,
  Truck,
  Settings,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface MobileNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingOrdersCount: number;
  approvedDispatchCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  approvedDispatchCount,
}) => {
  const mobileItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders' as ActiveTab, label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount },
    { id: 'cogs' as ActiveTab, label: 'Cash & Vault', icon: Wallet },
    { id: 'dispatch' as ActiveTab, label: 'Dispatch', icon: ScanBarcode, badge: approvedDispatchCount },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all relative ${
              isActive ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-zinc-950 text-[9px] font-bold flex items-center justify-center px-0.5">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
