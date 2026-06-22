import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Download, Send, Ban, Plus, Loader2, Trash2, Pencil,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { InvoiceModal } from './InvoiceModal';

interface Props { open: boolean; onClose: () => void; invoiceId: string | null; }

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  UNPAID: 'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
};
const METHODS = [
  { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }, { value: 'OTHER', label: 'Other' },
];
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export function InvoiceDetailDrawer({ open, onClose, invoiceId }: Props) {
  const qc = useQueryClient();
  const [showPay, setShowPay] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (!open) { setShowPay(false); setEditPaymentId(null); setAmount(''); setReference(''); setConfirmDelete(false); setEditOpen(false); } }, [open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}`).then(r => r.data),
    enabled: open && !!invoiceId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['payments-overview'] });
  };

  const resetPayForm = () => { setEditPaymentId(null); setAmount(''); setReference(''); setMethod('UPI'); setPaidOn(new Date().toISOString().slice(0, 10)); };

  const payMutation = useMutation({
    mutationFn: () => {
      const body = { amount: Number(amount), method, reference: reference || undefined, paidOn };
      return editPaymentId ? api.patch(`/payments/${editPaymentId}`, body) : api.post('/payments', { invoiceId, ...body });
    },
    onSuccess: () => { invalidate(); toast({ title: editPaymentId ? '✅ Payment updated' : '✅ Payment recorded' }); setShowPay(false); resetPayForm(); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Payment failed', description: e.response?.data?.error?.message }),
  });

  const startEditPayment = (p: any) => {
    setEditPaymentId(p.id); setAmount(String(p.amount)); setMethod(p.method);
    setReference(p.reference || ''); setPaidOn((p.paidOn || '').slice(0, 10)); setShowPay(true);
  };

  const deletePayment = useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => { invalidate(); toast({ title: '🗑️ Payment removed' }); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Delete failed', description: e.response?.data?.error?.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/cancel`),
    onSuccess: () => { invalidate(); toast({ title: 'Invoice cancelled' }); },
  });

  const deleteInvoice = useMutation({
    mutationFn: () => api.delete(`/invoices/${invoiceId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['payments-overview'] }); toast({ title: '🗑️ Invoice deleted' }); setConfirmDelete(false); onClose(); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Delete failed', description: e.response?.data?.error?.message || 'Only owners and managers can delete invoices.' }),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/send-whatsapp`),
    onSuccess: (res) => toast({ title: '✅ Sent on WhatsApp', description: res.data.message }),
    onError: (e: any) => toast({ variant: 'destructive', title: 'Send failed', description: e.response?.data?.error?.message }),
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/invoices/${invoiceId}/pdf`, { color: '#1F5C45' }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${(inv?.invoiceNumber || 'invoice').replace(/[\/\\]/g, '-')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: '✅ PDF downloaded' }),
    onError: () => toast({ variant: 'destructive', title: 'PDF generation failed' }),
  });

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-[680px] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {isLoading || !inv ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="animate-spin" size={18} /> Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-slate-200 flex-shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[22px] font-display font-bold text-slate-900 leading-tight">{inv.invoiceNumber}</h2>
                  <span className={cn('px-2 py-0.5 rounded-lg text-[11px] font-bold border', STATUS_BADGE[inv.status])}>{inv.status}</span>
                </div>
                <p className="text-[14px] text-slate-500 font-medium mt-1">{inv.clientName}{inv.clientPhone ? ` · ${inv.clientPhone}` : ''}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-7 py-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <Meta label="Invoice Date" value={formatDate(inv.issueDate)} />
                <Meta label="Due Date" value={inv.dueDate ? formatDate(inv.dueDate) : '—'} />
                {inv.clientGstin && <Meta label="Client GSTIN" value={inv.clientGstin} />}
                {inv.placeOfSupply && <Meta label="Place of Supply" value={inv.placeOfSupply} />}
                {inv.projectDetails && <Meta label="Project" value={inv.projectDetails} />}
                <Meta label="Supply" value={inv.interState ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'} />
              </div>

              {/* Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-slate-50">
                    <th className="text-left text-[11px] font-bold uppercase text-slate-500 px-4 py-2.5">Item</th>
                    <th className="text-left text-[11px] font-bold uppercase text-slate-500 px-2 py-2.5">HSN</th>
                    <th className="text-right text-[11px] font-bold uppercase text-slate-500 px-2 py-2.5">Qty</th>
                    <th className="text-right text-[11px] font-bold uppercase text-slate-500 px-2 py-2.5">Rate</th>
                    <th className="text-right text-[11px] font-bold uppercase text-slate-500 px-4 py-2.5">Amount</th>
                  </tr></thead>
                  <tbody>
                    {inv.items.map((it: any) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-800">{it.description}{it.notes && <span className="block text-[11px] text-slate-400 font-normal">{it.notes}</span>}</td>
                        <td className="px-2 py-2.5 text-[12px] text-slate-500">{it.hsn || '—'}</td>
                        <td className="px-2 py-2.5 text-[12px] text-right text-slate-600">{it.areaQty} {it.unit}</td>
                        <td className="px-2 py-2.5 text-[12px] text-right text-slate-600">{fmtINR(it.rate)}</td>
                        <td className="px-4 py-2.5 text-[13px] text-right font-bold text-slate-900">{fmtINR(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax summary */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-[13px]">
                <Row label="Subtotal" value={fmtINR(inv.subtotal)} />
                {inv.discountAmt > 0 && <Row label="Discount" value={`- ${fmtINR(inv.discountAmt)}`} valueClass="text-red-600" />}
                <Row label="Taxable Value" value={fmtINR(inv.taxableValue)} bold />
                {inv.interState
                  ? <Row label={`IGST (${inv.gstPct}%)`} value={fmtINR(inv.igstAmt)} />
                  : <><Row label={`CGST (${inv.gstPct / 2}%)`} value={fmtINR(inv.cgstAmt)} /><Row label={`SGST (${inv.gstPct / 2}%)`} value={fmtINR(inv.sgstAmt)} /></>}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-[16px]">
                  <span className="font-bold text-slate-900">Grand Total</span>
                  <span className="font-bold text-[#1F5C45]">{fmtINR(inv.grandTotal)}</span>
                </div>
                {inv.amountInWords && <p className="text-[12px] italic text-slate-500 pt-1">{inv.amountInWords}</p>}
              </div>

              {/* Payment ledger */}
              <div>
                <div className="grid grid-cols-3 rounded-xl border border-slate-200 overflow-hidden mb-3">
                  <LedgerCell label="Received" value={fmtINR(inv.totalPaid)} tone="text-emerald-700" />
                  <LedgerCell label="Balance" value={fmtINR(inv.balance)} tone={inv.balance > 0 ? 'text-red-600' : 'text-emerald-700'} border />
                  <LedgerCell label="Advance Due" value={fmtINR(inv.advanceDue)} tone="text-slate-700" border />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Payments ({inv.payments.length})</p>
                  {inv.status !== 'CANCELLED' && (
                    <button onClick={() => { if (showPay) { setShowPay(false); } else { resetPayForm(); setShowPay(true); } }}
                      className="flex items-center gap-1.5 text-[13px] font-bold text-[#1F5C45] bg-[#1F5C45]/10 hover:bg-[#1F5C45]/20 px-3 py-1.5 rounded-lg">
                      <Plus size={14} /> Record Payment
                    </button>
                  )}
                </div>

                {showPay && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-3 grid grid-cols-2 gap-3">
                    {editPaymentId && <p className="col-span-2 text-[12px] font-bold text-amber-700">Editing payment</p>}
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount ₹" className={inp} />
                    <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>{METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                    <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference / Txn no." className={inp} />
                    <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className={inp} />
                    <button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !Number(amount)}
                      className="col-span-2 h-10 rounded-xl bg-[#1F5C45] hover:bg-[#143d2e] text-white text-[14px] font-bold disabled:opacity-60">
                      {payMutation.isPending ? 'Saving…' : editPaymentId ? 'Update Payment' : 'Save Payment'}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {inv.payments.length === 0 && <p className="text-[13px] text-slate-400 text-center py-3">No payments yet</p>}
                  {inv.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5">
                      <div>
                        <p className="text-[15px] font-bold text-slate-900">{fmtINR(p.amount)}</p>
                        <p className="text-[12px] text-slate-500">{p.method} · {formatDate(p.paidOn)}{p.reference ? ` · ${p.reference}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => startEditPayment(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit payment"><Pencil size={14} /></button>
                        <button onClick={() => deletePayment.mutate(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete payment"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap gap-2 px-7 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}
                className="flex-1 min-w-[110px] h-11 rounded-xl bg-[#1F5C45] hover:bg-[#143d2e] text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                <Download size={16} /> {downloadMutation.isPending ? 'Generating…' : 'PDF'}
              </button>
              {inv.clientPhone && (
                <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
                  className="flex-1 min-w-[110px] h-11 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  <Send size={16} /> Send
                </button>
              )}
              {inv.status !== 'CANCELLED' && (
                <button onClick={() => setEditOpen(true)}
                  className="h-11 px-4 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 text-[14px] font-bold flex items-center justify-center gap-2">
                  <Pencil size={15} /> Edit
                </button>
              )}
              {inv.status !== 'CANCELLED' && (
                <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}
                  className="h-11 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-200 text-[14px] font-bold flex items-center justify-center gap-2">
                  <Ban size={15} /> Cancel
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)}
                className="h-11 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 text-[14px] font-bold flex items-center justify-center gap-2">
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Edit invoice */}
      <InvoiceModal open={editOpen} onClose={() => setEditOpen(false)} editData={inv} />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-[18px] font-bold text-slate-900 mb-2">Delete invoice {inv?.invoiceNumber}?</h3>
            <p className="text-[14px] text-slate-500 mb-5">This permanently removes the invoice and detaches its payments. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[14px] font-bold text-slate-700">Cancel</button>
              <button onClick={() => deleteInvoice.mutate()} disabled={deleteInvoice.isPending} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold disabled:opacity-60">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inp = 'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40 appearance-none';

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="text-[13px] font-semibold text-slate-700">{value}</p></div>;
}
function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return <div className="flex justify-between"><span className="text-slate-600 font-medium">{label}</span><span className={cn(bold ? 'font-bold text-slate-900' : 'font-semibold text-slate-800', valueClass)}>{value}</span></div>;
}
function LedgerCell({ label, value, tone, border }: { label: string; value: string; tone: string; border?: boolean }) {
  return <div className={cn('px-4 py-3 text-center', border && 'border-l border-slate-100')}><p className={cn('text-[16px] font-bold font-display', tone)}>{value}</p><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p></div>;
}
