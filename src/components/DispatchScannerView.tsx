import React, { useState } from 'react';
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
}

export const DispatchScannerView: React.FC<DispatchScannerViewProps> = ({
  orders,
  products,
  onDispatchSuccess,
}) => {
  // Only Approved orders are in the dispatch queue
  const dispatchQueue = orders.filter((o) => o.status === 'Approved');

  // Currently focused order to pack
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    dispatchQueue[0]?.id || ''
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Override modal state
  const [pendingOverride, setPendingOverride] = useState<{
    order: Order;
    item: OrderItem;
    scannedSku: string;
    scannedProduct?: Product;
    scannedSize: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  } | null>(null);

  const activeOrder = (dispatchQueue || []).find((o) => o.id === selectedOrderId) || (dispatchQueue && dispatchQueue[0]);
  const activeItem = activeOrder?.items?.[0];

  // Helper to find product and variant from scanned barcode or SKU
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

  const handleBarcodeScanned = (scannedText: string) => {
    if (!activeOrder || !activeItem) return;

    const match = resolveScannedBarcode(scannedText);

    if (!match) {
      alert(`Scanned tag "${scannedText}" not recognized in Vistoosa product inventory database.`);
      return;
    }

    const { product, variant } = match;
    const isExactMatch = variant.sku === activeItem.sku;

    if (isExactMatch) {
      // Normal dispatch match!
      triggerConfetti();
      onDispatchSuccess(
        activeOrder.id,
        activeItem.id,
        variant.sku,
        variant.size,
        false
      );
    } else {
      // CRITICAL LOGIC: REAL-PRODUCT OVERRIDE!
      // Packer scanned a different size or variant (e.g. ordered L, scanned XL)
      setPendingOverride({
        order: activeOrder,
        item: activeItem,
        scannedSku: variant.sku,
        scannedProduct: product,
        scannedSize: variant.size,
      });
    }
  };

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

  const handleConfirmOverride = () => {
    if (!pendingOverride) return;
    triggerConfetti();
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

  return (
    <div className="space-y-6">
      {/* Header & Live Queue Countdown */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 border border-amber-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                Packing Floor Live Feed
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <span>Smart Barcode Dispatch Engine</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Camera barcode & EAN-13 scanning with automatic Real-Product Override logic and warehouse stock deduction.
            </p>
          </div>

          {/* Live Countdown Badge */}
          <div className="flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl shrink-0">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">
                Live Dispatch Queue
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {dispatchQueue.length}
                </span>
                <span className="text-xs text-zinc-400">
                  {dispatchQueue.length === 1 ? 'Order Pending' : 'Orders Remaining'}
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
            Zero pending parcels on the packing table. All approved orders have been barcode-verified, stock deducted, and tagged for Pathao courier pickup.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Packing Workstation (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            {activeOrder && activeItem && (
              <div className="glass-card rounded-3xl p-6 border-amber-500/30 shadow-xl relative">
                {/* Station Top Status */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                      Packing Station #1
                    </span>
                    <span className="text-xs text-zinc-400 font-mono font-bold">
                      {activeOrder.id}
                    </span>
                  </div>

                  <span className="text-xs text-zinc-400">
                    Pathao Tracking:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {activeOrder.pathaoTrackingId || 'Auto Assigned'}
                    </strong>
                  </span>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                      Recipient
                    </span>
                    <p className="font-bold text-zinc-100">{activeOrder.customerName}</p>
                    <p className="font-mono text-zinc-400">{activeOrder.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                      Destination
                    </span>
                    <p className="text-zinc-300 line-clamp-2">{activeOrder.address}</p>
                    <span className="text-[10px] text-amber-400 font-semibold mt-0.5 inline-block">
                      {activeOrder.city} • Collect ৳{activeOrder.totalAmount}
                    </span>
                  </div>
                </div>

                {/* Target Garment Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-700/80 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-amber-400 font-brand text-2xl font-bold border border-zinc-700">
                        {activeItem.size}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                          Item to verify & pack
                        </span>
                        <h4 className="text-base font-bold text-white">
                          {activeItem.productName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                            Expected SKU: {activeItem.sku}
                          </span>
                          <span className="text-xs text-zinc-400">Qty: {activeItem.quantity}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                        Subtotal
                      </span>
                      <span className="text-lg font-bold font-mono text-zinc-100">
                        ৳{activeItem.unitPrice * activeItem.quantity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Override Logic Notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 mb-6">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Real-Product Override Protection:</strong> If you grab a different size (e.g. customer ordered Size {activeItem.size}, but warehouse tag scanned is XL or XXL), the system will safely update the final invoice and deduct the physically scanned size from final inventory.
                  </p>
                </div>

                {/* Primary Scan Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    id="btn-open-camera-scanner"
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-2.5"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Launch Camera Barcode Scanner</span>
                  </button>

                  <button
                    onClick={() => handleBarcodeScanned(activeItem.sku)}
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                    title="Simulate scanning exact ordered tag"
                  >
                    Quick Pass (Match)
                  </button>

                  <button
                    onClick={() => {
                      // Trigger override test
                      const overrideSku = activeItem.sku.includes('L')
                        ? activeItem.sku.replace('L', 'XL')
                        : 'POLO-NVY-XL';
                      handleBarcodeScanned(overrideSku);
                    }}
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition"
                    title="Simulate scanning a different size to test Real-Product Override"
                  >
                    Test Override (XL)
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
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
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
                        {order.items[0]?.productName} ({order.items[0]?.size})
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {order.items.length} item
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Camera & Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        products={products}
        currentOrderExpectedSku={activeItem?.sku}
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
