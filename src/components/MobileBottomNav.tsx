import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  Wallet,
  Menu,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { useLanguage } from '../contexts/LanguageContext';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleMenu: () => void;
  pendingOrdersCount: number;
  isMenuOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onToggleMenu,
  pendingOrdersCount,
  isMenuOpen,
}) => {
  const { t, isBangla } = useLanguage();

  const items = [
    {
      id: 'dashboard' as ActiveTab,
      label: isBangla ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'orders' as ActiveTab,
      label: isBangla ? 'অর্ডার' : 'Orders',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      id: 'social' as ActiveTab,
      label: isBangla ? 'ইনবক্স' : 'Inbox',
      icon: MessageSquare,
      badgeDot: true,
    },
    {
      id: 'cogs' as ActiveTab,
      label: isBangla ? 'ক্যাশ' : 'Cash',
      icon: Wallet,
    },
  ];

  return (
    <nav
      id="mobile-bottom-navbar"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-zinc-950/95 border-t border-zinc-800/90 backdrop-blur-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.6)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,8px))]"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 items-center gap-1 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !isMenuOpen;
          return (
            <button
              key={`mob-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90 relative ${
                isActive
                  ? 'text-amber-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : ''
                  }`}
                />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black flex items-center justify-center ring-2 ring-zinc-950">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {item.badgeDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-zinc-950" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 leading-none line-clamp-1">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Menu Toggle Button */}
        <button
          onClick={onToggleMenu}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90 ${
            isMenuOpen
              ? 'text-amber-400 font-bold'
              : 'text-zinc-400 hover:text-zinc-200 font-medium'
          }`}
          aria-label={isBangla ? 'সম্পূর্ণ মেনু' : 'All Menus'}
        >
          <div className="relative">
            <Menu
              className={`w-5 h-5 transition-transform ${
                isMenuOpen ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : ''
              }`}
            />
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none line-clamp-1">
            {isBangla ? 'মেনু' : 'Menu'}
          </span>
          {isMenuOpen && (
            <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
