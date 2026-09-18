import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  ScanBarcode,
  Menu,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface MobileNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingOrdersCount: number;
  approvedDispatchCount: number;
  onOpenDrawer?: () => void;
  isDrawerOpen?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  approvedDispatchCount,
  onOpenDrawer,
  isDrawerOpen = false,
}) => {
  const mobileItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders' as ActiveTab, label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount },
    { id: 'cogs' as ActiveTab, label: 'Cash', icon: Wallet },
    { id: 'dispatch' as ActiveTab, label: 'Dispatch', icon: ScanBarcode, badge: approvedDispatchCount },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id && !isDrawerOpen;
        return (
          <button
            key={item.id}
            id={`bottom-nav-${item.id}`}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all relative ${
              isActive ? 'text-amber-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-zinc-950 text-[9px] font-bold flex items-center justify-center px-0.5 shadow-sm">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
          </button>
        );
      })}

      {/* Menu / Drawer Trigger Button */}
      {onOpenDrawer && (
        <button
          id="bottom-nav-menu-btn"
          onClick={onOpenDrawer}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all relative ${
            isDrawerOpen ? 'text-amber-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          aria-label="Open operations menu"
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">Menu (☰)</span>
        </button>
      )}
    </nav>
  );
};
