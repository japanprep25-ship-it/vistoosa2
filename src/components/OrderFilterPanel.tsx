import React, { useState, useMemo } from 'react';
import {
  X,
  Filter,
  Search,
  RotateCcw,
  Calendar,
  DollarSign,
  Tag,
  MapPin,
  Truck,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Package,
} from 'lucide-react';
import { Order, OrderStatus, OrderChannel } from '../types';
import { detectDistrict } from '../utils/districtDetector';

export interface OrderFilterState {
  statuses: OrderStatus[];
  districts: string[];
  channels: OrderChannel[];
  paymentMethods: ('Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid')[];
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  minAmount: string; // numeric string
  maxAmount: string; // numeric string
  pathaoStatuses: ('Pickup Requested' | 'In Transit' | 'Delivered' | 'Exchange' | 'Partial Delivery' | 'Return' | 'Paid Return')[];
  products: string[]; // productName or SKU
  sizes: ('S' | 'M' | 'L' | 'XL' | 'XXL')[];
}

export const initialFilterState: OrderFilterState = {
  statuses: [],
  districts: [],
  channels: [],
  paymentMethods: [],
  fromDate: '',
  toDate: '',
  minAmount: '',
  maxAmount: '',
  pathaoStatuses: [],
  products: [],
  sizes: [],
};

export const countActiveFilters = (filters: OrderFilterState): number => {
  let count = 0;
  if (filters.statuses.length > 0) count++;
  if (filters.districts.length > 0) count++;
  if (filters.channels.length > 0) count++;
  if (filters.paymentMethods.length > 0) count++;
  if (filters.fromDate || filters.toDate) count++;
  if (filters.minAmount || filters.maxAmount) count++;
  if (filters.pathaoStatuses.length > 0) count++;
  if (filters.products.length > 0) count++;
  if (filters.sizes.length > 0) count++;
  return count;
};

export const filterOrders = (
  orders: Order[],
  filters: OrderFilterState,
  searchQuery: string
): Order[] => {
  return orders.filter((o) => {
    // Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchCustomer = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.phone.includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      const matchTracking = o.pathaoTrackingId ? o.pathaoTrackingId.toLowerCase().includes(q) : false;
      const matchItem = o.items.some(
        (item) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
      );
      if (!matchCustomer && !matchPhone && !matchId && !matchTracking && !matchItem) {
        return false;
      }
    }

    // 1. Order Status (multi-select)
    if (filters.statuses.length > 0 && !filters.statuses.includes(o.status)) {
      return false;
    }

    // 2. District (multi-select)
    if (filters.districts.length > 0) {
      const resolvedDist = o.district || detectDistrict(o.address || '', o.city || '').district || 'Dhaka';
      if (!filters.districts.includes(resolvedDist)) {
        return false;
      }
    }

    // 3. Channel (multi-select)
    if (filters.channels.length > 0 && !filters.channels.includes(o.channel)) {
      return false;
    }

    // 4. Payment Method (multi-select)
    if (filters.paymentMethods.length > 0 && !filters.paymentMethods.includes(o.paymentMethod)) {
      return false;
    }

    // 5. Date Range
    if (filters.fromDate) {
      const orderDate = new Date(o.createdAt);
      const from = new Date(filters.fromDate);
      from.setHours(0, 0, 0, 0);
      if (orderDate < from) return false;
    }
    if (filters.toDate) {
      const orderDate = new Date(o.createdAt);
      const to = new Date(filters.toDate);
      to.setHours(23, 59, 59, 999);
      if (orderDate > to) return false;
    }

    // 6. Amount Range
    if (filters.minAmount !== '' && !isNaN(Number(filters.minAmount))) {
      if (o.totalAmount < Number(filters.minAmount)) return false;
    }
    if (filters.maxAmount !== '' && !isNaN(Number(filters.maxAmount))) {
      if (o.totalAmount > Number(filters.maxAmount)) return false;
    }

    // 7. Pathao Status (multi-select)
    if (filters.pathaoStatuses.length > 0) {
      if (!o.pathaoStatus || !filters.pathaoStatuses.includes(o.pathaoStatus)) {
        return false;
      }
    }

    // 8. Product / SKU (multi-select)
    if (filters.products.length > 0) {
      const hasProduct = o.items.some(
        (item) => filters.products.includes(item.productName) || filters.products.includes(item.sku)
      );
      if (!hasProduct) return false;
    }

    // 9. Size (multi-select)
    if (filters.sizes.length > 0) {
      const hasSize = o.items.some((item) => filters.sizes.includes(item.size as any));
      if (!hasSize) return false;
    }

    return true;
  });
};

