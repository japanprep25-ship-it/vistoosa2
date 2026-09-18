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
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { BusinessDashboardView } from './components/BusinessDashboardView';
import { IntegrationsHubView } from './components/IntegrationsHubView';
import { OrderEngineView } from './components/OrderEngineView';
import { DispatchScannerView } from './components/DispatchScannerView';
import { InventoryView } from './components/InventoryView';
import { ReconciliationView } from './components/ReconciliationView';
import { CRMView } from './components/CRMView';
import { CashRegisterView } from './components/CashRegisterView';
import { AIAssistantWidget } from './components/AIAssistantWidget';
import { GoogleSheetsIntegrationModal } from './components/GoogleSheetsIntegrationModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsView } from './components/SettingsView';
import { useSettings } from './contexts/SettingsContext';

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(INITIAL_AUTHORIZED_USERS[0]);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthUser[]>(INITIAL_AUTHORIZED_USERS);

  // Application Data State
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE_BASE);
  const [payouts, setPayouts] = useState<PathaoPayoutRecord[]>(INITIAL_PATHAO_PAYOUTS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES);
  const [shipments, setShipments] = useState<ShipmentCosting[]>(INITIAL_SHIPMENT_COSTINGS);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>(INITIAL_CASH_ENTRIES);
  const [integrationConfig, setIntegrationConfig] = useState<ChannelIntegrationConfig>(INITIAL_INTEGRATION_CONFIG);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [isCashModalOpenFromDashboard, setIsCashModalOpenFromDashboard] = useState(false);
  const { isDarkMode, toggleDarkMode } = useSettings();

  // Quick stats
  const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;
  const approvedDispatchCount = orders.filter((o) => o.status === 'Approved').length;
  const discrepancyCount = payouts.filter((p) => p.reconciliationStatus === 'Discrepancy').length;

  // Handlers for Orders
  const handleApproveOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    try {
      // Trigger Pathao Pickup webhook
      const res = await fetch('/api/pathao/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetOrder.id,
          recipientName: targetOrder.customerName,
          recipientPhone: targetOrder.phone,
          recipientAddress: targetOrder.address,
          recipientCity: targetOrder.city,
          amountToCollect: targetOrder.totalAmount,
        }),
      });

      const data = await res.json();
      const trackingId = data.trackingId || `PTH-${Math.floor(7819300 + Math.random() * 500)}`;
      const consignmentId = data.consignmentId || `CN-${Math.floor(492000 + Math.random() * 500)}`;

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: 'Approved',
              approvedAt: new Date().toISOString(),
              pathaoTrackingId: trackingId,
              pathaoConsignmentId: consignmentId,
              pathaoStatus: 'Pickup Requested',
            };
          }
          return o;
        })
      );

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
    } catch (e) {
      // Fallback local update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'Approved',
                approvedAt: new Date().toISOString(),
                pathaoTrackingId: `PTH-${Math.floor(7819300 + Math.random() * 500)}`,
                pathaoStatus: 'Pickup Requested',
              }
            : o
        )
      );
    }
  };

  const handleCancelOrder = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelled' } : o))
    );

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

  const handleCreateOrder = (newOrder: Partial<Order>) => {
    const fullOrder = newOrder as Order;
    setOrders((prev) => [fullOrder, ...prev]);

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

  const handleUpdateIntegrationConfig = (config: ChannelIntegrationConfig) => {
    setIntegrationConfig(config);
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

  // If not logged in, render Google Sign-In & Whitelist screen
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => setCurrentUser(user)}
        authorizedUsers={authorizedUsers}
        onAddAuthorizedUser={handleAddAuthorizedUser}
      />
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      } flex flex-col font-sans transition-colors duration-300`}
    >
      {/* Top App Bar */}
      <Navbar
        user={currentUser}
        onLogout={() => setCurrentUser(null)}
        onOpenGasModal={() => setIsGasModalOpen(true)}
        onOpenAiDrawer={() => setActiveTab('ai')}
        pendingOrdersCount={pendingOrdersCount}
        approvedDispatchCount={approvedDispatchCount}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-16 md:pb-0">
        {/* Left Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingOrdersCount={pendingOrdersCount}
          approvedDispatchCount={approvedDispatchCount}
          discrepancyCount={discrepancyCount}
        />

        {/* Center Dynamic Content Stage */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <BusinessDashboardView
              orders={orders}
              products={products}
              cashEntries={cashEntries}
              expenses={expenses}
              payouts={payouts}
              integrationConfig={integrationConfig}
              onNavigate={(tab) => setActiveTab(tab)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenCashModal={() => {
                setActiveTab('cogs');
                setIsCashModalOpenFromDashboard(true);
              }}
              onOpenNewCashModal={() => {
                setActiveTab('cogs');
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
                setActiveTab('dispatch');
              }}
              onCreateOrder={handleCreateOrder}
            />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsHubView
              config={integrationConfig}
              onUpdateConfig={handleUpdateIntegrationConfig}
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
              onAddCashEntry={handleAddCashEntry}
              onAddExpense={handleAddExpense}
              onAddShipment={handleAddShipment}
              isEntryModalOpenExternal={isCashModalOpenFromDashboard}
              onCloseEntryModalExternal={() => setIsCashModalOpenFromDashboard(false)}
            />
          )}

          {activeTab === 'ai' && (
            <AIAssistantWidget
              knowledgeBase={knowledgeBase}
              onAddKnowledgeItem={handleAddKnowledgeItem}
              onDeleteKnowledgeItem={handleDeleteKnowledgeItem}
              onOrderParsed={handleCreateOrder}
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

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingOrdersCount={pendingOrdersCount}
        approvedDispatchCount={approvedDispatchCount}
      />

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
