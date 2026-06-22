import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Wallet, Calendar, FileText, Hash, CreditCard, Receipt, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  // Pre-selected quotation (from the overview row). When absent, user picks one.
  quotationId?: string | null;
  editData?: any | null;
}

const METHODS = [
  { value: 'CASH',          label: '💵 Cash' },
  { value: 'UPI',           label: '📱 UPI' },
  { value: 'BANK_TRANSFER', label: '🏦 Bank Transfer' },
  { value: 'CHEQUE',        label: '🧾 Cheque' },
  { value: 'CARD',          label: '💳 Card' },
  { value: 'OTHER',         label: '• Other' },
];

const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export function PaymentModal({ open, onClose, quotationId, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const [form, setForm] = useState<any>({
    quotationId: '', amount: '', method: 'CASH', reference: '', paidOn: '', notes: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        quotationId: editData.quotationId || '', amount: editData.amount ?? '',
        method: editData.method || 'CASH', reference: editData.reference || '',
        paidOn: (editData.paidOn || '').slice(0, 10), notes: editData.notes || '',
      });
    } else {
      setForm({
        quotationId: quotationId || '', amount: '', method: 'CASH', reference: '',
        paidOn: new Date().toISOString().slice(0, 10), notes: '',
      });
    }
  }, [open, editData, quotationId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Quotations to choose from (only needed when not pre-selected)
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'for-payment'],
    queryFn: () => api.get('/quotations?pageSize=100').then(r => r.data),
    enabled: open && !quotationId && !isEdit,
  });
  const quotations = quotationsData?.data || [];

  // Live ledger for the selected quotation (shows balance before/after)
  const { data: ledger, isFetching: ledgerLoading } = useQuery({
    queryKey: ['payment-ledger', form.quotationId],
    queryFn: () => api.get(`/payments/quotation/${form.quotationId}`).then(r => r.data),
    enabled: open && !!form.quotationId,
  });

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      isEdit ? api.patch(`/payments/${editData.id}`, payload) : api.post('/payments', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments-overview'] });
      qc.invalidateQueries({ queryKey: ['payment-ledger'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: isEdit ? '✅ Payment updated' : '✅ Payment recorded' });
      onClose();
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Could not save payment',
      description: e.response?.data?.error?.message || 'Please check the details.',
    }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.quotationId) { toast({ variant: 'destructive', title: 'Select a quotation' }); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast({ variant: 'destructive', title: 'Enter a valid amount' }); return; }
    mutation.mutate({
      quotationId: form.quotationId,
      amount,
      method: form.method,
      reference: form.reference.trim() || undefined,
      paidOn: form.paidOn || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  // Projected balance after this payment (create mode only)
  const enteredAmount = Number(form.amount) || 0;
  const projectedBalance = ledger ? ledger.balance - (isEdit ? 0 : enteredAmount) : null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-full sm:max-w-[560px]
        bg-white shadow-2xl flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 flex-shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[24px] font-display font-bold text-slate-900 leading-tight">
              {isEdit ? 'Edit Payment' : 'Record Payment'}
            </h2>
            <p className="text-[13px] sm:text-[15px] text-slate-500 font-medium mt-1">
              Track money received against a quotation
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 sm:px-7 py-5 space-y-5">

            {/* Quotation picker (only when not pre-selected) */}
            {!quotationId && !isEdit && (
              <div>
                <Label icon={Receipt} text="Quotation" required />
                <select value={form.quotationId} onChange={e => set('quotationId', e.target.value)} className={inputCls}>
                  <option value="">— Select a quotation —</option>
                  {quotations.map((q: any) => (
                    <option key={q.id} value={q.id}>
                      {q.quoteNumber} · {q.clientName} · ₹{Math.round(q.grandTotal).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ledger summary */}
            {form.quotationId && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {ledgerLoading ? (
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
                    <Loader2 size={15} className="animate-spin" /> Loading ledger…
                  </div>
                ) : ledger ? (
                  <div className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Quotation</span><span className="font-bold text-slate-800">{ledger.quotation.quoteNumber}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Grand Total</span><span className="font-bold text-slate-800">{fmtINR(ledger.quotation.grandTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Received so far</span><span className="font-bold text-emerald-700">{fmtINR(ledger.totalPaid)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5">
                      <span className="text-slate-500 font-medium">Balance {isEdit ? 'now' : 'after this'}</span>
                      <span className={`font-bold ${(projectedBalance ?? ledger.balance) <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtINR(isEdit ? ledger.balance : (projectedBalance ?? ledger.balance))}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label icon={Wallet} text="Amount (₹)" required />
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                  placeholder="e.g. 50000" className={inputCls} />
              </div>
              <div>
                <Label icon={Calendar} text="Paid On" />
                <input type="date" value={form.paidOn} onChange={e => set('paidOn', e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label icon={CreditCard} text="Method" />
                <select value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <Label icon={Hash} text="Reference / Txn No." />
                <input value={form.reference} onChange={e => set('reference', e.target.value)}
                  placeholder="UPI ref, cheque no…" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <Label icon={FileText} text="Notes" />
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                  placeholder="Any notes about this payment…" className={`${inputCls} resize-none h-auto py-3`} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 sm:gap-3 px-5 sm:px-7 py-4 sm:py-5 border-t border-slate-100 flex-shrink-0 bg-white">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[14px] font-bold text-slate-700 tracking-wide uppercase transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 h-11 rounded-xl bg-[#0f1f18] hover:bg-[#1F5C45] text-white text-[14px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const inputCls = `
  w-full h-11 rounded-xl border border-slate-200 bg-slate-50
  px-4 text-[14px] sm:text-[16px] font-medium text-slate-900
  focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:bg-white focus:border-transparent
  transition-all placeholder:text-slate-400 placeholder:font-normal appearance-none
`.replace(/\s+/g, ' ').trim();

function Label({ icon: Icon, text, required }: { icon: React.ElementType; text: string; required?: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 mb-2">
      <Icon size={14} className="text-slate-400" />
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
