import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: any;
  prefillLead?: any;
}

const UNITS = ['Sq.ft', 'Sq.m', 'Rft', 'Nos', 'Set', 'Lot', 'Kg', 'Box', 'Day'];

interface Item {
  description: string;
  notes: string;
  quantity: number;
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

function emptyItem(): Item { return { description: '', notes: '', quantity: 0, unit: 'Nos', rate: 0, amount: 0 }; }
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
      setClientName(prefillLead?.name || '');
      setClientPhone(prefillLead?.primaryPhone || '');
      setProjectDetails('');
      setQuoteDate(new Date().toISOString().slice(0, 10));
      setValidityDays(15); setAdvancePct(50); setLeadId(prefillLead?.id || '');
      setNotes(''); setTermsText(''); setDiscountPct(0); setDiscountAmt(0); setGstPct(0); setEstCost(0);
      setItems([emptyItem()]); setAddlWork([]);
    }
  }, [editData, open, prefillLead]);

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

  const updateItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      updated.amount = +(updated.quantity * updated.rate).toFixed(2);
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
      items: items,
      addlWork,
    });
  };

  const inp = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40 focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal';
  const label = 'block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl
        w-full max-w-6xl
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-8 pt-7 pb-6 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-white to-slate-50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {editData ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              {editData && (
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                  {editData.quoteNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 font-medium mt-1">Create and manage professional quotations</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body + sidebar ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left — form */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-7 space-y-8">

            {/* ── CLIENT DETAILS ── */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Client Details</p>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={label}>Client Name *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Priya & Aakash" className={inp} />
                </div>
                <div>
                  <label className={label}>Phone Number</label>
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 98765 43210" className={inp} />
                </div>
              </div>
            </div>

            {/* ── PROJECT DETAILS ── */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Project Details</p>
              <div className="space-y-4">
                <div>
                  <label className={label}>Project / Event</label>
                  <input value={projectDetails} onChange={e => setProjectDetails(e.target.value)} placeholder="Wedding Decoration & Catering" className={inp} />
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <label className={label}>Quote Date</label>
                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={label}>Validity (days)</label>
                    <input type="number" value={validityDays} onChange={e => setValidityDays(+e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={label}>Advance Required (%)</label>
                    <input type="number" value={advancePct} onChange={e => setAdvancePct(+e.target.value)} min={0} max={100} className={inp} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── ITEM DETAILS ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Item Details</p>
                <button
                  onClick={() => setItems(p => [...p, emptyItem()])}
                  className="flex items-center gap-1.5 text-sm font-bold text-[#1F5C45] bg-[#1F5C45]/10 hover:bg-[#1F5C45]/20 px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-bold uppercase text-slate-600 px-5 py-4 w-10">#</th>
                      <th className="text-left text-xs font-bold uppercase text-slate-600 px-5 py-4">Description</th>
                      <th className="text-center text-xs font-bold uppercase text-slate-600 px-5 py-4 w-28">Quantity</th>
                      <th className="text-center text-xs font-bold uppercase text-slate-600 px-5 py-4 w-28">Unit</th>
                      <th className="text-right text-xs font-bold uppercase text-slate-600 px-5 py-4 w-28">Rate (₹)</th>
                      <th className="text-right text-xs font-bold uppercase text-slate-600 px-5 py-4 w-32">Amount</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5 text-sm font-bold text-slate-400">{String(i+1).padStart(2,'0')}</td>
                        <td className="py-4 px-5">
                          <div className="space-y-2.5">
                            <input
                              value={it.description}
                              onChange={e => updateItem(i,'description',e.target.value)}
                              placeholder="e.g., Chairs, Tables, Mattresses, Flowers"
                              className={`${inp} text-sm`}
                            />
                            <input
                              value={it.notes}
                              onChange={e => updateItem(i,'notes',e.target.value)}
                              placeholder="Notes (optional)"
                              className={`${inp} text-xs bg-slate-50`}
                            />
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <input
                            type="number"
                            value={it.quantity || ''}
                            onChange={e => updateItem(i,'quantity',+e.target.value)}
                            placeholder="0"
                            className={`${inp} text-center text-lg font-bold`}
                          />
                        </td>
                        <td className="py-4 px-5">
                          <select
                            value={it.unit}
                            onChange={e => updateItem(i,'unit',e.target.value)}
                            className={`${inp} text-sm`}
                          >
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="py-4 px-5">
                          <input
                            type="number"
                            value={it.rate || ''}
                            onChange={e => updateItem(i,'rate',+e.target.value)}
                            placeholder="0"
                            className={`${inp} text-right text-lg font-bold`}
                          />
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="text-lg font-bold text-slate-900">
                            ₹{(it.amount||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {items.length > 1 && (
                            <button onClick={() => setItems(p => p.filter((_,j) => j !== i))}
                              className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── ADDITIONAL WORK ── */}
            <div>
              <button
                onClick={() => setAddlOpen(p => !p)}
                className="flex items-center justify-between w-full p-4 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Additional Work</p>
                <span className="flex items-center gap-2 text-sm font-bold text-[#1F5C45]">
                  <Plus size={14} onClick={e => { e.stopPropagation(); setAddlWork(p => [...p, emptyAddl()]); setAddlOpen(true); }} />
                  {addlOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {addlOpen && (
                <div className="mt-4">
                  {addlWork.length === 0 ? (
                    <button onClick={() => setAddlWork([emptyAddl()])}
                      className="w-full py-6 border-2 border-dashed border-slate-300 rounded-lg text-sm font-bold text-slate-500 hover:border-[#1F5C45]/40 hover:text-[#1F5C45] transition-all">
                      + Add Additional Work
                    </button>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left text-xs font-bold uppercase text-slate-600 px-4 py-3 w-12">#</th>
                            <th className="text-left text-xs font-bold uppercase text-slate-600 px-4 py-3">Item</th>
                            <th className="text-center text-xs font-bold uppercase text-slate-600 px-4 py-3 w-20">Qty</th>
                            <th className="text-center text-xs font-bold uppercase text-slate-600 px-4 py-3 w-24">Unit</th>
                            <th className="text-right text-xs font-bold uppercase text-slate-600 px-4 py-3 w-24">Rate</th>
                            <th className="text-right text-xs font-bold uppercase text-slate-600 px-4 py-3 w-28">Amount</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {addlWork.map((it, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-bold text-slate-400">{i+1}</td>
                              <td className="py-3 px-4">
                                <input value={it.item} onChange={e => updateAddl(i,'item',e.target.value)} placeholder="Work description" className={inp} />
                              </td>
                              <td className="py-3 px-4">
                                <input type="number" value={it.qty || ''} onChange={e => updateAddl(i,'qty',+e.target.value)} className={`${inp} text-center`} />
                              </td>
                              <td className="py-3 px-4">
                                <select value={it.unit} onChange={e => updateAddl(i,'unit',e.target.value)} className={inp}>
                                  {UNITS.map(u => <option key={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="py-3 px-4">
                                <input type="number" value={it.rate || ''} onChange={e => updateAddl(i,'rate',+e.target.value)} className={`${inp} text-right`} />
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-sm font-bold text-slate-900">₹{it.amount.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                              </td>
                              <td className="py-3 px-4">
                                <button onClick={() => setAddlWork(p => p.filter((_,j) => j !== i))}
                                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── TERMS & NOTES ── */}
            <div>
              <button onClick={() => setTermsOpen(p => !p)} className="flex items-center justify-between w-full p-4 rounded-lg hover:bg-slate-50 transition-colors">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Terms &amp; Notes</p>
                {termsOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>
              {termsOpen && (
                <div className="mt-4 grid grid-cols-2 gap-6">
                  <div>
                    <label className={label}>Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Add notes, special requests, or payment instructions..." className={`${inp} resize-none`} />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[`${advancePct}% Advance required`, '15 Days Validity', 'Balance 15 days before event', 'Security deposit refundable', 'No external caterers allowed', 'Venue curfew at 10:00 PM', 'Damage charges applicable', 'Setup time included'].map(t => (
                        <button key={t} onClick={() => setNotes(p => p ? `${p}\n${t}` : t)}
                          className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={label}>Terms &amp; Conditions</label>
                    <textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={6} placeholder="Add all terms, policies, and conditions..." className={`${inp} resize-none`} />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[
                        'Advance payments are non-refundable',
                        'Applicable GST 18% as per invoice',
                        'Extra hour charges at 20% per hour',
                        'Security deposit Rs. 25,000',
                        'Liquor license required for alcohol',
                        'No loud music after 10:00 PM',
                        'No firecrackers or loud pyrotechnics',
                        'Cancellation charges as per policy',
                        'Guests: No outside catering',
                        'Professional decorators preferred',
                        'Parking charges may apply',
                        'Electricity surcharge if exceeds 50kW'
                      ].map(t => (
                        <button key={t} onClick={() => setTermsText(p => p ? `${p}\n${t}` : t)}
                          className="text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — Profit Summary sidebar */}
          <div className="w-80 flex-shrink-0 bg-gradient-to-b from-slate-50 to-white border-l border-slate-200 overflow-y-auto scrollbar-thin px-7 py-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-slate-900">Profit Summary</p>
              <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">Live</span>
            </div>

            {/* Totals */}
            <div className="space-y-4 border-b border-slate-200 pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
              </div>

              {/* Discount */}
              <div>
                <div className="flex justify-between text-sm mb-2.5">
                  <span className="text-slate-600 font-medium">Discount</span>
                  <span className="font-bold text-red-600">−₹{discount.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
                <div className="flex gap-2">
                  <input type="number" value={discountPct || ''} onChange={e => { setDiscountPct(+e.target.value); setDiscountAmt(0); }}
                    placeholder="%" className="w-1/2 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40" />
                  <input type="number" value={discountAmt || ''} onChange={e => { setDiscountAmt(+e.target.value); setDiscountPct(0); }}
                    placeholder="₹ Amt" className="w-1/2 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40" />
                </div>
              </div>

              {/* GST */}
              <div>
                <div className="flex justify-between text-sm mb-2.5">
                  <span className="text-slate-600 font-medium">GST (%)</span>
                  <span className="font-bold text-slate-900">₹{gstAmt.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
                <input type="number" value={gstPct || ''} onChange={e => setGstPct(+e.target.value)} placeholder="0" min={0} max={28}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]/40" />
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-br from-[#1F5C45] to-[#143d2e] rounded-xl px-5 py-5 text-white">
              <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Grand Total</p>
              <p className="text-3xl font-bold text-[#C9A24B]">
                ₹{grandTotal.toLocaleString('en-IN',{maximumFractionDigits:0})}
              </p>
            </div>

            {/* Advance */}
            <div className="bg-white rounded-lg border border-slate-300 px-5 py-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Advance ({advancePct}%)</p>
              <p className="text-2xl font-bold text-slate-900">
                ₹{advanceAmt.toLocaleString('en-IN',{maximumFractionDigits:0})}
              </p>
            </div>

            {/* Profit */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg px-5 py-4 space-y-3">
              <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Profit Margin</p>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold text-green-700">{profitMargin}%</span>
              </div>
              <div className="h-2.5 bg-white rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-xs text-green-700 font-semibold mb-1">Est. Cost</p>
                  <input type="number" value={estCost || ''} onChange={e => setEstCost(+e.target.value)} placeholder="0"
                    className="w-full h-8 rounded-lg border border-green-300 bg-white/50 px-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-600/40" />
                </div>
                <div>
                  <p className="text-xs text-green-700 font-semibold mb-1">Net Profit</p>
                  <p className="text-xl font-bold text-green-700">
                    ₹{netProfit.toLocaleString('en-IN',{maximumFractionDigits:0})}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-4 px-8 py-5 border-t border-slate-200 flex-shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 tracking-wide uppercase transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex-1 h-11 rounded-lg bg-gradient-to-r from-[#1F5C45] to-[#0f1f18] hover:from-[#2d7a5e] hover:to-[#143d2e] text-white text-sm font-bold tracking-wide uppercase transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Saving…' : editData ? 'Update Quotation' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </>
  );
}
