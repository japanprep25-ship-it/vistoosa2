import React, { useState } from 'react';
import {
  Calculator,
  DollarSign,
  Plus,
  Tag,
  TrendingDown,
  TrendingUp,
  Receipt,
  Layers,
  ArrowRight,
  PieChart,
  Wallet,
  Building2,
  Smartphone,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { ExpenseRecord, ShipmentCosting, CashEntry, CashAccountType, CashCategory } from '../types';

interface CashRegisterViewProps {
  cashEntries: CashEntry[];
  expenses: ExpenseRecord[];
  shipments: ShipmentCosting[];
  onAddCashEntry: (entry: CashEntry) => void;
  onAddExpense: (expense: ExpenseRecord) => void;
  onAddShipment: (shipment: ShipmentCosting) => void;
  isEntryModalOpenExternal?: boolean;
  onCloseEntryModalExternal?: () => void;
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({
  cashEntries,
  expenses,
  shipments,
  onAddCashEntry,
  onAddExpense,
  onAddShipment,
  isEntryModalOpenExternal,
  onCloseEntryModalExternal,
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'shipments' | 'expenses'>('register');
  const [isCashEntryModalOpen, setIsCashEntryModalOpen] = useState(false);
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Filters for cash register
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Controlled modal open from external props (e.g. from Dashboard quick action)
  const isModalOpen = isCashEntryModalOpen || isEntryModalOpenExternal;
  const handleCloseModal = () => {
    setIsCashEntryModalOpen(false);
    if (onCloseEntryModalExternal) onCloseEntryModalExternal();
  };

  // Cash Entry Form state
  const [cashForm, setCashForm] = useState<{
    type: 'inflow' | 'outflow';
    account: CashAccountType;
    category: CashCategory;
    amount: number;
    description: string;
    referenceId: string;
    performedBy: string;
  }>({
    type: 'inflow',
    account: 'Petty Cash Drawer',
    category: 'Showroom Cash Sale',
    amount: 5000,
    description: '',
    referenceId: '',
    performedBy: 'Showroom Cashier',
  });

  // Shipment COGS state
  const [shipmentForm, setShipmentForm] = useState({
    shipmentTag: 'Winter Knitwear Drop #1',
    productType: 'Merino Wool Quarter-Zip',
    yieldUnits: 200,
    rawMaterials: 110000,
    packaging: 12000,
    food: 3500,
    transport: 2500,
    labor: 12000,
    other: 0,
    notes: '',
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    category: 'Production' as ExpenseRecord['category'],
    shipmentTag: 'Polo Shipment #5',
    amount: 5000,
    description: '',
  });

  // 1. Calculations for Balance
  const totalInflows = cashEntries
    .filter((e) => e.type === 'inflow')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalOutflows = cashEntries
    .filter((e) => e.type === 'outflow')
    .reduce((acc, e) => acc + e.amount, 0);

  const startingBalance = 124000;
  const currentTotalBalance = startingBalance + totalInflows - totalOutflows;

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

  const pendingCourierCod = 42600; // In courier transit

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Filtered Cash Entries
  const filteredEntries = cashEntries.filter((entry) => {
    if (ledgerFilter !== 'all' && entry.type !== ledgerFilter) return false;
    if (accountFilter !== 'all' && entry.account !== accountFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = entry.description.toLowerCase().includes(q);
      const matchRef = (entry.referenceId || '').toLowerCase().includes(q);
      const matchCat = entry.category.toLowerCase().includes(q);
      if (!matchDesc && !matchRef && !matchCat) return false;
    }
    return true;
  });

  // Handle submit Cash Entry
  const handleSubmitCashEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const newEntry: CashEntry = {
      id: `cash-${Date.now()}`,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: cashForm.type,
      account: cashForm.account,
      category: cashForm.category,
      amount: cashForm.amount,
      description: cashForm.description || `${cashForm.category} via ${cashForm.account}`,
      referenceId: cashForm.referenceId || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      performedBy: cashForm.performedBy,
    };

    onAddCashEntry(newEntry);
    handleCloseModal();
  };

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    const total =
      shipmentForm.rawMaterials +
      shipmentForm.packaging +
      shipmentForm.food +
      shipmentForm.transport +
      shipmentForm.labor +
      shipmentForm.other;
    const cogs = shipmentForm.yieldUnits > 0 ? Math.round(total / shipmentForm.yieldUnits) : 0;

    const newShipment: ShipmentCosting = {
      id: `ship-${Date.now()}`,
      shipmentTag: shipmentForm.shipmentTag,
      productType: shipmentForm.productType,
      yieldUnits: shipmentForm.yieldUnits,
      expenses: {
        rawMaterials: shipmentForm.rawMaterials,
        packaging: shipmentForm.packaging,
        food: shipmentForm.food,
        transport: shipmentForm.transport,
        labor: shipmentForm.labor,
        other: shipmentForm.other,
      },
      totalCost: total,
      cogsPerUnit: cogs,
      status: 'Finished & Yielded',
      notes: shipmentForm.notes,
    };

    onAddShipment(newShipment);
    setIsShipmentModalOpen(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const newExp: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category: expenseForm.category,
      shipmentTag: expenseForm.shipmentTag ? expenseForm.shipmentTag : undefined,
      amount: expenseForm.amount,
      description: expenseForm.description,
      loggedBy: 'Finance Lead',
    };
    onAddExpense(newExp);
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Big Balance Display ("WHERES MY BALANCE?") */}
      <div className="glass-card rounded-3xl p-6 border border-amber-500/30 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 shadow-xl shadow-amber-500/5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-mono tracking-wider uppercase">
                Petty Cash & Vault Ledger
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">Dhaka Central Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-brand text-white mt-1">
              Cash Register & Balance Management
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live liquid balance, daily showroom cash drawer, City Bank corporate deposits, and bKash merchant receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="cash-register-btn-new-entry"
              onClick={() => setIsCashEntryModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cash Register Entry</span>
            </button>
            <button
              id="cash-register-btn-new-cogs"
              onClick={() => setIsShipmentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold active:scale-95 transition"
            >
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>+ New Shipment Costing</span>
            </button>
          </div>
        </div>

        {/* 4 Account Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Card 1: TOTAL NET LIQUID BALANCE */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Total Liquid Balance
                </span>
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
                ৳{currentTotalBalance.toLocaleString()}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-zinc-400 flex items-center justify-between pt-2 border-t border-amber-500/20">
              <span>All Available Cash</span>
              <span className="text-emerald-400 font-bold font-mono">100% Reconciled</span>
            </div>
          </div>

          {/* Card 2: Petty Cash Drawer */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Cash in Drawer
                </span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-zinc-100 mt-2">
                ৳{pettyCashBalance.toLocaleString()}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span>Showroom Cash Box</span>
              <span className="text-zinc-400 font-mono">Petty Cash</span>
            </div>
          </div>

          {/* Card 3: City Bank Current */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  City Bank Current
                </span>
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-zinc-100 mt-2">
                ৳{bankBalance.toLocaleString()}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span>A/C: 31084920194</span>
              <span className="text-zinc-400 font-mono">Main Account</span>
            </div>
          </div>

          {/* Card 4: bKash Merchant Wallet */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  bKash Merchant
                </span>
                <Smartphone className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-zinc-100 mt-2">
                ৳{bkashBalance.toLocaleString()}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span>01700-VISTOOSA</span>
              <span className="text-zinc-400 font-mono">Digital Wallet</span>
            </div>
          </div>
        </div>

        {/* Daily Cash Inflow vs Outflow Flow Ribbon */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Day's Opening:</span>
            <span className="text-zinc-200 font-bold">৳{startingBalance.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <ArrowUpRight className="w-4 h-4" />
            <span>Total Inflows (+): ৳{totalInflows.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-bold">
            <ArrowDownRight className="w-4 h-4" />
            <span>Total Outflows (-): ৳{totalOutflows.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Pending Pathao Remittance:</span>
            <span className="text-amber-300 font-bold">৳{pendingCourierCod.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'register'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Daily Cash Register Ledger ({cashEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'shipments'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Shipment COGS Engine ({shipments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'expenses'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Expense Logs ({expenses.length})</span>
        </button>
      </div>

      {/* 3. TAB 1: DAILY CASH REGISTER LEDGER */}
      {activeTab === 'register' && (
        <div className="glass-card rounded-3xl p-6 border border-zinc-800 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLedgerFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  ledgerFilter === 'all'
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All Entries
              </button>
              <button
                onClick={() => setLedgerFilter('inflow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                  ledgerFilter === 'inflow'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-emerald-400 hover:bg-zinc-800'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Cash Inflows (+)</span>
              </button>
              <button
                onClick={() => setLedgerFilter('outflow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                  ledgerFilter === 'outflow'
                    ? 'bg-red-500 text-zinc-950'
                    : 'bg-zinc-900 text-red-400 hover:bg-zinc-800'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Cash Outflows (-)</span>
              </button>
            </div>

            {/* Account Selector & Search */}
            <div className="flex items-center gap-2">
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">All Accounts</option>
                <option value="Petty Cash Drawer">Petty Cash Drawer</option>
                <option value="City Bank Current">City Bank Current</option>
                <option value="bKash Merchant">bKash Merchant</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search voucher or description..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-semibold">Date & Time</th>
                  <th className="pb-3 font-semibold">Type / Category</th>
                  <th className="pb-3 font-semibold">Account</th>
                  <th className="pb-3 font-semibold">Description & Voucher</th>
                  <th className="pb-3 font-semibold">Logged By</th>
                  <th className="pb-3 font-semibold text-right">Inflow (+)</th>
                  <th className="pb-3 font-semibold text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-900/50 transition">
                    <td className="py-3 font-mono text-zinc-400 whitespace-nowrap">
                      <div>{entry.date}</div>
                      <div className="text-[10px] text-zinc-500">{entry.time}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            entry.type === 'inflow' ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        />
                        <span className="font-semibold text-zinc-200">{entry.category}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300 whitespace-nowrap">
                        {entry.account}
                      </span>
                    </td>
                    <td className="py-3 max-w-sm">
                      <div className="text-zinc-300 font-medium line-clamp-1">{entry.description}</div>
                      {entry.referenceId && (
                        <span className="text-[10px] font-mono text-amber-400">
                          Ref: {entry.referenceId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-400 text-[11px] whitespace-nowrap">{entry.performedBy}</td>
                    <td className="py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {entry.type === 'inflow' ? `+৳${entry.amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-red-400 whitespace-nowrap">
                      {entry.type === 'outflow' ? `-৳${entry.amount.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 2: SHIPMENT COGS ENGINE */}
      {activeTab === 'shipments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {shipments.map((ship) => (
            <div
              key={ship.id}
              className="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-amber-500/30 transition space-y-4"
            >
              <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    {ship.shipmentTag}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1.5">{ship.productType}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                    Calculated Unit COGS
                  </span>
                  <span className="text-2xl font-black font-mono text-amber-400">
                    ৳{ship.cogsPerUnit}
                  </span>
                  <span className="text-[11px] text-zinc-400 block font-mono">
                    per finished piece
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Batch Production Yield:</span>
                  <span className="font-mono font-bold text-white">{ship.yieldUnits} Pieces</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Raw Materials & Fabric:</span>
                  <span className="font-mono text-zinc-200">
                    ৳{ship.expenses.rawMaterials.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Packaging & Garment Bags:</span>
                  <span className="font-mono text-zinc-200">
                    ৳{ship.expenses.packaging.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Team Food & Overtime Dinner:</span>
                  <span className="font-mono text-zinc-200">
                    ৳{ship.expenses.food.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Transport Freight & Fuel:</span>
                  <span className="font-mono text-zinc-200">
                    ৳{ship.expenses.transport.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Tailoring & Finishing Labor:</span>
                  <span className="font-mono text-zinc-200">
                    ৳{ship.expenses.labor.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Total Shipment Spend:</span>
                <span className="text-base font-mono font-bold text-white">
                  ৳{ship.totalCost.toLocaleString()}
                </span>
              </div>

              {ship.notes && (
                <p className="text-[11px] text-zinc-500 italic bg-zinc-900/60 p-2.5 rounded-xl">
                  "{ship.notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 5. TAB 3: EXPENSES LEDGER */}
      {activeTab === 'expenses' && (
        <div className="glass-card rounded-3xl p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Operating Expense Ledger</h3>
            <span className="text-xs font-mono font-bold text-red-400">
              Total Logged: ৳{totalExpenses.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Shipment Tag</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold">Logged By</th>
                  <th className="pb-3 font-semibold text-right">Amount (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-zinc-900/50">
                    <td className="py-3 font-mono text-zinc-400">{exp.date}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-amber-400 font-medium">
                      {exp.shipmentTag || '—'}
                    </td>
                    <td className="py-3 text-zinc-300 max-w-xs truncate">{exp.description}</td>
                    <td className="py-3 text-zinc-500 text-[11px]">{exp.loggedBy}</td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-100">
                      ৳{exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: NEW CASH REGISTER ENTRY (INFLOW / OUTFLOW) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-amber-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">New Cash Register Entry</h3>
                <p className="text-[11px] text-zinc-400">Record cash drawer, bank deposit, or expense</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCashEntry} className="space-y-3.5 text-xs">
              {/* Type Switcher (Inflow vs Outflow) */}
              <div>
                <label className="block text-zinc-400 mb-1.5 font-semibold">Entry Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCashForm({
                        ...cashForm,
                        type: 'inflow',
                        category: 'Showroom Cash Sale',
                      })
                    }
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      cashForm.type === 'inflow'
                        ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Cash Inflow (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCashForm({
                        ...cashForm,
                        type: 'outflow',
                        category: 'Fabric & Raw Materials',
                      })
                    }
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      cashForm.type === 'outflow'
                        ? 'bg-red-500 text-zinc-950 shadow-md shadow-red-500/20'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Cash Outflow (-)</span>
                  </button>
                </div>
              </div>

              {/* Account Selector */}
              <div>
                <label className="block text-zinc-400 mb-1">Target Account</label>
                <select
                  value={cashForm.account}
                  onChange={(e) =>
                    setCashForm({ ...cashForm, account: e.target.value as CashAccountType })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-200 focus:border-amber-500"
                >
                  <option value="Petty Cash Drawer">Petty Cash Drawer (Showroom Cash Box)</option>
                  <option value="City Bank Current">City Bank Current (Corporate Bank)</option>
                  <option value="bKash Merchant">bKash Merchant (Wallet)</option>
                  <option value="Nagad Business">Nagad Business (Wallet)</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-zinc-400 mb-1">Category</label>
                <select
                  value={cashForm.category}
                  onChange={(e) =>
                    setCashForm({ ...cashForm, category: e.target.value as CashCategory })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-200 focus:border-amber-500"
                >
                  {cashForm.type === 'inflow' ? (
                    <>
                      <option value="Showroom Cash Sale">Showroom Cash Sale</option>
                      <option value="Courier COD Received">Courier COD Received (Pathao Remittance)</option>
                      <option value="Customer Advance">Customer Advance (bKash/Cash)</option>
                      <option value="Bank Deposit/Withdrawal">Bank Deposit / Cash Withdrawal</option>
                      <option value="Owner Equity / Injection">Owner Equity / Working Capital Injection</option>
                      <option value="Miscellaneous">Miscellaneous Inflow</option>
                    </>
                  ) : (
                    <>
                      <option value="Fabric & Raw Materials">Fabric & Raw Materials (Textile purchase)</option>
                      <option value="Tailoring & Labor">Tailoring & Labor (Finishing workers)</option>
                      <option value="Packaging & Garment Bags">Packaging & Garment Bags</option>
                      <option value="Shop Rent & Utilities">Shop Rent & Utilities</option>
                      <option value="Facebook Ad Billing">Facebook Ad Billing</option>
                      <option value="Staff Lunch & Refreshments">Staff Lunch & Refreshments</option>
                      <option value="Courier Delivery Charges">Courier Delivery Charges</option>
                      <option value="Miscellaneous">Miscellaneous Expense</option>
                    </>
                  )}
                </select>
              </div>

              {/* Amount & Reference ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Amount (৳ BDT)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cashForm.amount}
                    onChange={(e) =>
                      setCashForm({ ...cashForm, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-amber-300 font-mono font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Voucher / Invoice / Ref #</label>
                  <input
                    type="text"
                    value={cashForm.referenceId}
                    onChange={(e) => setCashForm({ ...cashForm, referenceId: e.target.value })}
                    placeholder="e.g. INV-8842 or TrxID"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-200 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-zinc-400 mb-1">Description / Notes</label>
                <input
                  type="text"
                  required
                  value={cashForm.description}
                  onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                  placeholder="e.g. 2x Polo Showroom sale cash received"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-200"
                />
              </div>

              {/* Logged By */}
              <div>
                <label className="block text-zinc-400 mb-1">Performed By</label>
                <input
                  type="text"
                  value={cashForm.performedBy}
                  onChange={(e) => setCashForm({ ...cashForm, performedBy: e.target.value })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-200"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold shadow-md"
                >
                  Record Entry & Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SHIPMENT COGS */}
      {isShipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1">
              New Shipment Cost of Goods Sold (COGS)
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter batch yield and expenditures to compute true per-unit production cost
            </p>

            <form onSubmit={handleCreateShipment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Shipment Tag</label>
                  <input
                    type="text"
                    required
                    value={shipmentForm.shipmentTag}
                    onChange={(e) =>
                      setShipmentForm({ ...shipmentForm, shipmentTag: e.target.value })
                    }
                    placeholder="e.g. Linen Drop #3"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Product Line</label>
                  <input
                    type="text"
                    required
                    value={shipmentForm.productType}
                    onChange={(e) =>
                      setShipmentForm({ ...shipmentForm, productType: e.target.value })
                    }
                    placeholder="e.g. Signature Panjabi"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Total Batch Yield Units (Pieces)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={shipmentForm.yieldUnits}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      yieldUnits: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-amber-300 font-mono font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Raw Materials (Fabric/Buttons)</label>
                  <input
                    type="number"
                    value={shipmentForm.rawMaterials}
                    onChange={(e) =>
                      setShipmentForm({
                        ...shipmentForm,
                        rawMaterials: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Packaging (Boxes/Bags)</label>
                  <input
                    type="number"
                    value={shipmentForm.packaging}
                    onChange={(e) =>
                      setShipmentForm({
                        ...shipmentForm,
                        packaging: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Team Food & Overtime Dinner</label>
                  <input
                    type="number"
                    value={shipmentForm.food}
                    onChange={(e) =>
                      setShipmentForm({
                        ...shipmentForm,
                        food: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Transport / Freight</label>
                  <input
                    type="number"
                    value={shipmentForm.transport}
                    onChange={(e) =>
                      setShipmentForm({
                        ...shipmentForm,
                        transport: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Tailoring Labor</label>
                <input
                  type="number"
                  value={shipmentForm.labor}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      labor: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsShipmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  Calculate & Save COGS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
