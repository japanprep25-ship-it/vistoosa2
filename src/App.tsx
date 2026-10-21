import React, { useState } from 'react';
import {
  INITIAL_AUTHORIZED_USERS,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_KNOWLEDGE_BASE,
  INITIAL_PATHAO_PAYOUTS,
  INITIAL_EXPENSES,
  INITIAL_SHIPMENT_COSTINGS,
  INITIAL_CASH_ENTRIES,
  INITIAL_INTEGRATION_CONFIG,
} from './data/mockData';
import {
  AuthUser,
  Order,
  Product,
  KnowledgeItem,
  PathaoPayoutRecord,
  ExpenseRecord,
  ShipmentCosting,
  CashEntry,
  ChannelIntegrationConfig,
} from './types';
import { AuthScreen } from './components/AuthScreen';
import { BrandLogo } from './components/BrandLogo';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { BusinessDashboardView } from './components/BusinessDashboardView';
import { IntegrationsHubView } from './components/IntegrationsHubView';
import { OrderEngineView } from './components/OrderEngineView';
import { DispatchScannerView } from './components/DispatchScannerView';
import { InventoryView } from './components/InventoryView';
import { ReconciliationView } from './components/ReconciliationView';
import { CRMView } from './components/CRMView';
import { CashRegisterView } from './components/CashRegisterView';
import { GoogleSheetsIntegrationModal } from './components/GoogleSheetsIntegrationModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsView } from './components/SettingsView';
import { SocialMediaInboxView } from './components/SocialMediaInboxView';
import { LoginWelcomeModal } from './components/LoginWelcomeModal';
import { PageTransitionWrapper } from './components/PageTransitionWrapper';
import { useSettings } from './contexts/SettingsContext';
import { useLanguage } from './contexts/LanguageContext';
import { Lock } from 'lucide-react';
import {
  getInitialNavigationState,
  persistNavigationState,
  subscribeToHashChanges,
  IntegrationsSubTab,
  CashRegisterSubTab,
} from './utils/navigationRouter';

