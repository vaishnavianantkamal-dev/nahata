import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Wallet, Calendar, Hash, CreditCard, Receipt, FileText } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId?: string | null; // pre-selected from a row
}

const METHODS = [
  { value: 'CASH', label: '💵 Cash' }, { value: 'UPI', label: '📱 UPI' },
  { value: 'BANK_TRANSFER', label: '🏦 Bank Transfer' }, { value: 'CHEQUE', label: '🧾 Cheque' },
  { value: 'CARD', label: '💳 Card' }, { value: 'OTHER', label: '• Other' },
];
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export function InvoicePaymentModal({ open, onClose, invoiceId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ invoiceId: '', amount: '', method: 'UPI', reference: '', paidOn: '', notes: '' });

  useEffect(() => {
    if (!open) return;
    setForm({ invoiceId: invoiceId || '', amount: '', method: 'UPI', reference: '', paidOn: new Date().toISOString().slice(0, 10), notes: '' });
  }, [open, invoiceId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // All invoices — for the picker AND to read the selected invoice's live balance
  const { data: invData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data),
    enabled: open,
  });
  const invoices: any[] = (invData?.data || []).filter((i: any) => i.status !== 'CANCELLED');
  const selected = invoices.find((i: any) => i.id === form.invoiceId);

  const mutation = useMutation({
    mutationFn: () => api.post('/payments', {
      invoiceId: form.invoiceId, amount: Number(form.amount), method: form.method,
      reference: form.reference.trim() || undefined, paidOn: form.paidOn || undefined, notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice', form.invoiceId] });
      qc.invalidateQueries({ queryKey: ['payments-overview'] });
      toast({ title: '✅ Payment recorded' });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Could not save payment', description: e.response?.data?.error?.message || 'Please check the details.' }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceId) { toast({ variant: 'destructive', title: 'Select an invoice' }); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { toast({ variant: 'destructive', title: 'Enter a valid amount' }); return; }
    mutation.mutate();
  };

  const projectedBalance = selected ? selected.balance - (Number(form.amount) || 0) : null;

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:max-w-[560px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-slate-100 flex-shrink-0 gap-3">
          <div>
            <h2 className="text-[24px] font-display font-bold text-slate-900 leading-tight">Record Payment</h2>
            <p className="text-[14px] text-slate-500 font-medium mt-1">Against an invoice</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto scrollbar-thin px-7 py-5 space-y-5">
          {!invoiceId && (
            <div>
              <Label icon={Receipt} text="Invoice" required />
              <select value={form.invoiceId} onChange={e => set('invoiceId', e.target.value)} className={inp}>
                <option value="">— Select an invoice —</option>
                {invoices.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber} · {i.clientName} · bal {fmtINR(i.balance)}</option>
                ))}
              </select>
            </div>
          )}

          {selected && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Invoice</span><span className="font-bold text-slate-800">{selected.invoiceNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Grand Total</span><span className="font-bold text-slate-800">{fmtINR(selected.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Received</span><span className="font-bold text-emerald-700">{fmtINR(selected.totalPaid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500 font-medium">Balance after this</span>
                <span className={`font-bold ${(projectedBalance ?? selected.balance) <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtINR(projectedBalance ?? selected.balance)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div><Label icon={Wallet} text="Amount (₹)" required /><input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="e.g. 50000" className={inp} /></div>
            <div><Label icon={Calendar} text="Paid On" /><input type="date" value={form.paidOn} onChange={e => set('paidOn', e.target.value)} className={inp} /></div>
            <div><Label icon={CreditCard} text="Method" /><select value={form.method} onChange={e => set('method', e.target.value)} className={inp}>{METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div><Label icon={Hash} text="Reference" /><input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="UPI ref, cheque no…" className={inp} /></div>
            <div className="col-span-2"><Label icon={FileText} text="Notes" /><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${inp} resize-none h-auto py-3`} /></div>
          </div>
        </form>

        <div className="flex gap-3 px-7 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[14px] font-bold text-slate-700 uppercase tracking-wide">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} className="flex-1 h-11 rounded-xl bg-[#0f1f18] hover:bg-[#1F5C45] text-white text-[14px] font-bold uppercase tracking-wide disabled:opacity-60">
            {mutation.isPending ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </>
  );
}

const inp = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:bg-white focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal appearance-none';
function Label({ icon: Icon, text, required }: { icon: React.ElementType; text: string; required?: boolean }) {
  return <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 mb-2"><Icon size={14} className="text-slate-400" />{text}{required && <span className="text-red-500">*</span>}</label>;
}
