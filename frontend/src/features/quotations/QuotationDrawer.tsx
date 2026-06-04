import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: any;   // if set → edit mode
  prefillLead?: any; // if opening from a lead
}

const UNITS = ['Sq.ft', 'Sq.m', 'Rft', 'Nos', 'Set', 'Lot', 'Kg', 'Box', 'Day'];

interface Item {
  description: string;
  notes: string;
  length: number;
  width: number;
  areaQty: number;
  unit: string;
  rate: number;
  amount: number;
}

interface AddlItem {
  item: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

function emptyItem(): Item { return { description: '', notes: '', length: 0, width: 0, areaQty: 0, unit: 'Sq.ft', rate: 0, amount: 0 }; }
function emptyAddl(): AddlItem { return { item: '', qty: 1, unit: 'Nos', rate: 0, amount: 0 }; }

export function QuotationDrawer({ open, onClose, editData, prefillLead }: Props) {
  const qc = useQueryClient();

  // Form state
  const [clientName,     setClientName]     = useState('');
  const [clientPhone,    setClientPhone]    = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [quoteDate,      setQuoteDate]      = useState(new Date().toISOString().slice(0, 10));
  const [validityDays,   setValidityDays]   = useState(15);
  const [advancePct,     setAdvancePct]     = useState(50);
  const [leadId,         setLeadId]         = useState('');
  const [notes,          setNotes]          = useState('');
  const [termsText,      setTermsText]      = useState('');
  const [discountPct,    setDiscountPct]    = useState(0);
  const [discountAmt,    setDiscountAmt]    = useState(0);
  const [gstPct,         setGstPct]         = useState(0);
  const [estCost,        setEstCost]        = useState(0);
  const [items,          setItems]          = useState<Item[]>([emptyItem()]);
  const [addlWork,       setAddlWork]       = useState<AddlItem[]>([]);
  const [addlOpen,       setAddlOpen]       = useState(false);
  const [termsOpen,      setTermsOpen]      = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editData && open) {
      setClientName(editData.clientName || '');
      setClientPhone(editData.clientPhone || '');
      setProjectDetails(editData.projectDetails || '');
      setQuoteDate(editData.quoteDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setValidityDays(editData.validityDays || 15);
      setAdvancePct(editData.advancePct || 50);
      setLeadId(editData.leadId || '');
      setNotes(editData.notes || '');
      setTermsText(editData.termsText || '');
      setDiscountPct(editData.discountPct || 0);
      setDiscountAmt(editData.discountAmt || 0);
      setGstPct(editData.gstPct || 0);
      setEstCost(editData.estCost || 0);
      setItems(editData.items?.length ? editData.items : [emptyItem()]);
      setAddlWork(editData.addlWork || []);
    } else if (!editData && open) {
      // Reset
      setClientName(prefillLead?.name || '');
      setClientPhone(prefillLead?.primaryPhone || '');
      setProjectDetails('');
      setQuoteDate(new Date().toISOString().slice(0, 10));
      setValidityDays(15); setAdvancePct(50); setLeadId(prefillLead?.id || '');
      setNotes(''); setTermsText(''); setDiscountPct(0); setDiscountAmt(0); setGstPct(0); setEstCost(0);
      setItems([emptyItem()]); setAddlWork([]);
    }
  }, [editData, open, prefillLead]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Live totals
  const itemsTotal   = items.reduce((s, i) => s + (i.amount || 0), 0);
  const addlTotal    = addlWork.reduce((s, i) => s + (i.amount || 0), 0);
  const subtotal     = itemsTotal + addlTotal;
  const discount     = discountAmt > 0 ? discountAmt : (subtotal * discountPct) / 100;
  const afterDisc    = subtotal - discount;
  const gstAmt       = (afterDisc * gstPct) / 100;
  const grandTotal   = afterDisc + gstAmt;
  const netProfit    = grandTotal - estCost;
  const profitMargin = grandTotal > 0 ? Math.round((netProfit / grandTotal) * 100) : 0;
  const advanceAmt   = (grandTotal * advancePct) / 100;

