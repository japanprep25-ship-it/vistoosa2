import React, { useState } from 'react';
import {
  Layers,
  Search,
  AlertTriangle,
  Plus,
  ArrowUpDown,
  Tag,
  CheckCircle2,
  Box,
  RefreshCw,
} from 'lucide-react';
import { Product, ProductVariant } from '../types';

interface InventoryViewProps {
  products: Product[];
  onUpdateStock: (
    productId: string,
    size: 'S' | 'M' | 'L' | 'XL' | 'XXL',
    delta: number
  ) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onUpdateStock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [restockModal, setRestockModal] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(20);

  const categories = ['All', 'Polo', 'Panjabi', 'Shirt', 'Chino'];

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.color.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants.some(
        (v) =>
          v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.barcode.includes(searchQuery)
      );
    return matchCat && matchSearch;
  });

  // Calculate totals
  const totalPhysicalUnits = products.reduce(
    (acc, p) => acc + p.variants.reduce((vAcc, v) => vAcc + v.warehouseStock, 0),
    0
  );
  const totalReservedUnits = products.reduce(
    (acc, p) => acc + p.variants.reduce((vAcc, v) => vAcc + v.reservedStock, 0),
    0
  );
  const totalAvailableUnits = totalPhysicalUnits - totalReservedUnits;

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockModal && restockAmount > 0) {
      onUpdateStock(restockModal.product.id, restockModal.variant.size, restockAmount);
      setRestockModal(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Dual-State Inventory Management
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
              Live Stock Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Differentiates physically present Warehouse Stock vs reserved bookings awaiting courier dispatch
          </p>
        </div>
      </div>

      {/* Dual-State Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">Final Warehouse Stock</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {totalPhysicalUnits.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">Units on shelves</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Deducted only upon physical barcode scan
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">Reserved Stock (Booked)</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-300 font-mono">
              {totalReservedUnits.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">Units committed</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            In Pending & Approved orders awaiting packing
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-300 font-medium">Available to Sell</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">
              {totalAvailableUnits.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-500">Units open for order</span>
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-1">
            Warehouse Stock minus Reserved Bookings
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU, barcode (EAN-13), fabric..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Variant Matrices */}
      <div className="space-y-4">
        {filteredProducts.map((product) => {
          const totalStockForProd = product.variants.reduce(
            (a, v) => a + v.warehouseStock,
            0
          );
          const totalReservedForProd = product.variants.reduce(
            (a, v) => a + v.reservedStock,
            0
          );

          return (
            <div
              key={product.id}
              className="glass-card rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition"
            >
              {/* Product Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-3.5">
                  <img
                    src={product.thumbnail}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/80 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700 uppercase">
                        {product.category}
                      </span>
                      <span className="text-xs text-zinc-400">• {product.fabric}</span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">{product.name}</h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Colorway: <span className="text-zinc-200 font-semibold">{product.color}</span>{' '}
                      • Retail: <span className="text-amber-300 font-bold">৳{product.retailPrice}</span>{' '}
                      • Est COGS: <span className="text-zinc-400">৳{product.cogsEstimate}</span>
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-[11px] text-zinc-400 block">Total In Stock</span>
                  <div className="flex items-baseline gap-2 sm:justify-end">
                    <span className="text-lg font-bold font-mono text-zinc-100">
                      {totalStockForProd}
                    </span>
                    <span className="text-xs text-blue-400">({totalReservedForProd} reserved)</span>
                  </div>
                </div>
              </div>

              {/* Variant Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px]">
                      <th className="pb-2 font-semibold">Size</th>
                      <th className="pb-2 font-semibold">SKU</th>
                      <th className="pb-2 font-semibold">EAN-13 Barcode</th>
                      <th className="pb-2 font-semibold text-right">Physical Warehouse Stock</th>
                      <th className="pb-2 font-semibold text-right">Reserved (Booked)</th>
                      <th className="pb-2 font-semibold text-right">Available to Sell</th>
                      <th className="pb-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {product.variants.map((v) => {
                      const available = v.warehouseStock - v.reservedStock;
                      const isLowStock = v.warehouseStock <= 5;

                      return (
                        <tr key={v.sku} className="hover:bg-zinc-900/40 transition">
                          <td className="py-2.5 font-bold text-zinc-200 font-mono">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                              {v.size}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-zinc-300">{v.sku}</td>
                          <td className="py-2.5 font-mono text-zinc-500">{v.barcode}</td>

                          {/* Physical Warehouse Stock */}
                          <td className="py-2.5 text-right font-mono font-bold">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                                isLowStock
                                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                  : 'text-zinc-200'
                              }`}
                            >
                              {isLowStock && <AlertTriangle className="w-3 h-3 text-red-400" />}
                              {v.warehouseStock}
                              {isLowStock && (
                                <span className="text-[9px] font-sans font-bold text-red-400">
                                  LOW
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Reserved Stock */}
                          <td className="py-2.5 text-right font-mono text-blue-400 font-semibold">
                            {v.reservedStock}
                          </td>

                          {/* Available to Sell */}
                          <td className="py-2.5 text-right font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-lg ${
                                available <= 2
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {available}
                            </span>
                          </td>

                          {/* Quick Restock / Adjust */}
                          <td className="py-2.5 text-right">
                            <button
                              id={`restock-${v.sku}`}
                              onClick={() => setRestockModal({ product, variant: v })}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition"
                            >
                              + Restock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Restock Physical Warehouse Inventory
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              {restockModal.product.name} ({restockModal.variant.size}) • SKU:{' '}
              {restockModal.variant.sku}
            </p>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">
                  Current Physical Stock: <strong className="text-white font-mono">{restockModal.variant.warehouseStock} units</strong>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(parseInt(e.target.value) || 0)}
                    className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono text-sm"
                  />
                  <span className="text-zinc-400 text-xs">units to add</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setRestockModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                >
                  Confirm Restock (+{restockAmount})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
