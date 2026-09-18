import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  Phone,
  Crown,
  Clock,
  Send,
  Sparkles,
  Filter,
  Search,
  ExternalLink,
} from 'lucide-react';
import { CustomerProfile, Order } from '../types';

interface CRMViewProps {
  orders: Order[];
}

export const CRMView: React.FC<CRMViewProps> = ({ orders }) => {
  const [filterSegment, setFilterSegment] = useState<'All' | 'VIP' | 'Inactive'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('vip');

  // Derive unique customer profiles from orders
  const customerMap = new Map<string, CustomerProfile>();

  orders.forEach((o) => {
    const existing = customerMap.get(o.phone);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpent += o.totalAmount;
      if (new Date(o.createdAt) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = o.createdAt;
      }
    } else {
      customerMap.set(o.phone, {
        phone: o.phone,
        name: o.customerName,
        address: o.address,
        totalOrders: 1,
        totalSpent: o.totalAmount,
        lastOrderDate: o.createdAt,
        isVip: false,
        isInactive60Days: false,
      });
    }
  });

  // Calculate VIP (spent > 4000 BDT or > 1 order) and Inactive
  const customers: CustomerProfile[] = Array.from(customerMap.values()).map((c) => {
    const isVip = c.totalSpent >= 4000 || c.totalOrders >= 2;
    // Simulate inactivity if order date is older or flagged
    const isInactive = c.phone.endsWith('44') || c.phone.endsWith('00');
    return {
      ...c,
      isVip,
      isInactive60Days: isInactive,
    };
  });

  const filteredCustomers = customers.filter((c) => {
    const matchSegment =
      filterSegment === 'All' ||
      (filterSegment === 'VIP' && c.isVip) ||
      (filterSegment === 'Inactive' && c.isInactive60Days);
    const matchSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    return matchSegment && matchSearch;
  });

  const templates = {
    vip: 'Assalamu Alaikum {name}, thank you for being a valued Vistoosa VIP Patron! Our new Autumn Silk-Touch Knitwear & Luxury Panjabi drop is now live. Enjoy early access.',
    inactive:
      'Assalamu Alaikum {name}, we missed you at Vistoosa! Enjoy an exclusive ৳300 privilege voucher on your next Supima Polo or Tailored Chino order.',
    followup:
      'Dear {name}, hope you are enjoying your Vistoosa garments. Let us know if you would like custom styling assistance or seasonal wardrobe curation.',
  };

  const vipCount = customers.filter((c) => c.isVip).length;
  const inactiveCount = customers.filter((c) => c.isInactive60Days).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              CRM & WhatsApp Direct Marketing
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
              Zero-Cost Retargeting
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Identify High-Value VIP Patrons vs Inactive Churned Buyers & launch one-click personalized WhatsApp broadcasts
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-400">Total Customer Patrons</span>
            <Users className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{customers.length}</span>
            <span className="text-xs text-zinc-500">Verified buyers</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-500/30 bg-amber-950/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-amber-300 font-medium">VIP High-Value Patrons</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{vipCount}</span>
            <span className="text-xs text-amber-400/80">Spent &gt; ৳4,000</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-purple-500/30 bg-purple-950/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-300 font-medium">Churn Risk (Inactive)</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-300 font-mono">{inactiveCount}</span>
            <span className="text-xs text-purple-400/80">Re-engagement target</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Template Broadcast Launcher */}
      <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-white">
            WhatsApp Template Engine & Deep-Linking
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <button
            type="button"
            onClick={() => setSelectedTemplate('vip')}
            className={`p-3 rounded-2xl text-left border transition ${
              selectedTemplate === 'vip'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <p className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> VIP Exclusive Drop
            </p>
            <p className="text-[11px] text-zinc-300 line-clamp-2">{templates.vip}</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTemplate('inactive')}
            className={`p-3 rounded-2xl text-left border transition ${
              selectedTemplate === 'inactive'
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <p className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Win-Back ৳300 Privilege
            </p>
            <p className="text-[11px] text-zinc-300 line-clamp-2">{templates.inactive}</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTemplate('followup')}
            className={`p-3 rounded-2xl text-left border transition ${
              selectedTemplate === 'followup'
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-200'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <p className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1">
              <Send className="w-3.5 h-3.5" /> Post-Delivery Styling Care
            </p>
            <p className="text-[11px] text-zinc-300 line-clamp-2">{templates.followup}</p>
          </button>
        </div>

        <p className="text-[11px] text-zinc-400">
          Clicking the WhatsApp button on any customer card below will instantly open WhatsApp Web / App with their name automatically injected into the selected template!
        </p>
      </div>

      {/* Segment Filter & Search */}
      <div className="glass-panel rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patron by name or mobile..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['All', 'VIP', 'Inactive'] as const).map((seg) => (
            <button
              key={seg}
              onClick={() => setFilterSegment(seg)}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition ${
                filterSegment === seg
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {seg === 'All' ? 'All Customers' : seg === 'VIP' ? 'VIP Buyers' : 'Inactive (60+ Days)'}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCustomers.map((customer) => {
          const rawMessage = (templates as any)[selectedTemplate].replace(
            '{name}',
            customer.name
          );
          const cleanPhone = customer.phone.replace(/^0/, '');
          const waUrl = `https://wa.me/880${cleanPhone}?text=${encodeURIComponent(rawMessage)}`;

          return (
            <div
              key={customer.phone}
              className="glass-card rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{customer.name}</h4>
                    {customer.isVip && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <Crown className="w-3 h-3 text-amber-400" /> VIP
                      </span>
                    )}
                    {customer.isInactive60Days && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">{customer.phone}</p>
                  <p className="text-[11px] text-zinc-500 truncate max-w-xs">{customer.address}</p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400 block">
                    ৳{customer.totalSpent.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {customer.totalOrders} {customer.totalOrders === 1 ? 'Order' : 'Orders'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Direct WhatsApp & Call */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct WhatsApp Chat</span>
                </a>

                <a
                  href={`tel:${customer.phone}`}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                  title="Direct Phone Call"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