  // Item helpers
  const updateItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      // Auto-calc areaQty from L×W if both set
      if (field === 'length' || field === 'width') {
        if (updated.length > 0 && updated.width > 0) updated.areaQty = +(updated.length * updated.width).toFixed(2);
      }
      // Auto-calc amount
      updated.amount = +(updated.areaQty * updated.rate).toFixed(2);
      return updated;
    }));
  };

  const updateAddl = (i: number, field: keyof AddlItem, val: any) => {
    setAddlWork(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      updated.amount = +(updated.qty * updated.rate).toFixed(2);
      return updated;
    }));
  };

  // Save mutation
  const mutation = useMutation({
    mutationFn: (data: any) => editData
      ? api.patch(`/quotations/${editData.id}`, data)
      : api.post('/quotations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: editData ? '✅ Quotation updated' : '✅ Quotation created!', description: `Grand Total: ₹${grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Save failed', description: e.response?.data?.error?.message }),
  });

  const handleSave = () => {
    if (!clientName.trim()) { toast({ variant: 'destructive', title: 'Client name is required' }); return; }
    mutation.mutate({
      clientName, clientPhone, projectDetails, quoteDate, validityDays, advancePct,
      leadId: leadId || undefined,
      notes, termsText, discountPct, discountAmt, gstPct, estCost,
      subtotal, grandTotal,
      items:   items.map(({ length, width, ...i }) => ({ ...i, length: length || 0, width: width || 0 })),
      addlWork,
    });
  };

  const inp = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl
        w-full max-w-[820px]
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[22px] font-display font-bold text-slate-900">
                {editData ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              {editData && (
                <span className="text-[13px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {editData.quoteNumber}
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-500 font-medium mt-0.5">Create and manage professional quotations</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body + sidebar ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left — form */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-7 py-5 space-y-6">

            {/* ── CLIENT DETAILS ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Client Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Client Name *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Priya & Aakash" className={inp} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Phone Number</label>
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 98765 43210" className={inp} />
                </div>
              </div>
            </div>

            {/* ── PROJECT DETAILS ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Project Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Project / Event</label>
                  <input value={projectDetails} onChange={e => setProjectDetails(e.target.value)} placeholder="Wedding Decoration & Catering" className={inp} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Quote Date</label>
                  <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Validity (days)</label>
                  <input type="number" value={validityDays} onChange={e => setValidityDays(+e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Advance Required (%)</label>
                  <input type="number" value={advancePct} onChange={e => setAdvancePct(+e.target.value)} min={0} max={100} className={inp} />
                </div>
              </div>
            </div>

            {/* ── ITEM DETAILS ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Item Details</p>
                <button
                  onClick={() => setItems(p => [...p, emptyItem()])}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#1F5C45] bg-[#1F5C45]/10 hover:bg-[#1F5C45]/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-bold uppercase text-slate-400 pb-2 w-8">#</th>
                      <th className="text-left text-[11px] font-bold uppercase text-slate-400 pb-2">Description</th>
                      <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-16">L</th>
                      <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-16">W</th>
                      <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-24">Area/Qty</th>
                      <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-20">Unit</th>
                      <th className="text-right text-[11px] font-bold uppercase text-slate-400 pb-2 w-24">Rate (₹)</th>
                      <th className="text-right text-[11px] font-bold uppercase text-slate-400 pb-2 w-28">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2.5 text-[13px] font-bold text-slate-400 pr-2">{String(i+1).padStart(2,'0')}</td>
                        <td className="py-2.5 pr-2">
                          <input value={it.description} onChange={e => updateItem(i,'description',e.target.value)} placeholder="Item name" className={`${inp} text-[14px]`} />
                          <input value={it.notes} onChange={e => updateItem(i,'notes',e.target.value)} placeholder="Notes (optional)" className={`${inp} text-[12px] mt-1.5 bg-slate-50`} />
                        </td>
                        <td className="py-2.5 pr-1">
                          <input type="number" value={it.length || ''} onChange={e => updateItem(i,'length',+e.target.value)} placeholder="0" className={`${inp} text-center text-[14px]`} />
                        </td>
                        <td className="py-2.5 pr-1">
                          <input type="number" value={it.width || ''} onChange={e => updateItem(i,'width',+e.target.value)} placeholder="0" className={`${inp} text-center text-[14px]`} />
                        </td>
                        <td className="py-2.5 pr-1">
                          <input type="number" value={it.areaQty || ''} onChange={e => updateItem(i,'areaQty',+e.target.value)} placeholder="0" className={`${inp} text-center text-[14px]`} />
                        </td>
                        <td className="py-2.5 pr-1">
                          <select value={it.unit} onChange={e => updateItem(i,'unit',e.target.value)} className={`${inp} text-[13px]`}>
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="py-2.5 pr-1">
                          <input type="number" value={it.rate || ''} onChange={e => updateItem(i,'rate',+e.target.value)} placeholder="0" className={`${inp} text-right text-[14px]`} />
                        </td>
                        <td className="py-2.5 pr-1 text-right">
                          <span className="text-[15px] font-bold text-slate-900">
                            ₹{(it.amount||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {items.length > 1 && (
                            <button onClick={() => setItems(p => p.filter((_,j) => j !== i))}
                              className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── ADDITIONAL WORK (collapsible) ── */}
            <div>
              <button
                onClick={() => setAddlOpen(p => !p)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Additional Work</p>
                <span className="flex items-center gap-2 text-[13px] font-bold text-[#1F5C45]">
                  <Plus size={13} onClick={e => { e.stopPropagation(); setAddlWork(p => [...p, emptyAddl()]); setAddlOpen(true); }} />
                  {addlOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {addlOpen && (
                <div className="mt-3">
                  {addlWork.length === 0 ? (
                    <button onClick={() => setAddlWork([emptyAddl()])}
                      className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-[14px] font-semibold text-slate-400 hover:border-[#1F5C45]/40 hover:text-[#1F5C45] transition-all">
                      + Add Additional Work
                    </button>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-[11px] font-bold uppercase text-slate-400 pb-2 w-8">#</th>
                          <th className="text-left text-[11px] font-bold uppercase text-slate-400 pb-2">Item</th>
                          <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-16">Qty</th>
                          <th className="text-center text-[11px] font-bold uppercase text-slate-400 pb-2 w-20">Unit</th>
                          <th className="text-right text-[11px] font-bold uppercase text-slate-400 pb-2 w-24">Rate</th>
                          <th className="text-right text-[11px] font-bold uppercase text-slate-400 pb-2 w-24">Amount</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {addlWork.map((it, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-2 text-[13px] font-bold text-slate-400 pr-2">{i+1}</td>
                            <td className="py-2 pr-2">
                              <input value={it.item} onChange={e => updateAddl(i,'item',e.target.value)} placeholder="Work description" className={`${inp} text-[14px]`} />
                            </td>
                            <td className="py-2 pr-1">
                              <input type="number" value={it.qty || ''} onChange={e => updateAddl(i,'qty',+e.target.value)} className={`${inp} text-center text-[14px]`} />
                            </td>
                            <td className="py-2 pr-1">
                              <select value={it.unit} onChange={e => updateAddl(i,'unit',e.target.value)} className={`${inp} text-[13px]`}>
                                {UNITS.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-2 pr-1">
                              <input type="number" value={it.rate || ''} onChange={e => updateAddl(i,'rate',+e.target.value)} className={`${inp} text-right text-[14px]`} />
                            </td>
                            <td className="py-2 text-right pr-1">
                              <span className="text-[14px] font-bold text-slate-900">₹{it.amount.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                            </td>
                            <td className="py-2">
                              <button onClick={() => setAddlWork(p => p.filter((_,j) => j !== i))}
                                className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-all">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* ── TERMS & NOTES (collapsible) ── */}
            <div>
              <button onClick={() => setTermsOpen(p => !p)} className="flex items-center justify-between w-full">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Terms &amp; Notes</p>
                {termsOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {termsOpen && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add notes, terms, or payment instructions..." className={`${inp} resize-none`} />
                    <div className="flex gap-2 mt-2">
                      {[`${advancePct}% Advance required`, '15 Days Validity', 'No cancellation after booking'].map(t => (
                        <button key={t} onClick={() => setNotes(p => p ? `${p}\n${t}` : t)}
                          className="text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Terms &amp; Conditions</label>
                    <textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={4} placeholder="Payment terms, cancellation policy..." className={`${inp} resize-none`} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — Profit Summary sidebar */}
          <div className="w-64 flex-shrink-0 bg-slate-50 border-l border-slate-100 overflow-y-auto scrollbar-thin px-5 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-800">Profit Summary</p>
              <span className="text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Live</span>
            </div>

            {/* Totals */}
            <div className="space-y-2.5">
              <div className="flex justify-between text-[14px]">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
              </div>

              {/* Discount */}
              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-slate-500 font-medium">Discount</span>
                  <span className="font-bold text-red-500">−₹{discount.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
                <div className="flex gap-1.5">
                  <input type="number" value={discountPct || ''} onChange={e => { setDiscountPct(+e.target.value); setDiscountAmt(0); }}
                    placeholder="%" className="w-1/2 h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-[#1F5C45]" />
                  <input type="number" value={discountAmt || ''} onChange={e => { setDiscountAmt(+e.target.value); setDiscountPct(0); }}
                    placeholder="₹ Amt" className="w-1/2 h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-[#1F5C45]" />
                </div>
              </div>

              {/* GST */}
              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-slate-500 font-medium">GST (%)</span>
                  <span className="font-bold text-slate-900">₹{gstAmt.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
                <input type="number" value={gstPct || ''} onChange={e => setGstPct(+e.target.value)} placeholder="0" min={0} max={28}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-[#1F5C45]" />
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-[#0f1f18] rounded-xl px-4 py-3">
              <p className="text-[12px] font-bold text-white/50 uppercase tracking-wide mb-1">Grand Total</p>
              <p className="text-[22px] font-bold text-[#C9A24B] font-display">
                ₹{grandTotal.toLocaleString('en-IN',{maximumFractionDigits:0})}
              </p>
            </div>

            {/* Advance */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-1">Advance ({advancePct}%)</p>
              <p className="text-[17px] font-bold text-slate-900">
                ₹{advanceAmt.toLocaleString('en-IN',{maximumFractionDigits:0})}
              </p>
            </div>

            {/* Est Cost + Profit */}
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 space-y-2">
              <p className="text-[11px] font-bold text-green-700 uppercase tracking-wide">Profit Margin</p>
              <div className="flex justify-between">
                <span className="text-[22px] font-bold text-green-700">{profitMargin}%</span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%` }} />
              </div>
              <div className="flex justify-between text-[12px] font-semibold">
                <span className="text-slate-500">Est. Cost</span>
                <span className="text-slate-500">Net Profit</span>
              </div>
              <div className="flex justify-between">
                <input type="number" value={estCost || ''} onChange={e => setEstCost(+e.target.value)} placeholder="0"
                  className="w-24 h-7 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-[#1F5C45]" />
                <span className="text-[13px] font-bold text-green-700">
                  ₹{netProfit.toLocaleString('en-IN',{maximumFractionDigits:0})}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-7 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[14px] font-bold text-slate-700 tracking-wide uppercase transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex-1 h-11 rounded-xl bg-[#0f1f18] hover:bg-[#1F5C45] text-white text-[14px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : editData ? 'Update Quotation' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </>
  );
}
