import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Loader2, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { PaymentModal } from './PaymentModal';

interface Props {
  open: boolean;
  onClose: () => void;
  quotationId: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CARD: 'Card', OTHER: 'Other',
};
const STATUS_BADGE: Record<string, string> = {
  PAID:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  UNPAID:  'bg-red-50 text-red-600 border-red-200',
};
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export function PaymentLedgerDrawer({ open, onClose, quotationId }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !addOpen) onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose, addOpen]);

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['payment-ledger', quotationId],
    queryFn: () => api.get(`/payments/quotation/${quotationId}`).then(r => r.data),
    enabled: open && !!quotationId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-ledger', quotationId] });
      qc.invalidateQueries({ queryKey: ['payments-overview'] });
      toast({ title: '🗑️ Payment removed' });
      setDeleteId(null);
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Delete failed',
      description: e.response?.data?.error?.message || 'Only owners and managers can delete payments.',
    }),
  });

  const q = ledger?.quotation;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-full sm:max-w-[600px]
        bg-white shadow-2xl flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-display font-bold text-slate-900 leading-tight">Payment Ledger</h2>
            {q && <p className="text-[14px] text-slate-500 font-medium mt-1">{q.quoteNumber} · {q.clientName}</p>}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-5">
          {isLoading && (
            <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          )}

          {ledger && (
            <>
              {/* Summary */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  <Cell label="Grand Total" value={fmtINR(q.grandTotal)} />
                  <Cell label="Received" value={fmtINR(ledger.totalPaid)} tone="text-emerald-700" />
                  <Cell label="Balance" value={fmtINR(ledger.balance)} tone={ledger.balance > 0 ? 'text-red-600' : 'text-emerald-700'} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
                  <span className={cn('px-2.5 py-1 rounded-lg text-[11px] font-bold border', STATUS_BADGE[ledger.paymentStatus])}>
                    {ledger.paymentStatus}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-500">
                    Advance ({q.advancePct}%): {fmtINR(ledger.advanceDue)} {ledger.advancePaid ? '· received ✓' : '· pending'}
                  </span>
                </div>
              </div>

              {/* Payments list */}
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Payments ({ledger.payments.length})</p>
                <button onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#1F5C45] bg-[#1F5C45]/10 hover:bg-[#1F5C45]/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus size={14} /> Add Payment
                </button>
              </div>

              {ledger.payments.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                  <Wallet size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-[14px] font-semibold text-slate-500">No payments recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ledger.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[16px] font-bold text-slate-900">{fmtINR(p.amount)}</p>
                        <p className="text-[12px] text-slate-500 font-medium">
                          {METHOD_LABEL[p.method] || p.method} · {formatDate(p.paidOn)}{p.reference ? ` · ${p.reference}` : ''}
                        </p>
                        {p.notes && <p className="text-[12px] text-slate-400 mt-0.5 truncate">{p.notes}</p>}
                      </div>
                      <button onClick={() => setDeleteId(p.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0" title="Delete payment">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add payment for this quotation */}
      <PaymentModal open={addOpen} onClose={() => setAddOpen(false)} quotationId={quotationId} />

      {/* Delete confirm (inline, lightweight) */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-[18px] font-bold text-slate-900 mb-2">Delete this payment?</h3>
            <p className="text-[14px] text-slate-500 mb-5">This will update the balance due. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[14px] font-bold text-slate-700">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleteId)}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className={cn('text-[18px] font-bold font-display leading-tight', tone || 'text-slate-900')}>{value}</p>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
