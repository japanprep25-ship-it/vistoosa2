import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ExternalLink,
  MessageSquare,
  Phone,
  Layers,
  ChevronRight,
  Filter,
  Sparkles,
  Bot,
  X,
  Image as ImageIcon,
  Edit2,
  Package,
} from 'lucide-react';
import { Order, OrderStatus, OrderChannel, Product } from '../types';

interface OrderEngineViewProps {
  orders: Order[];
  products: Product[];
  onApproveOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onGoToDispatch: (orderId: string) => void;
  onCreateOrder: (newOrder: Partial<Order>) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
}

export const OrderEngineView: React.FC<OrderEngineViewProps> = ({
  orders,
  products,
  onApproveOrder,
  onCancelOrder,
  onGoToDispatch,
  onCreateOrder,
  onUpdateOrder,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>('All');
  const [selectedChannel, setSelectedChannel] = useState<OrderChannel | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Edit Order Form State
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: 'Inside Dhaka' as 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka',
    channel: 'WhatsApp' as OrderChannel,
    productId: '',
    customProductName: '',
    size: 'M' as 'S' | 'M' | 'L' | 'XL' | 'XXL',
    quantity: 1,
    unitPrice: 1650,
    paymentMethod: 'Cash on Delivery' as 'Cash on Delivery' | 'bKash' | 'Nagad' | 'Prepaid',
    notes: '',
  });

  const handleOpenEditModal = (order: Order) => {
    const firstItem = order.items && order.items[0];
    const matchedProduct = products.find(
      (p) =>
        p.id === firstItem?.sku ||
        p.name.toLowerCase() === (firstItem?.productName || '').toLowerCase()
    );

    setEditingOrder(order);
    setEditFormData({
      customerName: order.customerName || '',
      phone: order.phone || '',
      address: order.address || '',
      city: order.city || 'Inside Dhaka',
      channel: order.channel || 'WhatsApp',
      productId: matchedProduct?.id || (products[0]?.id || ''),
      customProductName: firstItem?.productName || '',
      size: (firstItem?.size as any) || 'M',
      quantity: firstItem?.quantity || 1,
      unitPrice: firstItem?.unitPrice || 1650,
      paymentMethod: order.paymentMethod || 'Cash on Delivery',
      notes: order.notes || '',
    });
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const matchedProduct = products.find((p) => p.id === editFormData.productId);
    const resolvedProductName =
      editFormData.customProductName.trim() ||
      (matchedProduct ? matchedProduct.name : 'Vistoosa Garment');

    const matchedVariant = matchedProduct?.variants?.find((v) => v.size === editFormData.size);
    const resolvedSku =
      matchedVariant?.sku ||
      (editingOrder.items[0]?.sku
        ? `${editingOrder.items[0].sku.split('-')[0]}-${editFormData.size}`
        : `VIS-${editFormData.size}`);

    const unitPrice =
      editFormData.unitPrice > 0
        ? editFormData.unitPrice
        : matchedProduct?.retailPrice || 1650;

    const deliveryFee =
      editFormData.city === 'Inside Dhaka'
        ? 60
        : editFormData.city === 'Sub-Dhaka'
        ? 100
        : 150;

    const subtotal = unitPrice * editFormData.quantity;
    const totalAmount = subtotal + deliveryFee;

    const updatedOrder: Order = {
      ...editingOrder,
      customerName: editFormData.customerName.trim(),
      phone: editFormData.phone.trim(),
      address: editFormData.address.trim(),
      city: editFormData.city,
      channel: editFormData.channel,
      items: [
        {
          id: editingOrder.items[0]?.id || `item-${editingOrder.id}-1`,
          productName: resolvedProductName,
          sku: resolvedSku,
          color: matchedProduct?.color || editingOrder.items[0]?.color || 'Midnight Navy',
          size: editFormData.size,
          quantity: editFormData.quantity,
          unitPrice,
        },
        // Preserve any secondary items if exist
        ...((editingOrder.items || []).slice(1)),
      ],
      totalAmount,
      deliveryFee,
      paymentMethod: editFormData.paymentMethod,
      notes: editFormData.notes.trim(),
    };

    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
    setEditingOrder(null);
  };

  // New Order Form state
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: 'Inside Dhaka' as 'Inside Dhaka' | 'Sub-Dhaka' | 'Outside Dhaka',
    channel: 'WhatsApp' as OrderChannel,
    productId: products[0]?.id || '',
    size: 'L' as 'S' | 'M' | 'L' | 'XL' | 'XXL',
    quantity: 1,
    paymentMethod: 'Cash on Delivery' as 'Cash on Delivery' | 'bKash' | 'Nagad',
    notes: '',
  });

  const filteredOrders = orders.filter((o) => {
    const matchStatus = selectedStatus === 'All' || o.status === selectedStatus;
    const matchChannel = selectedChannel === 'All' || o.channel === selectedChannel;
    const matchQuery =
      searchQuery === '' ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.pathaoTrackingId && o.pathaoTrackingId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchChannel && matchQuery;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            Pending Review
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Truck className="w-3 h-3 text-blue-400" />
            Approved • Ready for Packing
          </span>
        );
      case 'Dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Dispatched • In Transit
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Delivered
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <XCircle className="w-3 h-3 text-zinc-500" />
            Cancelled
          </span>
        );
    }
  };

  const getChannelColor = (channel: OrderChannel) => {
    switch (channel) {
      case 'WhatsApp':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'Facebook':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'Instagram':
        return 'text-pink-400 border-pink-500/30 bg-pink-500/10';
      case 'Website':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'Showroom':
        return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = (products || []).find((p) => p.id === formData.productId) || (products && products[0]);
    if (!product) return;
    const variant = (product.variants || []).find((v) => v.size === formData.size) || (product.variants && product.variants[0]);
    if (!variant) return;
    const deliveryFee = formData.city === 'Inside Dhaka' ? 60 : formData.city === 'Sub-Dhaka' ? 100 : 150;
    const subtotal = product.retailPrice * formData.quantity;

    const newOrder: Order = {
      id: `VIS-${Math.floor(2050 + Math.random() * 900)}`,
      customerName: formData.customerName,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      channel: formData.channel,
      items: [
        {
          id: `item-${Date.now()}`,
          productName: product.name,
          sku: variant.sku,
          color: product.color,
          size: formData.size,
          quantity: formData.quantity,
          unitPrice: product.retailPrice,
        },
      ],
      totalAmount: subtotal + deliveryFee,
      deliveryFee,
      paymentMethod: formData.paymentMethod,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      notes: formData.notes,
    };

    onCreateOrder(newOrder);
    setIsCreateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Multi-Channel Order Engine
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
              Auto Pathao Webhook
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Website, Social & Showroom Orders stream here into centralized queue
          </p>
        </div>

        <button
          id="btn-create-new-order"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Manual Order</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, phone, order #, PTH tracking..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full pb-1 md:pb-0 scrollbar-none">
          {(['All', 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'] as const).map(
            (st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
                  selectedStatus === st
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>

        {/* Channel Select */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as any)}
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Channels</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="Website">Website</option>
            <option value="Showroom">Showroom</option>
          </select>
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-3xl">
            <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No orders found</p>
            <p className="text-xs text-zinc-500">Try changing your search query or status filter</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="glass-card rounded-2xl p-4 transition-all duration-200 hover:border-zinc-700 relative overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Order Top Meta */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {order.id}
                    </span>
                    {getStatusBadge(order.status)}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getChannelColor(
                        order.channel
                      )}`}
                    >
                      {order.channel}
                    </span>

                    {/* Meta / Inbound Source Tag */}
                    {order.source && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-300 font-medium">
                        {order.source === 'messenger'
                          ? 'Messenger DM'
                          : order.source === 'instagram'
                          ? 'Instagram DM'
                          : order.source === 'whatsapp'
                          ? 'WhatsApp Chat'
                          : order.source}
                      </span>
                    )}

                    {/* AI Verified Badge */}
                    {order.confidence === 'complete' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                        AI Verified
                      </span>
                    )}

                    {/* View Chat Transcript Button */}
                    {order.rawConversation && order.rawConversation.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedChatOrder(order)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold flex items-center gap-1 transition"
                      >
                        <MessageSquare className="w-2.5 h-2.5" />
                        <span>Chat Transcript ({order.rawConversation.length})</span>
                      </button>
                    )}

                    <span className="text-[10px] text-zinc-500">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2 pt-1">
                    <h4 className="text-sm font-bold text-zinc-100">{order.customerName}</h4>
                    <span className="text-xs font-mono text-zinc-400">{order.phone}</span>
                    <span className="text-xs text-zinc-400">• {order.address}</span>
                  </div>

                  {/* Order Items */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {order.productImageUrl && (
                      <a
                        href={order.productImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-7 h-7 rounded-lg overflow-hidden border border-zinc-700 hover:border-amber-500 transition shrink-0"
                        title="View image sent by customer"
                      >
                        <img
                          src={order.productImageUrl}
                          alt="Customer product photo"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    )}
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-1.5 text-xs bg-zinc-900/80 px-2.5 py-1 rounded-xl border border-zinc-800"
                      >
                        <span className="font-medium text-zinc-200">{item.productName}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                          {item.size}
                        </span>
                        {item.overriddenFromSize && (
                          <span className="text-[9px] text-amber-400 font-mono">
                            (override from {item.overriddenFromSize})
                          </span>
                        )}
                        <span className="text-zinc-500 text-[11px]">x{item.quantity}</span>
                        <span className="text-zinc-300 font-mono text-[11px]">
                          ৳{(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Pathao Tracking, Financials & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800/60">
                  {/* Financial Total */}
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-zinc-100 font-mono">
                      ৳{order.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {order.paymentMethod} (Incl. Delivery ৳{order.deliveryFee})
                    </p>
                    {order.pathaoTrackingId && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 mt-1">
                        <Truck className="w-3 h-3" />
                        <span>{order.pathaoTrackingId}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions according to Order State */}
                  <div className="flex items-center gap-2">
                    {order.status === 'Pending' && (
                      <>
                        <button
                          id={`btn-edit-order-${order.id}`}
                          onClick={() => handleOpenEditModal(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-zinc-700 hover:border-amber-500/40 text-xs font-semibold shadow-sm transition active:scale-95"
                          title="Edit Customer Details, Phone, Address, Product, Size"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          id={`btn-approve-order-${order.id}`}
                          onClick={() => onApproveOrder(order.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95"
                          title="Trigger automated Pathao pickup and move to Approved"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Pathao Pickup</span>
                        </button>

                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-xs font-medium transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}

                    {order.status === 'Approved' && (
                      <button
                        id={`btn-dispatch-order-${order.id}`}
                        onClick={() => onGoToDispatch(order.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-sm transition active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Pack & Scan Barcode</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {order.status === 'Dispatched' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs">
                        <Truck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Pathao Pickup En Route</span>
                      </div>
                    )}

                    {/* Direct WhatsApp Call / Message */}
                    <a
                      href={`https://wa.me/880${order.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                        `Assalamu Alaikum ${order.customerName}, this is Vistoosa Haute Couture regarding your order #${order.id}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 hover:bg-zinc-800 transition"
                      title="WhatsApp Customer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={`tel:${order.phone}`}
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition"
                      title="Direct Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Create New Vistoosa Order</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Asif Mahmud"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Delivery Street Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="House, Road, Area, Dhaka"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">City / Region</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="Inside Dhaka">Inside Dhaka (৳60)</option>
                    <option value="Sub-Dhaka">Sub-Dhaka (৳100)</option>
                    <option value="Outside Dhaka">Outside Dhaka (৳150)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Channel Origin</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Website">Website</option>
                    <option value="Showroom">Showroom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">Product</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (৳{p.retailPrice})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Size</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                >
                  Create & Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pending Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Edit Pending Order</span>
                    <span className="font-mono text-xs text-amber-400">#{editingOrder.id}</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Modify customer details, delivery location, size, or product name
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Customer Name (নাম)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    placeholder="e.g. Asif Mahmud"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Phone Number (নাম্বার)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Delivery Address (অ্যাড্রেস)</label>
                <textarea
                  required
                  rows={2}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="House, Road, Area / Thana, District"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">City / Delivery Zone</label>
                  <select
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Inside Dhaka">Inside Dhaka (৳60)</option>
                    <option value="Sub-Dhaka">Sub-Dhaka (৳100)</option>
                    <option value="Outside Dhaka">Outside Dhaka (৳150)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Channel Origin</label>
                  <select
                    value={editFormData.channel}
                    onChange={(e) => setEditFormData({ ...editFormData, channel: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Website">Website</option>
                    <option value="Showroom">Showroom</option>
                  </select>
                </div>
              </div>

              {/* Product selection and Custom Product Name */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    Product & Size Details (প্রোডাক্ট ও সাইজ)
                  </span>
                  <span className="text-[10px] text-zinc-500">Edit item specifications</span>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Catalog Product (প্রোডাক্ট নির্বাচন)</label>
                  <select
                    value={editFormData.productId}
                    onChange={(e) => {
                      const selProd = products.find((p) => p.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        productId: e.target.value,
                        customProductName: selProd ? selProd.name : editFormData.customProductName,
                        unitPrice: selProd ? selProd.retailPrice : editFormData.unitPrice,
                      });
                    }}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ৳{p.retailPrice}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">
                    Product Title (প্রোডাক্ট নেম) <span className="text-[10px] text-zinc-500">(editable)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.customProductName}
                    onChange={(e) => setEditFormData({ ...editFormData, customProductName: e.target.value })}
                    placeholder="e.g. Supima Pique Polo or Custom Item"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Size (সাইজ)</label>
                    <select
                      value={editFormData.size}
                      onChange={(e) => setEditFormData({ ...editFormData, size: e.target.value as any })}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    >
                      <option value="S">S (36-38")</option>
                      <option value="M">M (38-40")</option>
                      <option value="L">L (40-42")</option>
                      <option value="XL">XL (42-44")</option>
                      <option value="XXL">XXL (44-46")</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Quantity (পরিমাণ)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editFormData.quantity}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Unit Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.unitPrice}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          unitPrice: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Payment Method</label>
                  <select
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Total Preview</label>
                  <div className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-amber-400 font-mono font-bold">
                    ৳{((editFormData.unitPrice * editFormData.quantity) + (editFormData.city === 'Inside Dhaka' ? 60 : editFormData.city === 'Sub-Dhaka' ? 100 : 150)).toLocaleString()}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">
                      (৳{editFormData.city === 'Inside Dhaka' ? 60 : editFormData.city === 'Sub-Dhaka' ? 100 : 150} delivery)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Order Notes / Instructions</label>
                <input
                  type="text"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Special courier delivery instruction, urgent tag, etc."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-edit-order"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 font-bold text-zinc-950 shadow-md shadow-amber-500/20 active:scale-95 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Transcript Modal for Meta / Social Orders */}
      {selectedChatOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Chat Transcript & AI Parsing</span>
                    <span className="font-mono text-xs text-amber-400">#{selectedChatOrder.id}</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedChatOrder.customerName} • {selectedChatOrder.channel} ({selectedChatOrder.source || 'chat'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChatOrder(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Extraction Summary Banner */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-zinc-300">
                  AI Confidence:{' '}
                  <strong className="text-emerald-400 uppercase font-mono">
                    {selectedChatOrder.confidence || 'complete'}
                  </strong>
                </span>
              </div>
              {selectedChatOrder.missingFields && selectedChatOrder.missingFields.length > 0 ? (
                <span className="text-amber-400 text-[11px]">
                  Missing: {selectedChatOrder.missingFields.join(', ')}
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium">All details captured</span>
              )}
            </div>

            {/* Photo attachment if available */}
            {selectedChatOrder.productImageUrl && (
              <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-3">
                <img
                  src={selectedChatOrder.productImageUrl}
                  alt="Customer attachment"
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-zinc-200">Customer Sent Product Image</p>
                  <a
                    href={selectedChatOrder.productImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline text-[11px] inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>Open full photo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {selectedChatOrder.rawConversation && selectedChatOrder.rawConversation.length > 0 ? (
                selectedChatOrder.rawConversation.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      msg.sender === 'customer' || msg.sender === 'user' ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">
                        {msg.sender === 'customer' || msg.sender === 'user'
                          ? selectedChatOrder.customerName || 'Customer'
                          : 'Vistoosa Fashion AI'}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed whitespace-pre-line ${
                        msg.sender === 'customer' || msg.sender === 'user'
                          ? 'bg-zinc-900 text-zinc-200 border border-zinc-800'
                          : 'bg-purple-950/50 text-purple-200 border border-purple-800/40'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No transcript recorded for this order.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedChatOrder(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
