// navigationRouter.ts
// -----------------------------------------------------------------------
// Hash-based URL Routing & Navigation State Persistence Engine
// Supports URL hashes (#/order-engine, #/connect-channels/facebook, etc.),
// browser back/forward buttons, localStorage persistence, and sub-tabs.

import { ActiveTab } from '../components/Sidebar';

export type { ActiveTab };

export type IntegrationsSubTab = 'website' | 'pathao' | 'meta' | 'gas' | 'whatsapp';
export type CashRegisterSubTab = 'register' | 'shipments' | 'expenses';

export interface NavigationState {
  tab: ActiveTab;
  subTab?: string;
  isValid: boolean;
}

// Canonical URL hash slugs for each section
export const CANONICAL_SLUGS: Record<ActiveTab, string> = {
  dashboard: 'dashboard',
  orders: 'order-engine',
  cogs: 'cash-balance',
  integrations: 'connect-channels',
  dispatch: 'barcode-dispatch',
  inventory: 'dual-inventory',
  reconciliation: 'pathao-courier',
  crm: 'crm',
  ai: 'veer-ai',
  gas: 'gas-schema',
  settings: 'settings',
};

// Aliases mapping incoming URLs to the corresponding ActiveTab
export const TAB_ALIASES: Record<string, ActiveTab> = {
  // Dashboard
  'dashboard': 'dashboard',
  'home': 'dashboard',
  'main': 'dashboard',
  '': 'dashboard',

  // Order Engine
  'order-engine': 'orders',
  'orders': 'orders',
  'order': 'orders',

  // Cash & Balance (COGS)
  'cash-balance': 'cogs',
  'cogs': 'cogs',
  'cash': 'cogs',
  'cash-register': 'cogs',
  'register': 'cogs',
  'ledger': 'cogs',

  // Connect Channels (Integrations)
  'connect-channels': 'integrations',
  'integrations': 'integrations',
  'channels': 'integrations',
  'integration-hub': 'integrations',
  'integrations-hub': 'integrations',

  // Barcode Dispatch
  'barcode-dispatch': 'dispatch',
  'dispatch': 'dispatch',
  'scanner': 'dispatch',
  'dispatch-scanner': 'dispatch',

  // Dual Inventory
  'dual-inventory': 'inventory',
  'inventory': 'inventory',
  'stock': 'inventory',
  'warehouse': 'inventory',

  // Pathao Courier & Reconciliation
  'pathao-courier': 'reconciliation',
  'reconciliation': 'reconciliation',
  'courier': 'reconciliation',
  'payouts': 'reconciliation',
  'pathao': 'reconciliation',

  // CRM & WhatsApp
  'crm': 'crm',
  'crm-whatsapp': 'crm',
  'customers': 'crm',

  // Veer AI
  'veer-ai': 'ai',
  'ai': 'ai',
  'assistant': 'ai',
  'veer': 'ai',

  // GAS & DB Schema
  'gas-schema': 'gas',
  'gas': 'gas',
  'sheets': 'gas',
  'database': 'gas',
  'google-sheets': 'gas',

  // Settings
  'settings': 'settings',
  'preferences': 'settings',
  'config': 'settings',
};

// Sub-tab mappings for Connect Channels
export const INTEGRATIONS_SUBTAB_ALIASES: Record<string, IntegrationsSubTab> = {
  'facebook': 'meta',
  'meta': 'meta',
  'fb': 'meta',
  'instagram': 'meta',
  'ads': 'meta',
  'website': 'website',
  'web': 'website',
  'store': 'website',
  'woocommerce': 'website',
  'whatsapp': 'whatsapp',
  'wa': 'whatsapp',
  'pathao': 'pathao',
  'courier': 'pathao',
  'gas': 'gas',
  'sheets': 'gas',
  'google-sheets': 'gas',
  'database': 'gas',
};

// Sub-tab mappings for Cash & Balance
export const CASH_SUBTAB_ALIASES: Record<string, CashRegisterSubTab> = {
  'register': 'register',
  'vault': 'register',
  'cash': 'register',
  'shipments': 'shipments',
  'shipping': 'shipments',
  'expenses': 'expenses',
  'expense': 'expenses',
  'costs': 'expenses',
};

/**
 * Parse an incoming URL hash into an ActiveTab and optional subTab.
 * Handles '#/order-engine', '#/connect-channels/facebook', '#orders', etc.
 */
