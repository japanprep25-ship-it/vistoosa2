import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Truck,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  Share2,
  Plus,
  ChevronRight,
  ExternalLink,
  Download,
  BarChart3,
  Sliders,
} from 'lucide-react';
import { Order, Product, CashEntry, PathaoPayoutRecord } from '../types';
import { ActiveTab } from './Sidebar';
import { FinancialAnalyticsEngine } from './FinancialAnalyticsEngine';

interface BusinessDashboardViewProps {
  orders?: Order[];
  products?: Product[];
  cashEntries?: CashEntry[];
  payouts?: PathaoPayoutRecord[];
  expenses?: any[];
  integrationConfig?: any;
  onNavigateTab?: (tab: ActiveTab) => void;
  onNavigate?: (tab: ActiveTab) => void;
  onOpenCashModal?: () => void;
  onOpenNewCashModal?: () => void;
}

export const BusinessDashboardView: React.FC<BusinessDashboardViewProps> = ({
  orders = [],
  products = [],
  cashEntries = [],
  payouts = [],
  expenses = [],
  onNavigateTab,
  onNavigate,
  onOpenCashModal,
  onOpenNewCashModal,
}) => {
  const [dashboardView, setDashboardView] = useState<'overview' | 'analytics'>('overview');
  const navigate = onNavigateTab || onNavigate || (() => {});
  const openCash = onOpenCashModal || onOpenNewCashModal || (() => {});

  // 1. Financial Calculations
  const grossRevenue = (orders || []).reduce((sum, o) => (o.status !== 'Cancelled' ? sum + o.totalAmount : sum), 0);
  
  // Approximate COGS from ordered items
  const safeProducts = products || [];
  const estimatedCogs = (orders || []).reduce((sum, o) => {
    if (o.status === 'Cancelled') return sum;
    const orderCogs = (o.items || []).reduce((itemSum, item) => {
      const prod = safeProducts.find((p) => (p.variants || []).some((v) => v.sku === item.sku));
      const cogs = prod ? prod.cogsEstimate : item.unitPrice * 0.4;
      return itemSum + cogs * item.quantity;
    }, 0);
    return sum + orderCogs;
  }, 0);

  // Cash Inflows & Outflows
  const totalInflows = cashEntries
    .filter((e) => e.type === 'inflow')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOutflows = cashEntries
    .filter((e) => e.type === 'outflow')
    .reduce((sum, e) => sum + e.amount, 0);

  // Liquid Balance
  const startingVaultBalance = 124000;
  const currentLiquidBalance = startingVaultBalance + totalInflows - totalOutflows;

  // Account specific balances
  const pettyCashBalance = 15000 + cashEntries
    .filter((e) => e.account === 'Petty Cash Drawer')
    .reduce((sum, e) => (e.type === 'inflow' ? sum + e.amount : sum - e.amount), 0);

  const bankBalance = 95000 + cashEntries
    .filter((e) => e.account === 'City Bank Current')
    .reduce((sum, e) => (e.type === 'inflow' ? sum + e.amount : sum - e.amount), 0);

  const bkashBalance = 14000 + cashEntries
    .filter((e) => e.account === 'bKash Merchant')
    .reduce((sum, e) => (e.type === 'inflow' ? sum + e.amount : sum - e.amount), 0);

  // Pathao pending funds (in transit or delivered without completed payout)
  const pathaoPendingCod = orders
    .filter((o) => (o.status === 'Dispatched' || o.pathaoStatus === 'In Transit' || o.pathaoStatus === 'Delivered') && o.paymentMethod === 'Cash on Delivery')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Net Profit
  const netEstimatedProfit = grossRevenue - estimatedCogs - 18500 - 15400; // deducting estimated ad spend and courier fees
  const profitMarginPercent = grossRevenue > 0 ? Math.round((netEstimatedProfit / grossRevenue) * 100) : 0;

  // Pipeline counts
  const pendingCount = orders.filter((o) => o.status === 'Pending').length;
  const packingCount = orders.filter((o) => o.status === 'Approved').length;
  const dispatchedCount = orders.filter((o) => o.status === 'Dispatched').length;
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;

  // Low Stock Variants
  const lowStockVariants: { productName: string; size: string; sku: string; stock: number }[] = [];
  safeProducts.forEach((p) => {
    (p.variants || []).forEach((v) => {
      if (v.warehouseStock <= 5) {
        lowStockVariants.push({
          productName: p.name,
          size: v.size,
          sku: v.sku,
          stock: v.warehouseStock,
        });
      }
    });
  });

  // 7-day revenue trend data for high-contrast visual display
  const daysTrend = [
    { day: 'Thu', revenue: 42000, expense: 8500, ads: 3200 },
    { day: 'Fri', revenue: 58000, expense: 12000, ads: 4500 },
    { day: 'Sat', revenue: 74000, expense: 15400, ads: 5800 },
    { day: 'Sun', revenue: 61000, expense: 9800, ads: 4200 },
    { day: 'Mon', revenue: 49000, expense: 7600, ads: 3800 },
    { day: 'Tue', revenue: 68500, expense: 22000, ads: 5100 },
    { day: 'Today', revenue: 84000, expense: 14000, ads: 6200 },
  ];
  const maxDayVal = Math.max(...daysTrend.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="glass-card rounded-3xl p-6 border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950/90 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-mono tracking-wider uppercase">
              Executive Command Center
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">Dhaka Banani Hub</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-brand tracking-tight text-white">
            Vistoosa Business Dashboard
          </h1>
          <p className="text-xs text-zinc-400 max-w-xl">
            Live multi-channel sales revenue, real-time liquid vault balances, Pathao courier remittances, and net operating profitability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="dashboard-btn-toggle-analytics"
            onClick={() => setDashboardView('analytics')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            <BarChart3 className="w-4 h-4" />
            <span>P&L Engine & PDF</span>
          </button>
          <button
            id="dashboard-btn-cash-entry"
            onClick={openCash}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold active:scale-95 transition"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>+ Cash Register</span>
          </button>
          <button
            id="dashboard-btn-integrations"
            onClick={() => navigate('integrations')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold active:scale-95 transition"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Connect APIs</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation: Operational Overview vs. Advanced P&L Engine */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
        <div className="inline-flex p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800">
          <button
            id="tab-btn-overview"
            onClick={() => setDashboardView('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              dashboardView === 'overview'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Operational Overview</span>
          </button>
          <button
            id="tab-btn-analytics"
            onClick={() => setDashboardView('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              dashboardView === 'analytics'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Advanced P&L Engine & PDF</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
              dashboardView === 'analytics' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-amber-500/20 text-amber-300'
            }`}>
              Meta API
            </span>
          </button>
        </div>
      </div>

      {dashboardView === 'analytics' ? (
        <FinancialAnalyticsEngine
          orders={orders}
          products={products}
          cashEntries={cashEntries}
          expenses={expenses}
        />
      ) : (
        <>
      {/* 4 Hero Financial & Balance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales Revenue */}
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-amber-500/30 transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Gross Sales Revenue
              </p>
              <h3 className="text-2xl lg:text-3xl font-black font-mono text-white mt-1">
                ৳{grossRevenue.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="flex items-center text-emerald-400 font-bold font-mono">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +24.8%
            </span>
            <span className="text-zinc-500">vs last 30 days</span>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{orders.length} total orders</span>
            <button
              onClick={() => navigate('orders')}
              className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
            >
              Order Engine <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Live Liquid Cash Balance (Direct Answer to "WHERES MY BALANCE?") */}
        <div className="glass-card rounded-3xl p-5 border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-zinc-900 to-zinc-950 hover:border-amber-500/50 transition relative overflow-hidden group shadow-lg shadow-amber-500/5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Live Cash Balance
                </p>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-black font-mono text-amber-300 mt-1">
                ৳{currentLiquidBalance.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5 text-[11px] text-zinc-300 space-y-0.5 font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-400">Drawer:</span>
              <span className="font-bold text-zinc-200">৳{pettyCashBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">City Bank:</span>
              <span className="font-bold text-zinc-200">৳{bankBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">bKash Merchant:</span>
              <span className="font-bold text-zinc-200">৳{bkashBalance.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Daily Vault Ledger</span>
            <button
              onClick={() => navigate('cogs')}
              className="text-amber-400 hover:underline flex items-center gap-1 font-bold"
            >
              Cash Register <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Pathao Pending Courier Remittance */}
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Pathao COD in Courier
              </p>
              <h3 className="text-2xl lg:text-3xl font-black font-mono text-white mt-1">
                ৳{pathaoPendingCod.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-amber-400 font-bold font-mono">Weekly Payout Cycle</span>
            <span className="text-zinc-500">Every Sunday</span>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{payouts.length} past settlements</span>
            <button
              onClick={() => navigate('reconciliation')}
              className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
            >
              1-Tk Reconciler <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Net Realized Profit & Margin */}
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Estimated Net Profit
              </p>
              <h3 className="text-2xl lg:text-3xl font-black font-mono text-emerald-400 mt-1">
                ৳{netEstimatedProfit.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono">
              {profitMarginPercent}% Net Margin
            </span>
            <span className="text-zinc-500">After COGS & Ads</span>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>COGS: ৳{estimatedCogs.toLocaleString()}</span>
            <span className="text-zinc-400">Ad Spend: ৳18,500</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Revenue & Cash Flow Chart + Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Revenue vs Expense Trend Chart */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-zinc-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                7-Day Financial Trajectory
              </h3>
              <p className="text-xs text-zinc-400">
                Daily sales gross vs operating expense entries & Meta ad spend
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-zinc-300">Gross Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-400/80" />
                <span className="text-zinc-400">Expenses</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-400/80" />
                <span className="text-zinc-400">Meta Ads</span>
              </div>
            </div>
          </div>

          {/* High contrast custom visual bar chart */}
          <div className="pt-4">
            <div className="grid grid-cols-7 gap-3 items-end h-48 border-b border-zinc-800 pb-3">
              {daysTrend.map((d, i) => {
                const heightPct = Math.round((d.revenue / maxDayVal) * 100);
                const expHeightPct = Math.round((d.expense / maxDayVal) * 100);
                const adsHeightPct = Math.round((d.ads / maxDayVal) * 100);

                return (
                  <div key={i} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-[10px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition mb-1">
                      ৳{(d.revenue / 1000).toFixed(0)}k
                    </div>
                    <div className="w-full max-w-[36px] flex items-end justify-center gap-1 h-full">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-1/2 rounded-t-md bg-gradient-to-t from-amber-600 to-amber-400 group-hover:brightness-110 transition-all shadow-sm"
                        title={`Sales: ৳${d.revenue.toLocaleString()}`}
                      />
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${Math.max(10, expHeightPct)}%` }}
                        className="w-1/4 rounded-t-md bg-red-500/70 group-hover:brightness-110 transition-all"
                        title={`Expenses: ৳${d.expense.toLocaleString()}`}
                      />
                      {/* Ad Spend Bar */}
                      <div
                        style={{ height: `${Math.max(8, adsHeightPct)}%` }}
                        className="w-1/4 rounded-t-md bg-blue-500/70 group-hover:brightness-110 transition-all"
                        title={`Ads: ৳${d.ads.toLocaleString()}`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400 mt-2">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400 mt-3 pt-2">
              <span>Avg Daily Run Rate: ৳62,500/day</span>
              <span className="text-amber-400 font-mono font-bold">Highest Day: Today (৳84,000)</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80">
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Average Order Value</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                ৳{orders.length > 0 ? Math.round(grossRevenue / orders.length) : 0}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Pathao Delivery Rate</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">92.4%</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Courier Return Rate</span>
              <span className="text-sm font-bold font-mono text-red-400 mt-0.5 block">7.6%</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">ROAS (Meta Ads)</span>
              <span className="text-sm font-bold font-mono text-amber-300 mt-0.5 block">4.5x Return</span>
            </div>
          </div>
        </div>

        {/* Right Col: Channel Split & Integration Connect Callout */}
        <div className="space-y-6">
          {/* Order Channel Split */}
          <div className="glass-card rounded-3xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Sales Channels</h3>
              <button
                onClick={() => navigate('integrations')}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium"
              >
                Integrations <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Website (WooCommerce)', pct: 42, color: 'bg-emerald-500', count: '৳161,490', orders: 12 },
                { name: 'Facebook & Instagram Ads', pct: 34, color: 'bg-blue-500', count: '৳130,730', orders: 9 },
                { name: 'WhatsApp Business VIPs', pct: 16, color: 'bg-green-500', count: '৳61,520', orders: 5 },
                { name: 'Dhaka Showroom Walk-in', pct: 8, color: 'bg-amber-500', count: '৳30,760', orders: 2 },
              ].map((channel, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{channel.name}</span>
                    <span className="font-mono text-white font-bold">{channel.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      style={{ width: `${channel.pct}%` }}
                      className={`h-full rounded-full ${channel.color}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{channel.orders} orders</span>
                    <span>{channel.pct}% of total sales</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Integration Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider font-mono">
                API Connections
              </span>
              <span className="text-[10px] text-zinc-400">All Systems Nominal</span>
            </div>
            <h4 className="text-sm font-bold text-white">
              Connect Website, Pathao & Facebook
            </h4>
            <p className="text-xs text-zinc-400">
              Sync orders from your website, automate Pathao courier pickups, and track Meta Conversions API & Ad Spend in one place.
            </p>
            <button
              onClick={() => navigate('integrations')}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Configure Channel Connections</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Order Pipeline & Low Stock Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Fulfillment Pipeline (2 Cols) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Order Fulfillment Pipeline
              </h3>
              <p className="text-xs text-zinc-400">Real-time status breakdown across all sales channels</p>
            </div>
            <button
              onClick={() => navigate('orders')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Go to Order Engine <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => navigate('orders')}
              className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300">Pending</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">{pendingCount}</div>
              <span className="text-[10px] text-zinc-400">Awaiting approval</span>
            </div>

            <div
              onClick={() => navigate('dispatch')}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">Ready to Pack</span>
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">{packingCount}</div>
              <span className="text-[10px] text-zinc-400">Approved for dispatch</span>
            </div>

            <div
              onClick={() => navigate('reconciliation')}
              className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 cursor-pointer hover:bg-blue-500/20 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-300">In Courier</span>
                <Truck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">{dispatchedCount}</div>
              <span className="text-[10px] text-zinc-400">Pathao rider active</span>
            </div>

            <div
              onClick={() => navigate('orders')}
              className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 cursor-pointer hover:bg-purple-500/20 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300">Delivered</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">{deliveredCount}</div>
              <span className="text-[10px] text-zinc-400">Payment received</span>
            </div>
          </div>

          {/* Recent Orders List Preview */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Latest Orders</h4>
            <div className="divide-y divide-zinc-800/80">
              {orders.slice(0, 4).map((ord) => (
                <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-white mr-2">{ord.id}</span>
                    <span className="text-zinc-300">{ord.customerName}</span>
                    <span className="text-zinc-500 ml-2 font-mono">({ord.city})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-300">৳{ord.totalAmount.toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        ord.status === 'Approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : ord.status === 'Pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Low Stock Alerts & Inventory Health */}
        <div className="glass-card rounded-3xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Stock Alerts</h3>
            </div>
            <button
              onClick={() => navigate('inventory')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              Inventory <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <p className="text-xs text-zinc-400">
            Variants with 5 or fewer pieces remaining in warehouse:
          </p>

          <div className="space-y-2.5">
            {lowStockVariants.slice(0, 5).map((v, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">{v.productName}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                    <span>Size: {v.size}</span>
                    <span>•</span>
                    <span>SKU: {v.sku}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
                    {v.stock} left
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('inventory')}
              className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold transition"
            >
              View Full Dual-Inventory (Warehouse vs Reserved)
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
