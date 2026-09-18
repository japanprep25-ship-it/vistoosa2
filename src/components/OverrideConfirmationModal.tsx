import React from 'react';
import { AlertTriangle, Check, X, ArrowRight, Layers } from 'lucide-react';
import { Order, OrderItem, Product } from '../types';

interface OverrideConfirmationModalProps {
  order: Order;
  orderItem: OrderItem;
  scannedSku: string;
  scannedProduct?: Product;
  scannedSize: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  onConfirmOverride: () => void;
  onCancel: () => void;
}

export const OverrideConfirmationModal: React.FC<OverrideConfirmationModalProps> = ({
  order,
  orderItem,
  scannedSku,
  scannedProduct,
  scannedSize,
  onConfirmOverride,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-amber-500/40 p-6 shadow-2xl relative overflow-hidden">
        {/* Top Warning Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider mb-1">
              Critical Packing Logic
            </div>
            <h3 className="text-lg font-bold text-white">
              Real-Product Override Detected
            </h3>
            <p className="text-xs text-zinc-400">
              Order #{order.id} • Customer: {order.customerName}
            </p>
          </div>
        </div>

        {/* Comparison Box */}
        <div className="rounded-2xl bg-zinc-950/80 border border-zinc-800 p-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 items-center">
            {/* Ordered Spec */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                Customer Ordered
              </span>
              <p className="text-xs font-semibold text-zinc-200">{orderItem.productName}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  Size {orderItem.size}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">{orderItem.sku}</span>
              </div>
            </div>

            {/* Scanned Spec */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                Physical Barcode Scanned
              </span>
              <p className="text-xs font-semibold text-amber-200">
                {scannedProduct ? scannedProduct.name : orderItem.productName}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-zinc-950">
                  Size {scannedSize}
                </span>
                <span className="text-[10px] font-mono text-amber-300">{scannedSku}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            <Layers className="w-4 h-4 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-tight">
              <strong>Inventory Rule:</strong> System will override the final dispatched record to <span className="underline font-bold">Size {scannedSize} ({scannedSku})</span> and deduct inventory from <strong>Size {scannedSize}</strong> warehouse stock.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
          >
            Cancel / Re-scan Correct Size
          </button>

          <button
            type="button"
            id="confirm-override-btn"
            onClick={onConfirmOverride}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Override & Dispatch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