export function parseHash(hashString?: string): NavigationState {
  const rawHash = (
    hashString !== undefined
      ? hashString
      : typeof window !== 'undefined'
      ? window.location.hash
      : ''
  ).trim();

  // Strip leading '#' and slashes
  const clean = rawHash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!clean) {
    return { tab: 'dashboard', isValid: false };
  }

  const parts = clean
    .split('/')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    return { tab: 'dashboard', isValid: false };
  }

  const sectionKey = parts[0];
  const tab = TAB_ALIASES[sectionKey];

  if (!tab) {
    return { tab: 'dashboard', isValid: false };
  }

  let subTab: string | undefined = undefined;

  if (parts.length > 1) {
    const rawSub = parts[1];
    if (tab === 'integrations') {
      subTab = INTEGRATIONS_SUBTAB_ALIASES[rawSub];
    } else if (tab === 'cogs') {
      subTab = CASH_SUBTAB_ALIASES[rawSub];
    } else {
      subTab = rawSub;
    }
  }

  return { tab, subTab, isValid: true };
}

/**
 * Build a canonical URL hash for a given tab and optional subTab.
 * Example: buildHash('integrations', 'meta') -> '#/connect-channels/facebook'
 */
export function buildHash(tab: ActiveTab, subTab?: string): string {
  const sectionSlug = CANONICAL_SLUGS[tab] || 'dashboard';

  if (tab === 'integrations' && subTab) {
    const subSlug = subTab === 'meta' ? 'facebook' : subTab;
    return `#/${sectionSlug}/${subSlug}`;
  }

  if (tab === 'cogs' && subTab) {
    return `#/${sectionSlug}/${subTab}`;
  }

  return `#/${sectionSlug}`;
}

/**
 * Determines initial navigation on page load / PWA launch:
 * 1. Checks URL hash first (direct URL sharing / refresh).
 * 2. Checks localStorage key "lastActiveSection" and "lastActiveHash".
 * 3. Safely falls back to "dashboard".
 */
export function getInitialNavigationState(): { tab: ActiveTab; subTab?: string } {
  // 1. Check URL hash
  if (typeof window !== 'undefined' && window.location.hash) {
    const parsed = parseHash(window.location.hash);
    if (parsed.isValid) {
      return { tab: parsed.tab, subTab: parsed.subTab };
    }
  }

  // 2. Check localStorage key "lastActiveSection"
  if (typeof window !== 'undefined') {
    try {
      const savedSection = localStorage.getItem('lastActiveSection');
      if (savedSection) {
        const clean = savedSection.trim().toLowerCase().replace(/^#\/?/, '');
        const matchedTab = TAB_ALIASES[clean];
        if (matchedTab) {
          const savedSubTab = localStorage.getItem(`lastActiveSubTab_${matchedTab}`);
          return { tab: matchedTab, subTab: savedSubTab || undefined };
        }
      }

      // Also check lastActiveHash fallback
      const savedHash = localStorage.getItem('lastActiveHash');
      if (savedHash) {
        const parsed = parseHash(savedHash);
        if (parsed.isValid) {
          return { tab: parsed.tab, subTab: parsed.subTab };
        }
      }
    } catch (e) {
      console.warn('[NavigationRouter]: Error reading lastActiveSection from localStorage', e);
    }
  }

  // 3. Fallback to default Dashboard
  return { tab: 'dashboard' };
}

/**
 * Persist the current active section and subTab to localStorage and update the URL hash.
 */
export function persistNavigationState(
  tab: ActiveTab,
  subTab?: string,
  updateUrl: boolean = true
): void {
  const hash = buildHash(tab, subTab);

  if (typeof window !== 'undefined') {
    // 1. Update localStorage safely
    try {
      localStorage.setItem('lastActiveSection', tab);
      localStorage.setItem('lastActiveHash', hash);
      if (subTab) {
        localStorage.setItem(`lastActiveSubTab_${tab}`, subTab);
      }
    } catch (err) {
      console.warn('[NavigationRouter]: Could not save lastActiveSection to localStorage:', err);
    }

    // 2. Update URL hash if requested and different
    if (updateUrl && window.location.hash !== hash) {
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hash);
        } else {
          window.location.hash = hash;
        }
      } catch {
        window.location.hash = hash;
      }
    }
  }
}

/**
 * Subscribe to browser back/forward buttons and external hash changes.
 */
export function subscribeToHashChanges(
  callback: (state: { tab: ActiveTab; subTab?: string }) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => {
    const parsed = parseHash(window.location.hash);
    callback({
      tab: parsed.tab,
      subTab: parsed.subTab,
    });
  };

  window.addEventListener('hashchange', handler);
  window.addEventListener('popstate', handler);

  return () => {
    window.removeEventListener('hashchange', handler);
    window.removeEventListener('popstate', handler);
  };
}
