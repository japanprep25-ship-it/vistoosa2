import React, { useState } from 'react';
import {
  Truck,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  DollarSign,
  Plus,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { PathaoPayoutRecord } from '../types';

interface ReconciliationViewProps {
  payouts: PathaoPayoutRecord[];
  onAddPayout: (payout: PathaoPayoutRecord) => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  payouts,
  onAddPayout,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form for testing reconciliation
  const [formData, setFormData] = useState({
    invoiceId: `PTH-INV-${Math.floor(9910 + Math.random() * 80)}`,
    orderId: 'VIS-2041',
    trackingId: 'PTH-7819201',
    customerName: 'Tanvir Hossain',
    expectedCod: 1710,
    courierFee: 60,
    returnCharge: 0,
    actualPaidAmount: 1650,
    status: 'Delivered' as PathaoPayoutRecord['status'],
  });

  const discrepancies = payouts.filter((p) => p.reconciliationStatus === 'Discrepancy');
  const matched = payouts.filter((p) => p.reconciliationStatus === 'Matched');

  const totalDiscrepancyLoss = discrepancies.reduce(
    (acc, p) => acc + Math.abs(p.discrepancy),
    0
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const netExpected = formData.expectedCod - formData.courierFee - formData.returnCharge;
    const discrepancy = formData.actualPaidAmount - netExpected;
    const isMatched = Math.abs(discrepancy) === 0;

    const newRecord: PathaoPayoutRecord = {
      id: `rec-${Date.now()}`,
      invoiceId: formData.invoiceId,
      orderId: formData.orderId,
      trackingId: formData.trackingId,
      customerName: formData.customerName,
      expectedCod: formData.expectedCod,
      courierFee: formData.courierFee,
      returnCharge: formData.returnCharge,
      actualPaidAmount: formData.actualPaidAmount,
      discrepancy,
      reconciliationStatus: isMatched ? 'Matched' : 'Discrepancy',
      status: formData.status,
      payoutDate: new Date().toISOString().split('T')[0],
    };

    onAddPayout(newRecord);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Pathao Courier Reconciliation Engine
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 font-mono">
              1-Taka Precision Matcher
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cross-checks courier payout remittance statements against ordered COD, flagging discrepancies instantly
          </p>
        </div>

        <button
          id="btn-add-reconciliation-payout"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-md active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Match New Pathao Remittance</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-zinc-400">Total Remittances Audited</span>
            <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{payouts.length}</span>
            <span className="text-xs text-zinc-500">Invoices processed</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-emerald-300">Clean Reconciliations</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">
              {matched.length}
            </span>
            <span className="text-xs text-emerald-500">Exact 100% matches</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-red-500/40 bg-red-950/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-red-300 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Flagged Discrepancies</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300">
              Audit Alert
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-400 font-mono">
              ৳{totalDiscrepancyLoss.toLocaleString()}
            </span>
            <span className="text-xs text-red-300/80">({discrepancies.length} Invoices)</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Highlight Banner */}
      {discrepancies.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 space-y-1">
          <div className="flex items-center gap-2 font-bold text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>Active Financial Discrepancy Detected in Pathao Remittance</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Invoice <strong className="font-mono text-white">{discrepancies[0].invoiceId}</strong> (Order #{discrepancies[0].orderId}): Pathao remitted <span className="font-mono font-bold text-red-300">৳{discrepancies[0].actualPaidAmount}</span>, but calculated net expected COD after ৳{discrepancies[0].courierFee} delivery fee was <span className="font-mono font-bold text-white">৳{discrepancies[0].expectedCod - discrepancies[0].courierFee}</span>. Missing <strong>৳{Math.abs(discrepancies[0].discrepancy)} BDT</strong> discrepancy flagged for dispute.
          </p>
        </div>
      )}

      {/* Reconciled Records Table */}
      <div className="glass-card rounded-3xl p-5 border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-semibold">Invoice & Date</th>
                <th className="pb-3 font-semibold">Order ID</th>
                <th className="pb-3 font-semibold">Courier Tracking</th>
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold text-right">Expected COD</th>
                <th className="pb-3 font-semibold text-right">Courier Fee</th>
                <th className="pb-3 font-semibold text-right">Actual Remitted</th>
                <th className="pb-3 font-semibold text-right">Discrepancy</th>
                <th className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {payouts.map((rec) => {
                const isDiscrepant = rec.reconciliationStatus === 'Discrepancy';
                return (
                  <tr
                    key={rec.id}
                    className={`hover:bg-zinc-900/50 transition ${
                      isDiscrepant ? 'bg-red-950/10' : ''
                    }`}
                  >
                    <td className="py-3">
                      <p className="font-mono font-bold text-zinc-200">{rec.invoiceId}</p>
                      <p className="text-[10px] text-zinc-500">{rec.payoutDate}</p>
                    </td>
                    <td className="py-3 font-mono font-bold text-amber-400">{rec.orderId}</td>
                    <td className="py-3 font-mono text-zinc-400">{rec.trackingId}</td>
                    <td className="py-3 font-medium text-zinc-200">{rec.customerName}</td>
                    <td className="py-3 text-right font-mono text-zinc-300">
                      ৳{rec.expectedCod}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-400">
                      ৳{rec.courierFee + rec.returnCharge}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-100">
                      ৳{rec.actualPaidAmount}
                    </td>
                    <td className="py-3 text-right font-mono font-bold">
                      {rec.discrepancy === 0 ? (
                        <span className="text-emerald-400">৳0 (Match)</span>
                      ) : (
                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          {rec.discrepancy > 0 ? `+৳${rec.discrepancy}` : `-৳${Math.abs(rec.discrepancy)}`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {isDiscrepant ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          Discrepancy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Matched
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding Pathao Statement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Audit Pathao Remittance Statement
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter Pathao payout numbers to test 1-Taka discrepancy precision detection
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Invoice ID</label>
                  <input
                    type="text"
                    required
                    value={formData.invoiceId}
                    onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Order ID</label>
                  <input
                    type="text"
                    required
                    value={formData.orderId}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Expected COD (৳)</label>
                  <input
                    type="number"
                    required
                    value={formData.expectedCod}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedCod: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Courier Delivery Fee (৳)</label>
                  <input
                    type="number"
                    required
                    value={formData.courierFee}
                    onChange={(e) =>
                      setFormData({ ...formData, courierFee: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">
                  Actual Pathao Remitted Cash (৳)
                </label>
                <input
                  type="number"
                  required
                  value={formData.actualPaidAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, actualPaidAmount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="e.g. 1650 or 1590 to test discrepancy"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-amber-300 font-mono font-bold"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Net Expected = COD (৳{formData.expectedCod}) - Fee (৳{formData.courierFee}) = ৳
                  {formData.expectedCod - formData.courierFee}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  Verify & Log Remittance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