export default function App() {
  // Authentication state
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('vistoosa_auth_token') || null;
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<AuthUser | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(true);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthUser[]>(INITIAL_AUTHORIZED_USERS);

  // Application Data State
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('vistoosa_orders');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return INITIAL_ORDERS;
  });

  // Check stored auth token on mount
  React.useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('vistoosa_auth_token');
      if (!token) {
        setCurrentUser(null);
        setIsVerifyingAuth(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { success: false };
        }
        if (res.ok && data.success && data.user) {
          setCurrentUser(data.user);
          setAuthToken(token);
        } else {
          localStorage.removeItem('vistoosa_auth_token');
          setAuthToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Auth verification fallback:', err);
      } finally {
        setIsVerifyingAuth(false);
      }
    };

    verifySession();
  }, []);

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    localStorage.setItem('vistoosa_auth_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    setWelcomeUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('vistoosa_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
  };

  // Save orders to localStorage on changes
  React.useEffect(() => {
    try {
      localStorage.setItem('vistoosa_orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('Could not save orders to localStorage', e);
    }
  }, [orders]);

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE_BASE);
  const [payouts, setPayouts] = useState<PathaoPayoutRecord[]>(INITIAL_PATHAO_PAYOUTS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES);
  const [shipments, setShipments] = useState<ShipmentCosting[]>(INITIAL_SHIPMENT_COSTINGS);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>(INITIAL_CASH_ENTRIES);
  const [integrationConfig, setIntegrationConfig] = useState<ChannelIntegrationConfig>(() => {
    try {
      const saved = localStorage.getItem('vistoosa_integration_config');
      let base = saved ? JSON.parse(saved) : INITIAL_INTEGRATION_CONFIG;
      const web = localStorage.getItem('vistoosa_website_config');
      if (web) base.website = { ...base.website, ...JSON.parse(web) };
      const pth = localStorage.getItem('vistoosa_pathao_config');
      if (pth) base.pathao = { ...base.pathao, ...JSON.parse(pth) };
      const meta = localStorage.getItem('vistoosa_meta_config');
      if (meta) base.meta = { ...base.meta, ...JSON.parse(meta) };
      return base;
    } catch (e) {
      // fallback
    }
    return INITIAL_INTEGRATION_CONFIG;
  });

  const handleUpdateIntegrationConfig = (newConfig: ChannelIntegrationConfig) => {
    setIntegrationConfig(newConfig);
    try {
      localStorage.setItem('vistoosa_integration_config', JSON.stringify(newConfig));
      if (newConfig.website) localStorage.setItem('vistoosa_website_config', JSON.stringify(newConfig.website));
      if (newConfig.pathao) localStorage.setItem('vistoosa_pathao_config', JSON.stringify(newConfig.pathao));
      if (newConfig.meta) localStorage.setItem('vistoosa_meta_config', JSON.stringify(newConfig.meta));
    } catch (e) {
      console.warn('Could not save integration config to localStorage', e);
    }
  };

  // Sync server integration configs on mount
  React.useEffect(() => {
    const fetchServerIntegrations = async () => {
      try {
        const token = localStorage.getItem('vistoosa_auth_token') || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token.replace(/^"|"$/g, '')}`;

        const res = await fetch('/api/settings/integrations', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.config) {
            setIntegrationConfig((prev) => {
              const updated = {
                ...prev,
                website: data.config.website ? { ...prev.website, ...data.config.website } : prev.website,
                meta: data.config.meta ? { ...prev.meta, ...data.config.meta } : prev.meta,
              };
              localStorage.setItem('vistoosa_integration_config', JSON.stringify(updated));
              if (updated.website) localStorage.setItem('vistoosa_website_config', JSON.stringify(updated.website));
              if (updated.meta) localStorage.setItem('vistoosa_meta_config', JSON.stringify(updated.meta));
              return updated;
            });
          }
        }
      } catch {
        // silent fallback to localStorage
      }
    };
    fetchServerIntegrations();
  }, []);

  // Navigation State with URL Hash & localStorage persistence
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    return getInitialNavigationState().tab;
  });
  const [integrationsSubTab, setIntegrationsSubTab] = useState<IntegrationsSubTab | undefined>(() => {
    const init = getInitialNavigationState();
    return init.tab === 'integrations' ? (init.subTab as IntegrationsSubTab) : undefined;
  });
  const [cashSubTab, setCashSubTab] = useState<CashRegisterSubTab | undefined>(() => {
    const init = getInitialNavigationState();
    return init.tab === 'cogs' ? (init.subTab as CashRegisterSubTab) : undefined;
  });

  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [isCashModalOpenFromDashboard, setIsCashModalOpenFromDashboard] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isDarkMode, toggleDarkMode, motherGmail } = useSettings();
  const { isBangla } = useLanguage();

  const isMother = currentUser?.email && motherGmail
    ? currentUser.email.trim().toLowerCase() === motherGmail.trim().toLowerCase()
    : false;

  // Synchronize document class with isDarkMode state from SettingsContext
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#0f0f14';
      document.body.style.color = '#f4f4f5';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#f1f5f9';
      document.body.style.color = '#09090b';
    }
  }, [isDarkMode]);

  // Navigation dispatcher
  const navigateTo = (tab: ActiveTab, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'integrations') {
      if (subTab) setIntegrationsSubTab(subTab as IntegrationsSubTab);
    } else if (tab === 'cogs') {
      if (subTab) setCashSubTab(subTab as CashRegisterSubTab);
    }
    const currentSub = tab === 'integrations' ? (subTab || integrationsSubTab) : (tab === 'cogs' ? (subTab || cashSubTab) : undefined);
    persistNavigationState(tab, currentSub, true);
  };

  const handleSelectTab = (tab: ActiveTab) => {
    navigateTo(tab);
    setIsMobileSidebarOpen(false);
  };

  const handleIntegrationsSubTabChange = (sub: IntegrationsSubTab) => {
    setIntegrationsSubTab(sub);
    persistNavigationState('integrations', sub, true);
  };

  const handleCashSubTabChange = (sub: CashRegisterSubTab) => {
    setCashSubTab(sub);
    persistNavigationState('cogs', sub, true);
  };

  // Sync initial navigation state and subscribe to browser back/forward buttons
  React.useEffect(() => {
    const currentSub = activeTab === 'integrations' ? integrationsSubTab : (activeTab === 'cogs' ? cashSubTab : undefined);
    persistNavigationState(activeTab, currentSub, false);

    const unsubscribe = subscribeToHashChanges((nav) => {
      setActiveTab(nav.tab);
      if (nav.tab === 'integrations') {
        if (nav.subTab) setIntegrationsSubTab(nav.subTab as IntegrationsSubTab);
      } else if (nav.tab === 'cogs') {
        if (nav.subTab) setCashSubTab(nav.subTab as CashRegisterSubTab);
      }
      persistNavigationState(nav.tab, nav.subTab, false);
    });

    return () => unsubscribe();
  }, []);

  // Enforce per-page permissions: redirect if user tries to access unpermitted page
  React.useEffect(() => {
    if (!currentUser) return;
    // Requirement 4: Only Mother Gmail can access the API / Integrations page
    if (activeTab === 'integrations' && !isMother) {
      navigateTo('dashboard');
      return;
    }
    if (currentUser.role === 'Owner' || currentUser.role === 'Admin') return;
    const perms = currentUser.permissions || {};
    if (!perms[activeTab]) {
      const allTabs: ActiveTab[] = ['dashboard', 'orders', 'social', 'cogs', 'integrations', 'dispatch', 'inventory', 'reconciliation', 'crm', 'gas', 'settings'];
      const firstAllowed = allTabs.find((t) => t !== 'integrations' && perms[t]) || 'dashboard';
      if (firstAllowed !== activeTab) {
        navigateTo(firstAllowed);
      }
    }
  }, [currentUser, activeTab, isMother]);

  // Periodically poll for live inbound website orders received via WooCommerce / Shopify webhooks
  React.useEffect(() => {
    const fetchInboundOrders = async () => {
      try {
        const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('vistoosa_auth_token') : null);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/orders/inbound', { headers });
        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { success: false };
        }
        if (res.ok && data.success && Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders((prevOrders) => {
            let updated = false;
            const newOrdersList = [...prevOrders];

            data.orders.forEach((inboundOrder: Order) => {
              const existingIndex = newOrdersList.findIndex((o) => o.id === inboundOrder.id);
              if (existingIndex < 0) {
                // Prepend new website order directly into queue
                newOrdersList.unshift({
                  ...inboundOrder,
                  status: inboundOrder.status || 'Pending',
                });
                updated = true;
              } else {
                // If existing order status in frontend is Approved/Dispatched/etc., DO NOT overwrite back to Pending!
                const currentStatus = newOrdersList[existingIndex].status;
                if (inboundOrder.status !== 'Pending' && inboundOrder.status !== currentStatus) {
                  newOrdersList[existingIndex] = {
                    ...newOrdersList[existingIndex],
                    status: inboundOrder.status,
                    pathaoTrackingId: inboundOrder.pathaoTrackingId || newOrdersList[existingIndex].pathaoTrackingId,
                    pathaoConsignmentId: inboundOrder.pathaoConsignmentId || newOrdersList[existingIndex].pathaoConsignmentId,
                  };
                  updated = true;
                }
              }
            });

            return updated ? newOrdersList : prevOrders;
          });
        }
      } catch (err) {
        // Ignore background polling errors
      }
    };

    fetchInboundOrders();
    const interval = setInterval(fetchInboundOrders, 2500);
    return () => clearInterval(interval);
  }, [currentUser, authToken]);

  // Quick stats (filter out soft deleted orders)
  const activeOrdersList = orders.filter((o) => !o.isDeleted);
  const pendingOrdersCount = activeOrdersList.filter((o) => o.status === 'Pending').length;
  const approvedDispatchCount = activeOrdersList.filter((o) => o.status === 'Approved').length;
  const discrepancyCount = payouts.filter((p) => p.reconciliationStatus === 'Discrepancy').length;

  // Handlers for Orders
  const handleApproveOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    // Check if Pathao courier pickup request is disabled manually or by Showroom channel
    const isShowroom = targetOrder.channel === 'Showroom';
    const isPickupDisabled = Boolean(targetOrder.disablePathaoPickup || isShowroom);

    let trackingId: string | undefined = undefined;
    let consignmentId: string | undefined = undefined;

    if (!isPickupDisabled) {
      try {
        const token = localStorage.getItem('vistoosa_auth_token') || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Trigger Pathao Pickup API endpoint
        const res = await fetch('/api/pathao/pickup', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orderId: targetOrder.id,
            recipientName: targetOrder.customerName,
            recipientPhone: targetOrder.phone,
            recipientAddress: targetOrder.address,
            recipientCity: targetOrder.city,
            recipientCityId: targetOrder.pathaoCityId,
            recipientZoneId: targetOrder.pathaoZoneId,
            amountToCollect: targetOrder.totalAmount,
            itemDescription:
              targetOrder.items?.map((i) => `${i.productName} (${i.size}) x${i.quantity}`).join(', ') ||
              'Vistoosa Luxury Apparel',
          }),
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          data = { success: false, message: `Server error (HTTP ${res.status}): ${resText.slice(0, 100)}` };
        }
        if (data.trackingId) trackingId = data.trackingId;
        if (data.consignmentId) consignmentId = data.consignmentId;
      } catch (e) {
        console.warn('Pathao pickup API error fallback:', e);
      }
    }

    if (!trackingId && !isPickupDisabled) {
      trackingId = `PTH-${Math.floor(7819300 + Math.random() * 500)}`;
    }
    if (!consignmentId && !isPickupDisabled) {
      consignmentId = `CN-${Math.floor(492000 + Math.random() * 500)}`;
    }

    // Always update status to Approved locally
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'Approved',
            approvedAt: new Date().toISOString(),
            pathaoTrackingId: trackingId,
            pathaoConsignmentId: consignmentId,
            pathaoStatus: isPickupDisabled ? undefined : 'Pickup Requested',
            notes: isPickupDisabled
              ? (o.notes ? `${o.notes} • ` : '') +
                (targetOrder.disablePathaoPickup ? 'Manual Pathao Pickup Disabled' : 'Showroom Direct Sale')
              : o.notes,
          };
        }
        return o;
      })
    );

    // Sync status update to backend server
    const token = localStorage.getItem('vistoosa_auth_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/orders/status', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: targetOrder.id,
        status: 'Approved',
        trackingId,
        consignmentId,
      }),
    }).catch(() => {});

    // Increase reserved stock for the item
    setProducts((prev) =>
      prev.map((prod) => {
        const matchingItem = (targetOrder.items || []).find((item) =>
          (prod.variants || []).some((v) => v.sku === item.sku)
        );
        if (!matchingItem) return prod;

        return {
          ...prod,
          variants: (prod.variants || []).map((v) => {
            if (v.sku === matchingItem.sku) {
              return {
                ...v,
                reservedStock: v.reservedStock + matchingItem.quantity,
              };
            }
            return v;
          }),
        };
      })
    );
  };

  const handleCancelOrder = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelled' } : o))
    );

    // Sync status update to backend server
    const cancelToken = localStorage.getItem('vistoosa_auth_token') || '';
    const cancelHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cancelToken) cancelHeaders['Authorization'] = `Bearer ${cancelToken}`;

    fetch('/api/orders/status', {
      method: 'POST',
      headers: cancelHeaders,
      body: JSON.stringify({
        orderId,
        status: 'Cancelled',
      }),
    }).catch(() => {});

    // If it was approved, release reserved stock
    if (targetOrder.status === 'Approved') {
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: (prod.variants || []).map((v) => {
            const item = (targetOrder.items || []).find((i) => i.sku === v.sku);
            if (item) {
              return {
                ...v,
                reservedStock: Math.max(0, v.reservedStock - item.quantity),
              };
            }
            return v;
          }),
        }))
      );
    }
  };

  // Play sound chime and trigger browser/audio notification for new incoming orders
  const playNewOrderChime = (order: Order) => {
    try {
      // 1. Audio synthesis chime (pleasant double beep / ding)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };
      playTone(523.25, 0, 0.15); // C5
      playTone(659.25, 0.15, 0.15); // E5
      playTone(783.99, 0.3, 0.3); // G5
    } catch (e) {
      // ignore audio context restrictions if user hasn't interacted yet
    }

    // 2. Browser Web Notification (if permitted)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`নতুন অর্ডার এসেছে! (New Order #${order.id})`, {
          body: `${order.customerName || 'Customer'} - ৳${order.totalAmount || 0} (${order.channel || 'Website'})`,
          icon: '/api/brand/image/icon-192.png',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(`নতুন অর্ডার এসেছে! (New Order #${order.id})`, {
              body: `${order.customerName || 'Customer'} - ৳${order.totalAmount || 0} (${order.channel || 'Website'})`,
              icon: '/api/brand/image/icon-192.png',
            });
          }
        });
      }
    }
  };

  const handleCreateOrder = (newOrder: Partial<Order>) => {
    const fullOrder = newOrder as Order;
    setOrders((prev) => [fullOrder, ...prev]);

    // Trigger phone audio & browser notification
    playNewOrderChime(fullOrder);

    // If created directly in approved state, reserve stock
    if (fullOrder.status === 'Approved') {
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: (prod.variants || []).map((v) => {
            const item = (fullOrder.items || []).find((i) => i.sku === v.sku);
            if (item) {
              return {
                ...v,
                reservedStock: v.reservedStock + item.quantity,
              };
            }
            return v;
          }),
        }))
      );
    }

    // Persist full new order to backend server
    const createToken = localStorage.getItem('vistoosa_auth_token') || '';
    const createHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (createToken) createHeaders['Authorization'] = `Bearer ${createToken}`;

    fetch('/api/orders/update', {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(fullOrder),
    }).catch((err) => {
      console.warn('Failed to sync new order to server:', err);
    });
  };

  // Handler to Update Order details (Customer name, phone, address, city, product, size, qty, notes, etc.)
  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    );

    // Persist full updated order to backend server
    const updateToken = localStorage.getItem('vistoosa_auth_token') || '';
    const updateHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (updateToken) updateHeaders['Authorization'] = `Bearer ${updateToken}`;

    fetch('/api/orders/update', {
      method: 'POST',
      headers: updateHeaders,
      body: JSON.stringify(updatedOrder),
    }).catch((err) => {
      console.warn('Failed to sync updated order to server:', err);
    });
  };

  // Handlers for Soft Delete, Restore, and Permanent Delete
  const handleSoftDeleteOrders = async (orderIds: string[]) => {
    const deletedAt = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (orderIds.includes(o.id) ? { ...o, isDeleted: true, deletedAt } : o))
    );

    try {
      const token = localStorage.getItem('vistoosa_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/orders/soft-delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderIds }),
      });
    } catch (err) {
      console.warn('Soft delete API error:', err);
    }
  };

  const handleRestoreOrders = async (orderIds: string[]) => {
    setOrders((prev) =>
      prev.map((o) => (orderIds.includes(o.id) ? { ...o, isDeleted: false, deletedAt: undefined } : o))
    );

    try {
      const token = localStorage.getItem('vistoosa_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/orders/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderIds }),
      });
    } catch (err) {
      console.warn('Restore API error:', err);
    }
  };

  const handlePermanentDeleteOrders = async (orderIds: string[]) => {
    setOrders((prev) => prev.filter((o) => !orderIds.includes(o.id)));

    try {
      const token = localStorage.getItem('vistoosa_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/orders/permanent-delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderIds }),
      });
    } catch (err) {
      console.warn('Permanent delete API error:', err);
    }
  };

  // CRITICAL LOGIC: Barcode Dispatch & Real-Product Override Handler
  const handleDispatchSuccess = (
    orderId: string,
    itemId: string,
    dispatchedSku: string,
    dispatchedSize: 'S' | 'M' | 'L' | 'XL' | 'XXL',
    isOverridden: boolean,
    originalSku?: string,
    originalSize?: string
  ) => {
    // 1. Update Order state & record override history if applicable
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = order.items.map((item) => {
          if (item.id !== itemId) return item;
          if (isOverridden) {
            return {
              ...item,
              sku: dispatchedSku,
              size: dispatchedSize,
              overriddenFromSku: originalSku,
              overriddenFromSize: originalSize,
            };
          }
          return item;
        });

        const history = order.overrideHistory || [];
        if (isOverridden && originalSku && originalSize) {
          history.push({
            timestamp: new Date().toISOString(),
            originalSku,
            scannedSku: dispatchedSku,
            originalSize,
            newSize: dispatchedSize,
            packerName: currentUser?.name || 'Warehouse Staff',
          });
        }

        return {
          ...order,
          status: 'Dispatched',
          dispatchedAt: new Date().toISOString(),
          items: updatedItems,
          overrideHistory: history,
        };
      })
    );

    // 2. Dual-State Inventory Adjustment:
    // - Deduct Warehouse Stock for the PHYSICALLY SCANNED variant
    // - Release Reserved Stock for the originally booked variant
    setProducts((prev) =>
      prev.map((prod) => ({
        ...prod,
        variants: prod.variants.map((v) => {
          let updatedWarehouseStock = v.warehouseStock;
          let updatedReservedStock = v.reservedStock;

          // Deduct physically scanned stock
          if (v.sku === dispatchedSku) {
            updatedWarehouseStock = Math.max(0, updatedWarehouseStock - 1);
          }

          // Release reserved stock (from original SKU if overridden, or from dispatchedSku)
          const targetReservedSku = isOverridden && originalSku ? originalSku : dispatchedSku;
          if (v.sku === targetReservedSku) {
            updatedReservedStock = Math.max(0, updatedReservedStock - 1);
          }

          return {
            ...v,
            warehouseStock: updatedWarehouseStock,
            reservedStock: updatedReservedStock,
          };
        }),
      }))
    );
  };

  // Inventory Restock handler
  const handleUpdateStock = (
    productId: string,
    size: 'S' | 'M' | 'L' | 'XL' | 'XXL',
    delta: number
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          variants: p.variants.map((v) => {
            if (v.size === size) {
              return {
                ...v,
                warehouseStock: v.warehouseStock + delta,
              };
            }
            return v;
          }),
        };
      })
    );
  };

  // Reconciliation handler
  const handleAddPayout = (payout: PathaoPayoutRecord) => {
    setPayouts((prev) => [payout, ...prev]);
  };

  // Cash Register handlers
  const handleAddCashEntry = (entry: CashEntry) => {
    setCashEntries((prev) => [entry, ...prev]);
  };

  const handleAddExpense = (expense: ExpenseRecord) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleAddShipment = (shipment: ShipmentCosting) => {
    setShipments((prev) => [shipment, ...prev]);
  };

  // Knowledge Base handlers
  const handleAddKnowledgeItem = (item: KnowledgeItem) => {
    setKnowledgeBase((prev) => [...prev, item]);
  };

  const handleDeleteKnowledgeItem = (id: string) => {
    setKnowledgeBase((prev) => prev.filter((k) => k.id !== id));
  };

  const handleAddAuthorizedUser = (email: string, name: string) => {
    const newUser: AuthUser = {
      email,
      name,
      role: 'Manager',
      status: 'Active',
    };
    setAuthorizedUsers((prev) => [...prev, newUser]);
  };

  // Loading splash while checking JWT session
  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0f0f14] text-amber-400 p-4">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <BrandLogo heightPx={64} className="mx-auto" />
          <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
            Verifying Workspace Credentials...
          </span>
        </div>
      </div>
    );
  }

  // If not logged in, render Email/Password Sign-In & Sign-Up screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'dark bg-[#0f0f14] text-zinc-100' : 'bg-[#f1f5f9] text-[#09090b]'} flex flex-col font-sans transition-colors duration-300`}
    >
      {/* Welcome Greeting Screen (Requirement 7) */}
      {welcomeUser && (
        <LoginWelcomeModal
          user={welcomeUser}
          motherGmail={motherGmail}
          onComplete={() => setWelcomeUser(null)}
        />
      )}

      {/* Top App Bar */}
      <Navbar
        user={currentUser}
        onLogout={handleLogout}
        onOpenGasModal={() => setIsGasModalOpen(true)}
        onGoHome={() => navigateTo('dashboard')}
        pendingOrdersCount={pendingOrdersCount}
        approvedDispatchCount={approvedDispatchCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-8">
        {/* Slide-in Navigation Drawer */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          pendingOrdersCount={pendingOrdersCount}
          approvedDispatchCount={approvedDispatchCount}
          discrepancyCount={discrepancyCount}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          currentUser={currentUser}
        />

        {/* Center Dynamic Content Stage */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-full overflow-x-hidden">
          <PageTransitionWrapper key={activeTab} activeTab={activeTab}>
            {activeTab === 'dashboard' && (
              <BusinessDashboardView
                orders={orders}
                products={products}
                cashEntries={cashEntries}
                expenses={expenses}
                payouts={payouts}
                integrationConfig={integrationConfig}
                onNavigate={(tab) => navigateTo(tab)}
                onNavigateTab={(tab) => navigateTo(tab)}
                onOpenCashModal={() => {
                  navigateTo('cogs', 'register');
                  setIsCashModalOpenFromDashboard(true);
                }}
                onOpenNewCashModal={() => {
                  navigateTo('cogs', 'register');
                  setIsCashModalOpenFromDashboard(true);
                }}
              />
            )}

            {activeTab === 'orders' && (
              <OrderEngineView
                orders={orders}
                products={products}
                onApproveOrder={handleApproveOrder}
                onCancelOrder={handleCancelOrder}
                onGoToDispatch={(orderId) => {
                  navigateTo('dispatch');
                }}
                onNavigateToSocial={() => navigateTo('social')}
                onCreateOrder={handleCreateOrder}
                onUpdateOrder={handleUpdateOrder}
                onSoftDeleteOrders={handleSoftDeleteOrders}
                onRestoreOrders={handleRestoreOrders}
                onPermanentDeleteOrders={handlePermanentDeleteOrders}
              />
            )}

            {activeTab === 'social' && (
              <SocialMediaInboxView
                products={products}
                onCreateOrder={handleCreateOrder}
              />
            )}

            {activeTab === 'integrations' && (
              isMother ? (
                <IntegrationsHubView
                  config={integrationConfig}
                  onUpdateConfig={handleUpdateIntegrationConfig}
                  activeSubTab={integrationsSubTab}
                  onSubTabChange={handleIntegrationsSubTabChange}
                  onSimulatedOrderReceived={(order) => {
                    setOrders((prev) => [order, ...prev]);
                    // If it's a prepaid order (bKash or Nagad), record cash entry
                    if (order.paymentMethod === 'bKash' || order.paymentMethod === 'Nagad' || order.paymentMethod === 'Prepaid') {
                      const newCash: CashEntry = {
                        id: `cash-auto-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: 'inflow',
                        account: order.paymentMethod === 'bKash' ? 'bKash Merchant' : 'Petty Cash Drawer',
                        category: 'Customer Advance',
                        amount: order.totalAmount,
                        description: `Advance received for order #${order.id} (${order.customerName})`,
                        referenceId: order.id,
                        performedBy: 'Automated Webhook',
                      };
                      setCashEntries((prev) => [newCash, ...prev]);
                    }
                  }}
                />
              ) : (
                <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl glass-panel border border-red-500/40 bg-zinc-950/90 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center shadow-lg">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {isBangla ? '🔒 এক্সেস সংরক্ষিত (Mother Gmail Required)' : '🔒 Access Restricted (Mother Gmail Only)'}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed max-w-md mx-auto">
                    {isBangla
                      ? `শুধুমাত্র অনুমোদিত মাদার জিমেইল (${motherGmail}) এই API ইন্টিগ্রেশন পেজ এবং ক্রেডেনশিয়াল পরিবর্তন করতে পারবে।`
                      : `Only the authorized Mother Gmail account (${motherGmail}) has permission to access API keys, Webhooks, Meta, WhatsApp, and Pathao integrations.`}
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => navigateTo('dashboard')}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition"
                    >
                      {isBangla ? 'ড্যাশবোর্ডে ফিরে যান' : 'Return to Dashboard'}
                    </button>
                  </div>
                </div>
              )
            )}

            {activeTab === 'dispatch' && (
              <DispatchScannerView
                orders={orders}
                products={products}
                onDispatchSuccess={handleDispatchSuccess}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView products={products} onUpdateStock={handleUpdateStock} />
            )}

            {activeTab === 'reconciliation' && (
              <ReconciliationView payouts={payouts} onAddPayout={handleAddPayout} />
            )}

            {activeTab === 'crm' && <CRMView orders={orders} />}

            {activeTab === 'cogs' && (
              <CashRegisterView
                cashEntries={cashEntries}
                expenses={expenses}
                shipments={shipments}
                activeSubTab={cashSubTab}
                onSubTabChange={handleCashSubTabChange}
                onAddCashEntry={handleAddCashEntry}
                onAddExpense={handleAddExpense}
                onAddShipment={handleAddShipment}
                isEntryModalOpenExternal={isCashModalOpenFromDashboard}
                onCloseEntryModalExternal={() => setIsCashModalOpenFromDashboard(false)}
              />
            )}



            {activeTab === 'gas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Google Apps Script & Database</h2>
                    <p className="text-xs text-zinc-400">
                      Connect Google Sheets database with 100% Free Tier Web App endpoints
                    </p>
                  </div>
                  <button
                    onClick={() => setIsGasModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition"
                  >
                    View Full Code.gs & Schema
                  </button>
                </div>
                <div className="p-6 rounded-3xl glass-panel border border-emerald-500/30 text-center">
                  <p className="text-sm font-semibold text-zinc-200 mb-2">
                    Google Sheets Database Schema & Code Ready
                  </p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4">
                    Open the modal to copy the complete `Code.gs` script or explore the 9 relational table definitions.
                  </p>
                  <button
                    onClick={() => setIsGasModalOpen(true)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold text-xs shadow-lg transition"
                  >
                    Open Integration Panel
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'settings' && <SettingsView currentUser={currentUser} token={authToken} onOpenGasModal={() => setIsGasModalOpen(true)} />}
          </PageTransitionWrapper>
        </main>
      </div>

      {/* Google Sheets GAS & Database Schema Modal */}
      <GoogleSheetsIntegrationModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
      />

      {/* Non-intrusive Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
