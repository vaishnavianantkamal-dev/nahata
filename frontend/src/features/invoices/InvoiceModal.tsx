import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, FileText, Receipt, MapPin, Calendar, Plus, Trash2, Percent, Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  prefillQuotationId?: string | null;
  editData?: any | null;
}

const UNITS = ['Sq.ft', 'Sq.m', 'Rft', 'Nos', 'Set', 'Lot', 'Kg', 'Box', 'Day'];
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
// 15-char GSTIN: state code + PAN + entity + 'Z' + checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface Item { description: string; notes: string; hsn: string; quantity: number; unit: string; rate: number; }
function emptyItem(): Item { return { description: '', notes: '', hsn: '', quantity: 1, unit: 'Nos', rate: 0 }; }

export function InvoiceModal({ open, onClose, prefillQuotationId, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const [quotationId, setQuotationId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [interState, setInterState] = useState(false);
  const [gstPct, setGstPct] = useState(18);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [advancePct, setAdvancePct] = useState(50);
  const [notes, setNotes] = useState('');
  const [termsText, setTermsText] = useState('');
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const reset = () => {
    setQuotationId(prefillQuotationId || ''); setClientName(''); setClientPhone('');
    setClientGstin(''); setClientAddress(''); setProjectDetails(''); setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(''); setPlaceOfSupply(''); setInterState(false); setGstPct(18); setDiscountAmt(0);
    setAdvancePct(50); setNotes(''); setTermsText(''); setItems([emptyItem()]);
  };

  const hydrate = (d: any) => {
    setQuotationId(d.quotationId || '');
    setClientName(d.clientName || ''); setClientPhone(d.clientPhone || ''); setClientGstin(d.clientGstin || '');
    setClientAddress(d.clientAddress || ''); setProjectDetails(d.projectDetails || '');
    setIssueDate((d.issueDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10));
    setDueDate((d.dueDate || '').slice(0, 10)); setPlaceOfSupply(d.placeOfSupply || '');
    setInterState(!!d.interState); setGstPct(d.gstPct ?? 18); setDiscountAmt(d.discountAmt || 0);
    setAdvancePct(d.advancePct ?? 50); setNotes(d.notes || ''); setTermsText(d.termsText || '');
    setItems(d.items?.length ? d.items.map((it: any) => ({
      description: it.description || '', notes: it.notes || '', hsn: it.hsn || '',
      quantity: it.quantity ?? it.areaQty ?? 1, unit: it.unit || 'Nos', rate: it.rate || 0,
    })) : [emptyItem()]);
  };

  useEffect(() => { if (open) { if (editData) hydrate(editData); else reset(); } /* eslint-disable-next-line */ }, [open, editData]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Quotations to generate from
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'for-invoice'],
    queryFn: () => api.get('/quotations?pageSize=100').then(r => r.data),
    enabled: open,
  });
  const quotations = quotationsData?.data || [];

  // When a quotation is selected, pull its details + line items
  const onPickQuotation = (id: string) => {
    setQuotationId(id);
    const q = quotations.find((x: any) => x.id === id);
    if (q) {
      setClientName(q.clientName || '');
      setClientPhone(q.clientPhone || '');
      setProjectDetails(q.projectDetails || '');
      setGstPct(q.gstPct || 18);
      setDiscountAmt(q.discountAmt || 0);
      setAdvancePct(q.advancePct || 50);
      setNotes(q.notes || '');
      setTermsText(q.termsText || '');
      if (q.items?.length) {
        setItems(q.items.map((it: any) => ({
          description: it.description || '', notes: it.notes || '', hsn: it.hsn || '',
          quantity: it.quantity ?? it.areaQty ?? 1, unit: it.unit || 'Nos', rate: it.rate || 0,
        })));
      }
    }
  };

  const updateItem = (i: number, field: keyof Item, val: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  // Live totals (mirror the server computation)
  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discountAmt) || 0));
  const tax = +(taxable * (Number(gstPct) || 0) / 100).toFixed(2);
  const cgst = interState ? 0 : +(tax / 2).toFixed(2);
  const sgst = interState ? 0 : +(tax - cgst).toFixed(2);
  const igst = interState ? tax : 0;
  const grandTotal = +(taxable + cgst + sgst + igst).toFixed(2);

  const mutation = useMutation({
    mutationFn: (payload: any) => isEdit ? api.patch(`/invoices/${editData.id}`, payload) : api.post('/invoices', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice', editData?.id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['payments-overview'] });
      toast({ title: isEdit ? '✅ Invoice updated' : '✅ Invoice created', description: isEdit ? 'Changes saved' : 'Tax invoice generated' });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: `Could not ${isEdit ? 'update' : 'create'} invoice`, description: e.response?.data?.error?.message || 'Check the details.' }),
  });

  const gstinValid = !clientGstin.trim() || GSTIN_REGEX.test(clientGstin.trim().toUpperCase());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { toast({ variant: 'destructive', title: 'Client name is required' }); return; }
    if (!gstinValid) { toast({ variant: 'destructive', title: 'Invalid GSTIN', description: 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).' }); return; }
    if (!items.some(it => it.description.trim() || it.rate)) { toast({ variant: 'destructive', title: 'Add at least one line item' }); return; }
    mutation.mutate({
      quotationId: quotationId || undefined,
      clientName, clientPhone: clientPhone || undefined, clientGstin: clientGstin.trim().toUpperCase() || undefined,
      clientAddress: clientAddress || undefined, projectDetails: projectDetails || undefined,
      issueDate, dueDate: dueDate || undefined, placeOfSupply: placeOfSupply || undefined,
      interState, gstPct, discountAmt, advancePct, notes: notes || undefined, termsText: termsText || undefined,
      items,
    });
  };

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-5xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[24px] font-display font-bold text-slate-900 leading-tight">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
            <p className="text-[14px] text-slate-500 font-medium mt-1">{isEdit ? editData.invoiceNumber : 'Generate a GST invoice from a quotation'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 flex overflow-hidden">
          {/* Left form */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-7 py-6 space-y-7">
            {/* Source — only when creating */}
            {!isEdit && (
              <section>
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-4">Document</p>
                <div>
                  <Label icon={FileText} text="From Quotation (optional)" />
                  <select value={quotationId} onChange={e => onPickQuotation(e.target.value)} className={inp}>
                    <option value="">— Manual invoice —</option>
                    {quotations.map((q: any) => (
                      <option key={q.id} value={q.id}>{q.quoteNumber} · {q.clientName} · ₹{Math.round(q.grandTotal).toLocaleString('en-IN')}</option>
                    ))}
                  </select>
                </div>
              </section>
            )}

            {/* Client */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-4">Bill To</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label icon={Building2} text="Client Name" required /><input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Priya & Aakash" className={inp} /></div>
                <div><Label icon={Building2} text="Phone" /><input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 …" className={inp} /></div>
                <div>
                  <Label icon={Receipt} text="Client GSTIN" />
                  <input value={clientGstin} onChange={e => setClientGstin(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15}
                    className={cn(inp, clientGstin.trim() && !gstinValid && 'border-red-400 focus:ring-red-400 bg-red-50')} />
                  {clientGstin.trim() && !gstinValid && (
                    <p className="text-[12px] font-semibold text-red-600 mt-1">Invalid GSTIN — must be 15 chars (e.g. 27ABCDE1234F1Z5)</p>
                  )}
                </div>
                <div><Label icon={MapPin} text="Place of Supply" /><input value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} placeholder="Maharashtra" className={inp} /></div>
                <div className="col-span-2"><Label icon={MapPin} text="Client Address" /><input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Address for the invoice" className={inp} /></div>
                <div className="col-span-2"><Label icon={FileText} text="Project / Event" /><input value={projectDetails} onChange={e => setProjectDetails(e.target.value)} placeholder="Wedding Decoration & Catering" className={inp} /></div>
              </div>
            </section>

            {/* Dates + GST mode */}
            <section>
              <div className="grid grid-cols-3 gap-4">
                <div><Label icon={Calendar} text="Invoice Date" /><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inp} /></div>
                <div><Label icon={Calendar} text="Due Date" /><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp} /></div>
                <div><Label icon={Percent} text="GST %" /><input type="number" value={gstPct} onChange={e => setGstPct(+e.target.value)} className={inp} /></div>
              </div>
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                <input type="checkbox" checked={interState} onChange={e => setInterState(e.target.checked)} className="w-4 h-4 accent-[#1F5C45]" />
                <span className="text-[14px] font-semibold text-slate-700">Inter-state supply (charge IGST instead of CGST + SGST)</span>
              </label>
            </section>

            {/* Items */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Line Items</p>
                <button type="button" onClick={() => setItems(p => [...p, emptyItem()])}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#1F5C45] bg-[#1F5C45]/10 hover:bg-[#1F5C45]/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5">Description</th>
                    <th className="text-left text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5 w-24">HSN/SAC</th>
                    <th className="text-center text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5 w-20">Qty</th>
                    <th className="text-center text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5 w-24">Unit</th>
                    <th className="text-right text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5 w-28">Rate</th>
                    <th className="text-right text-[11px] font-bold uppercase text-slate-600 px-3 py-2.5 w-28">Amount</th>
                    <th className="w-10" />
                  </tr></thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2.5"><input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Item / service" className={`${inp} h-9`} /></td>
                        <td className="px-3 py-2.5"><input value={it.hsn} onChange={e => updateItem(i, 'hsn', e.target.value)} placeholder="9963" className={`${inp} h-9`} /></td>
                        <td className="px-3 py-2.5"><input type="number" value={it.quantity || ''} onChange={e => updateItem(i, 'quantity', +e.target.value)} className={`${inp} h-9 text-center`} /></td>
                        <td className="px-3 py-2.5"><select value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className={`${inp} h-9`}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></td>
                        <td className="px-3 py-2.5"><input type="number" value={it.rate || ''} onChange={e => updateItem(i, 'rate', +e.target.value)} className={`${inp} h-9 text-right`} /></td>
                        <td className="px-3 py-2.5 text-right text-[14px] font-bold text-slate-900">{fmtINR((it.quantity || 0) * (it.rate || 0))}</td>
                        <td className="px-2">{items.length > 1 && <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div><Label icon={FileText} text="Notes" /><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inp} resize-none h-auto py-2.5`} /></div>
              <div><Label icon={FileText} text="Terms & Conditions" /><textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={3} className={`${inp} resize-none h-auto py-2.5`} /></div>
            </section>
          </div>

          {/* Right summary */}
          <div className="w-80 flex-shrink-0 bg-gradient-to-b from-slate-50 to-white border-l border-slate-200 overflow-y-auto scrollbar-thin px-6 py-6 flex flex-col gap-5">
            <p className="text-[16px] font-bold text-slate-900">Tax Summary</p>
            <div className="space-y-3 text-[14px]">
              <Row label="Subtotal" value={fmtINR(subtotal)} />
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Discount (₹)</span>
                <input type="number" value={discountAmt || ''} onChange={e => setDiscountAmt(+e.target.value)} placeholder="0"
                  className="w-24 h-8 rounded-lg border border-slate-300 bg-white px-2 text-right text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40" />
              </div>
              <Row label="Taxable Value" value={fmtINR(taxable)} bold />
              {interState ? (
                <Row label={`IGST (${gstPct}%)`} value={fmtINR(igst)} />
              ) : (
                <>
                  <Row label={`CGST (${gstPct / 2}%)`} value={fmtINR(cgst)} />
                  <Row label={`SGST (${gstPct / 2}%)`} value={fmtINR(sgst)} />
                </>
              )}
            </div>
            <div className="bg-gradient-to-br from-[#1F5C45] to-[#143d2e] rounded-xl px-5 py-4 text-white">
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1">Grand Total</p>
              <p className="text-[26px] font-bold text-[#C9A24B]">{fmtINR(grandTotal)}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-600">Advance %</span>
                <input type="number" value={advancePct} onChange={e => setAdvancePct(+e.target.value)} className="w-16 h-7 rounded-md border border-slate-300 px-2 text-right text-[13px] font-bold" />
              </div>
              <p className="text-[13px] text-slate-500 mt-1">Advance: <span className="font-bold text-slate-800">{fmtINR(grandTotal * advancePct / 100)}</span></p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-4 px-7 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[14px] font-bold text-slate-700 uppercase tracking-wide">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending || !gstinValid} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#1F5C45] to-[#0f1f18] hover:from-[#2d7a5e] text-white text-[14px] font-bold uppercase tracking-wide disabled:opacity-60">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </>
  );
}

const inp = 'w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:bg-white focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal appearance-none';

function Label({ icon: Icon, text, required }: { icon: React.ElementType; text: string; required?: boolean }) {
  return <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 mb-2"><Icon size={13} className="text-slate-400" />{text}{required && <span className="text-red-500">*</span>}</label>;
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-slate-600 font-medium">{label}</span><span className={bold ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}>{value}</span></div>;
}
