import React, { useState, useEffect } from 'react';
import {
  ScanBarcode,
  Camera,
  Layers,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Flame,
  Check,
  Search,
  CheckSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order, OrderItem, Product } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { OverrideConfirmationModal } from './OverrideConfirmationModal';

interface DispatchScannerViewProps {
  orders: Order[];
  products: Product[];
  onDispatchSuccess: (
    orderId: string,
    itemId: string,
    dispatchedSku: string,
    dispatchedSize: 'S' | 'M' | 'L' | 'XL' | 'XXL',
    isOverridden: boolean,
    originalSku?: string,
    originalSize?: string
  ) => void;
  onCompleteOrderDispatch?: (orderId: string) => void;
}

export const DispatchScannerView: React.FC<DispatchScannerViewProps> = ({
  orders,
  products,
  onDispatchSuccess,
  onCompleteOrderDispatch,
}) => {
  // Approved & Dispatched orders in dispatch section
  const dispatchQueue = orders.filter((o) => !o.isDeleted && (o.status === 'Approved' || o.status === 'Dispatched'));

  // Currently selected order to pack/verify
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    dispatchQueue[0]?.id || ''
  );

  // Active Scanner modal target item
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetItemId, setScannerTargetItemId] = useState<string | null>(null);

  // Local state for manually typed EAN codes per item
  const [eanInputs, setEanInputs] = useState<{ [itemId: string]: string }>({});

  // Local checklist status for items in the selected order
  const [itemChecklist, setItemChecklist] = useState<{ [itemId: string]: boolean }>({});

  // Override modal state
  const [pendingOverride, setPendingOverride] = useState<{
    order: Order;
    item: OrderItem;
    scannedSku: string;
    scannedProduct?: Product;
    scannedSize: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  } | null>(null);

  const activeOrder = dispatchQueue.find((o) => o.id === selectedOrderId) || dispatchQueue[0];

  // Sync item checklist when active order changes
  useEffect(() => {
    if (activeOrder) {
      const initial: { [itemId: string]: boolean } = {};
      const inputs: { [itemId: string]: string } = {};
      (activeOrder.items || []).forEach((item) => {
        initial[item.id] = item.isDispatched || activeOrder.status === 'Dispatched';
        inputs[item.id] = item.sku || '';
      });
      setItemChecklist(initial);
      setEanInputs(inputs);
    }
  }, [selectedOrderId, activeOrder]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#ca8a04', '#eab308', '#22c55e', '#ffffff'],
      });
    } catch (e) {
      // ignore
    }
  };

  // Resolve scanned barcode / EAN code from product inventory
  const resolveScannedBarcode = (scanned: string) => {
    const clean = scanned.trim().toUpperCase();
    for (const prod of products) {
      for (const variant of prod.variants) {
        if (
          variant.sku.toUpperCase() === clean ||
          variant.barcode === clean ||
          clean.includes(variant.sku.toUpperCase())
        ) {
          return { product: prod, variant };
        }
      }
    }
    return null;
  };

  // Verify a specific item in the order checklist via typed/scanned EAN Code
  const handleVerifyItem = (targetItem: OrderItem, codeToVerify?: string) => {
    if (!activeOrder) return;
    const cleanCode = (codeToVerify || eanInputs[targetItem.id] || '').trim();

    if (!cleanCode) {
      alert('অনুগ্রহ করে EAN Code বা Barcode টাইপ করুন অথবা ক্যামেরা দিয়ে স্ক্যান করুন।');
      return;
    }

    const match = resolveScannedBarcode(cleanCode);

    if (!match) {
      // If code is typed and matches exact item SKU string
      if (cleanCode.toUpperCase() === targetItem.sku.toUpperCase()) {
        setItemChecklist((prev) => ({ ...prev, [targetItem.id]: true }));
        triggerConfetti();
        onDispatchSuccess(activeOrder.id, targetItem.id, targetItem.sku, targetItem.size, false);
        return;
      }
      alert(`Scanned EAN/Barcode "${cleanCode}" not found in Vistoosa product database.`);
      return;
    }

    const { product, variant } = match;
    const isExactMatch = variant.sku.toUpperCase() === targetItem.sku.toUpperCase();

    if (isExactMatch) {
      // Checklist checkmark verified!
      setItemChecklist((prev) => ({ ...prev, [targetItem.id]: true }));
      triggerConfetti();
      onDispatchSuccess(activeOrder.id, targetItem.id, variant.sku, variant.size, false);
    } else {
      // Real-Product Override modal
      setPendingOverride({
        order: activeOrder,
        item: targetItem,
        scannedSku: variant.sku,
        scannedProduct: product,
        scannedSize: variant.size,
      });
    }
  };

  const handleConfirmOverride = () => {
    if (!pendingOverride) return;
    triggerConfetti();
    setItemChecklist((prev) => ({ ...prev, [pendingOverride.item.id]: true }));
    onDispatchSuccess(
      pendingOverride.order.id,
      pendingOverride.item.id,
      pendingOverride.scannedSku,
      pendingOverride.scannedSize,
      true,
      pendingOverride.item.sku,
      pendingOverride.item.size
    );
    setPendingOverride(null);
  };

  // Handle camera barcode scanning for a target item
  const handleCameraScanResult = (scannedText: string) => {
    if (!activeOrder) return;
    const targetItem = (activeOrder.items || []).find((i) => i.id === scannerTargetItemId) || activeOrder.items[0];
    if (targetItem) {
      setEanInputs((prev) => ({ ...prev, [targetItem.id]: scannedText }));
      handleVerifyItem(targetItem, scannedText);
    }
  };

  // Check progress
  const totalItemsCount = activeOrder?.items?.length || 0;
  const checkedItemsCount = activeOrder?.items?.filter((i) => itemChecklist[i.id]).length || 0;
  const isAllItemsChecked = totalItemsCount > 0 && checkedItemsCount === totalItemsCount;

  const handleFinalizeDispatch = () => {
    if (!activeOrder) return;
    if (!isAllItemsChecked) {
      alert(`সবগুলো item verified না হওয়া পর্যন্ত অর্ডার Dispatched করা যাবে না। (${checkedItemsCount}/${totalItemsCount} verified)`);
      return;
    }
    triggerConfetti();
    if (onCompleteOrderDispatch) {
      onCompleteOrderDispatch(activeOrder.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Live Queue Countdown */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 border border-amber-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                Dispatch Verification Station
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <span>Order Item Dispatch Checklist</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Camera barcode & EAN Code verification checklist. Each item must be scanned and verified before marking order as Dispatched.
            </p>
          </div>

          {/* Live Countdown Badge */}
          <div className="flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl shrink-0">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">
                Dispatch Queue
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {dispatchQueue.length}
                </span>
                <span className="text-xs text-zinc-400">
                  {dispatchQueue.length === 1 ? 'Order Pending' : 'Orders Queue'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {dispatchQueue.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">All Dispatches Completed!</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Zero pending parcels on the packing table. All approved orders have been barcode-verified, stock deducted, and dispatched.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Workstation / Dispatch Checklist (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            {activeOrder && (
              <div className="glass-card rounded-3xl p-6 border-amber-500/30 shadow-xl relative space-y-5">
                {/* Station Top Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      Order ID: {activeOrder.id}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                      {activeOrder.status}
                    </span>
                    {activeOrder.channel === 'Showroom' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                        Showroom Order
                      </span>
                    )}
                  </div>

                  {/* Checklist Progress Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                        isAllItemsChecked
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      Dispatch Checklist: {checkedItemsCount} / {totalItemsCount} items verified
                    </span>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Customer</span>
                    <p className="font-bold text-zinc-100">{activeOrder.customerName}</p>
                    <p className="font-mono text-zinc-400">{activeOrder.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Delivery Address</span>
                    <p className="text-zinc-300 line-clamp-2">{activeOrder.address}</p>
                    <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                      {activeOrder.city} {activeOrder.district ? `(${activeOrder.district})` : ''} • Collect ৳{activeOrder.totalAmount}
                    </p>
                  </div>
                </div>

                {/* DISPATCH CHECKLIST ITEMS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Dispatch Checklist Items (আইটেম তালিকা)</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      Scan or type EAN Code for each item
                    </span>
                  </h4>

                  {(activeOrder.items || []).map((item, idx) => {
                    const isChecked = itemChecklist[item.id] || false;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isChecked
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                            : 'bg-zinc-900/80 border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Checkmark Status Icon */}
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                              }`}
                            >
                              {isChecked ? <Check className="w-5 h-5 stroke-[3]" /> : idx + 1}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-bold text-white">{item.productName}</h5>
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                                  Size: {item.size}
                                </span>
                                <span className="text-xs text-zinc-400">Qty: {item.quantity}</span>
                              </div>
                              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                                EAN / SKU Code: <strong className="text-amber-400">{item.sku}</strong>
                              </p>
                            </div>
                          </div>

                          {/* Item Status Badge */}
                          <div className="flex items-center gap-2">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Verified & Dispatched ✓</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pending Verification</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Scan & EAN Verification Row */}
                        {!isChecked && (
                          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-zinc-800/80">
                            <div className="relative flex-1 w-full">
                              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                              <input
                                type="text"
                                placeholder={`Enter EAN Code for ${item.productName}...`}
                                value={eanInputs[item.id] || ''}
                                onChange={(e) =>
                                  setEanInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleVerifyItem(item);
                                }}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <button
                              onClick={() => {
                                setScannerTargetItemId(item.id);
                                setIsScannerOpen(true);
                              }}
                              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                            >
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Camera Scan</span>
                            </button>

                            <button
                              onClick={() => handleVerifyItem(item)}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
                            >
                              Verify EAN Code
                            </button>

                            <button
                              onClick={() => {
                                setEanInputs((prev) => ({ ...prev, [item.id]: item.sku }));
                                handleVerifyItem(item, item.sku);
                              }}
                              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 text-[11px] font-medium transition shrink-0"
                              title="Pass exact SKU match"
                            >
                              Quick Pass
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Finalize Dispatch Button */}
                <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-zinc-400">
                    {isAllItemsChecked
                      ? '✓ All items verified in dispatch checklist! Ready for shipping.'
                      : `* Complete verifying all ${totalItemsCount} items to activate Order Dispatch.`}
                  </p>

                  <button
                    onClick={handleFinalizeDispatch}
                    disabled={!isAllItemsChecked && activeOrder.status !== 'Dispatched'}
                    className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                      isAllItemsChecked || activeOrder.status === 'Dispatched'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 shadow-emerald-500/20 active:scale-95'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>
                      {activeOrder.status === 'Dispatched'
                        ? 'Order Dispatched ✓'
                        : `Complete Order Dispatch (${checkedItemsCount}/${totalItemsCount})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Queue Sidebar (1 Col) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Upcoming Queue ({dispatchQueue.length})
              </h4>
              <span className="text-[10px] text-zinc-500">Auto FIFO order</span>
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {dispatchQueue.map((order, idx) => {
                const isSelected = order.id === activeOrder?.id;
                const itemsCount = order.items?.length || 0;
                const itemsChecked = order.items?.filter((i) => i.isDispatched || order.status === 'Dispatched').length || 0;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-md'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-zinc-200">
                        #{idx + 1} {order.id}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        ৳{order.totalAmount}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-zinc-200 truncate">
                      {order.customerName}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1">
                      <span className="truncate max-w-[150px]">
                        {order.items?.[0]?.productName} ({order.items?.[0]?.size})
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300 border border-zinc-700">
                        {itemsChecked}/{itemsCount} items checked
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerTargetItemId(null);
        }}
        onScanSuccess={handleCameraScanResult}
        products={products}
      />

      {/* Real-Product Override Confirmation Modal */}
      {pendingOverride && (
        <OverrideConfirmationModal
          order={pendingOverride.order}
          orderItem={pendingOverride.item}
          scannedSku={pendingOverride.scannedSku}
          scannedProduct={pendingOverride.scannedProduct}
          scannedSize={pendingOverride.scannedSize}
          onConfirmOverride={handleConfirmOverride}
          onCancel={() => setPendingOverride(null)}
        />
      )}
    </div>
  );
};