interface OrderFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  filters: OrderFilterState;
  onUpdateFilters: (newFilters: OrderFilterState) => void;
  onClearAll: () => void;
  totalOrdersCount: number;
  filteredOrdersCount: number;
}

export const OrderFilterPanel: React.FC<OrderFilterPanelProps> = ({
  isOpen,
  onClose,
  orders,
  filters,
  onUpdateFilters,
  onClearAll,
  totalOrdersCount,
  filteredOrdersCount,
}) => {
  const [districtSearch, setDistrictSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Accordion open/close states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    status: true,
    district: true,
    channel: true,
    payment: true,
    date: false,
    amount: false,
    pathao: false,
    product: false,
    size: false,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Extract unique Districts from dataset
  const dynamicDistrictCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const dist = o.district || detectDistrict(o.address || '', o.city || '').district || 'Dhaka';
      counts[dist] = (counts[dist] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // Extract unique Products from dataset
  const dynamicProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (item.productName) {
          counts[item.productName] = (counts[item.productName] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  if (!isOpen) return null;

  const activeCount = countActiveFilters(filters);

  // Helper toggle functions
  const toggleArrayItem = <T,>(key: keyof OrderFilterState, item: T) => {
    const currentList = (filters[key] as T[]) || [];
    const exists = currentList.includes(item);
    const updated = exists ? currentList.filter((i) => i !== item) : [...currentList, item];
    onUpdateFilters({ ...filters, [key]: updated });
  };

  const setAllArrayItems = <T,>(key: keyof OrderFilterState, items: T[], selectAll: boolean) => {
    onUpdateFilters({ ...filters, [key]: selectAll ? items : [] });
  };

  const filteredDistrictList = dynamicDistrictCounts.filter((d) =>
    d.name.toLowerCase().includes(districtSearch.toLowerCase().trim())
  );

  const filteredProductList = dynamicProductCounts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-zinc-950 border-l border-zinc-800 text-zinc-100 h-full shadow-2xl flex flex-col z-10 font-sans">
        {/* Drawer Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Excel Filter Panel
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950">
                    {activeCount} Active
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Showing {filteredOrdersCount} of {totalOrdersCount} orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 transition cursor-pointer"
                title="Clear All Filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Filter Accordions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* 1. ORDER STATUS FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('status')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-200">1. Order Status</span>
                {filters.statuses.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {filters.statuses.length} selected
                  </span>
                )}
              </div>
              {expandedSections.status ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.status && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-1.5 bg-zinc-950/40">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Select Statuses</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      onClick={() =>
                        setAllArrayItems(
                          'statuses',
                          ['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'],
                          true
                        )
                      }
                      className="text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      onClick={() => setAllArrayItems('statuses', [], false)}
                      className="text-zinc-500 hover:text-zinc-300 hover:underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {[
                  { value: 'Pending', label: 'Pending Review', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                  { value: 'Approved', label: 'Approved • Ready for Packing', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                  { value: 'Dispatched', label: 'Dispatched • In Transit', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                  { value: 'Delivered', label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                  { value: 'Cancelled', label: 'Cancelled', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
                ].map((st) => {
                  const isChecked = filters.statuses.includes(st.value as OrderStatus);
                  const count = orders.filter((o) => o.status === st.value).length;
                  return (
                    <label
                      key={st.value}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/50 text-white'
                          : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayItem('statuses', st.value as OrderStatus)}
                          className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                        />
                        <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. DISTRICT FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('district')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">2. District</span>
                {filters.districts.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {filters.districts.length} selected
                  </span>
                )}
              </div>
              {expandedSections.district ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.district && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-2 bg-zinc-950/40">
                {/* Search district input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    placeholder="Search district name..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    Districts ({filteredDistrictList.length})
                  </span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      onClick={() =>
                        setAllArrayItems(
                          'districts',
                          dynamicDistrictCounts.map((d) => d.name),
                          true
                        )
                      }
                      className="text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      onClick={() => setAllArrayItems('districts', [], false)}
                      className="text-zinc-500 hover:text-zinc-300 hover:underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {filteredDistrictList.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 text-center py-3">No matching district found</p>
                  ) : (
                    filteredDistrictList.map((dist) => {
                      const isChecked = filters.districts.includes(dist.name);
                      return (
                        <label
                          key={dist.name}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 font-semibold'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleArrayItem('districts', dist.name)}
                              className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                            />
                            <span>{dist.name}</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-500">
                            {dist.count} orders
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. CHANNEL FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('channel')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-zinc-200">3. Sales Channel</span>
                {filters.channels.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    {filters.channels.length} selected
                  </span>
                )}
              </div>
              {expandedSections.channel ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.channel && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-1.5 bg-zinc-950/40">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Channels</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      onClick={() =>
                        setAllArrayItems(
                          'channels',
                          ['Facebook', 'Instagram', 'WhatsApp', 'Website', 'Showroom'],
                          true
                        )
                      }
                      className="text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      onClick={() => setAllArrayItems('channels', [], false)}
                      className="text-zinc-500 hover:text-zinc-300 hover:underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {[
                  { name: 'Facebook', badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
                  { name: 'Instagram', badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
                  { name: 'WhatsApp', badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                  { name: 'Website', badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
                  { name: 'Showroom', badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
                ].map((ch) => {
                  const isChecked = filters.channels.includes(ch.name as OrderChannel);
                  const count = orders.filter((o) => o.channel === ch.name).length;
                  return (
                    <label
                      key={ch.name}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/50 text-white font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayItem('channels', ch.name as OrderChannel)}
                          className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                        />
                        <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${ch.badgeColor}`}>
                          {ch.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. PAYMENT METHOD FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('payment')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-zinc-200">4. Payment Method</span>
                {filters.paymentMethods.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    {filters.paymentMethods.length} selected
                  </span>
                )}
              </div>
              {expandedSections.payment ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.payment && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-1.5 bg-zinc-950/40">
                {['Cash on Delivery', 'bKash', 'Nagad', 'Prepaid'].map((pm) => {
                  const isChecked = filters.paymentMethods.includes(pm as any);
                  const count = orders.filter((o) => o.paymentMethod === pm).length;
                  return (
                    <label
                      key={pm}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/50 text-white font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayItem('paymentMethods', pm as any)}
                          className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                        />
                        <span>{pm}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. DATE RANGE FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('date')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-zinc-200">5. Date Range</span>
                {(filters.fromDate || filters.toDate) && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    Active
                  </span>
                )}
              </div>
              {expandedSections.date ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.date && (
              <div className="p-3 pt-2 border-t border-zinc-800/60 space-y-2.5 bg-zinc-950/40">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">From Date</label>
                    <input
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => onUpdateFilters({ ...filters, fromDate: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">To Date</label>
                    <input
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => onUpdateFilters({ ...filters, toDate: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      onUpdateFilters({ ...filters, fromDate: today, toDate: today });
                    }}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 7);
                      onUpdateFilters({
                        ...filters,
                        fromDate: start.toISOString().split('T')[0],
                        toDate: end.toISOString().split('T')[0],
                      });
                    }}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    Last 7 Days
                  </button>
                  <button
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 30);
                      onUpdateFilters({
                        ...filters,
                        fromDate: start.toISOString().split('T')[0],
                        toDate: end.toISOString().split('T')[0],
                      });
                    }}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    Last 30 Days
                  </button>
                  {(filters.fromDate || filters.toDate) && (
                    <button
                      onClick={() => onUpdateFilters({ ...filters, fromDate: '', toDate: '' })}
                      className="text-[10px] px-2 py-1 text-red-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. AMOUNT RANGE FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('amount')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">6. Amount Range (৳)</span>
                {(filters.minAmount || filters.maxAmount) && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Active
                  </span>
                )}
              </div>
              {expandedSections.amount ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.amount && (
              <div className="p-3 pt-2 border-t border-zinc-800/60 space-y-2.5 bg-zinc-950/40">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Min Amount (৳)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minAmount}
                      onChange={(e) => onUpdateFilters({ ...filters, minAmount: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Max Amount (৳)</label>
                    <input
                      type="number"
                      placeholder="50000"
                      value={filters.maxAmount}
                      onChange={(e) => onUpdateFilters({ ...filters, maxAmount: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    onClick={() => onUpdateFilters({ ...filters, minAmount: '0', maxAmount: '1500' })}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    Under ৳1,500
                  </button>
                  <button
                    onClick={() => onUpdateFilters({ ...filters, minAmount: '1500', maxAmount: '3500' })}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    ৳1,500 - ৳3,500
                  </button>
                  <button
                    onClick={() => onUpdateFilters({ ...filters, minAmount: '3500', maxAmount: '' })}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    ৳3,500+
                  </button>
                  {(filters.minAmount || filters.maxAmount) && (
                    <button
                      onClick={() => onUpdateFilters({ ...filters, minAmount: '', maxAmount: '' })}
                      className="text-[10px] px-2 py-1 text-red-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 7. PATHAO COURIER STATUS FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('pathao')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-200">7. Pathao Status</span>
                {filters.pathaoStatuses.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {filters.pathaoStatuses.length} selected
                  </span>
                )}
              </div>
              {expandedSections.pathao ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.pathao && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-1.5 bg-zinc-950/40">
                {[
                  'Pickup Requested',
                  'In Transit',
                  'Delivered',
                  'Exchange',
                  'Partial Delivery',
                  'Return',
                  'Paid Return',
                ].map((ps) => {
                  const isChecked = filters.pathaoStatuses.includes(ps as any);
                  const count = orders.filter((o) => o.pathaoStatus === ps).length;
                  return (
                    <label
                      key={ps}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayItem('pathaoStatuses', ps as any)}
                          className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                        />
                        <span>{ps}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 8. PRODUCT / SKU FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('product')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-zinc-200">8. Product / SKU</span>
                {filters.products.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {filters.products.length} selected
                  </span>
                )}
              </div>
              {expandedSections.product ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.product && (
              <div className="p-3 pt-1 border-t border-zinc-800/60 space-y-2 bg-zinc-950/40">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product name..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {filteredProductList.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 text-center py-3">No matching products found</p>
                  ) : (
                    filteredProductList.map((prod) => {
                      const isChecked = filters.products.includes(prod.name);
                      return (
                        <label
                          key={prod.name}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 font-semibold'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleArrayItem('products', prod.name)}
                              className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5 shrink-0"
                            />
                            <span className="truncate">{prod.name}</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-500 shrink-0">
                            {prod.count} items
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 9. SIZE FILTER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <button
              onClick={() => toggleSection('size')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-zinc-200">9. Size</span>
                {filters.sizes.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    {filters.sizes.length} selected
                  </span>
                )}
              </div>
              {expandedSections.size ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {expandedSections.size && (
              <div className="p-3 pt-2 border-t border-zinc-800/60 bg-zinc-950/40">
                <div className="flex flex-wrap gap-2">
                  {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((sz) => {
                    const isChecked = filters.sizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleArrayItem('sizes', sz)}
                        className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-sm shadow-amber-500/20'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />}
                        <span>{sz}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer / Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between gap-3 sticky bottom-0">
          <button
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 disabled:opacity-40 transition cursor-pointer"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer text-center"
          >
            Show {filteredOrdersCount} Orders
          </button>
        </div>
      </div>
    </div>
  );
};
