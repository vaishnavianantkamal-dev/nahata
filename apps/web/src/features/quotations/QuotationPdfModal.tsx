import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Send, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  quotation: any;
  onClose: () => void;
}

const THEMES = [
  { id: 'stylish',    label: 'Stylish',      desc: 'Dark header, professional look' },
  { id: 'minimalist', label: 'Minimalist',   desc: 'Clean, simple, modern' },
  { id: 'gst',        label: 'GST Invoice',  desc: 'With full tax breakdown' },
];

const COLORS = [
  { hex: '#1F5C45', name: 'Evergreen' },
  { hex: '#0f1f18', name: 'Dark' },
  { hex: '#1d4ed8', name: 'Blue' },
  { hex: '#7c3aed', name: 'Purple' },
  { hex: '#be185d', name: 'Pink' },
  { hex: '#C9A24B', name: 'Gold' },
  { hex: '#ea580c', name: 'Orange' },
];

export function QuotationPdfModal({ quotation, onClose }: Props) {
  const qc = useQueryClient();
  const [theme,  setTheme]  = useState<'stylish'|'minimalist'|'gst'>('stylish');
  const [color,  setColor]  = useState('#1F5C45');
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showNotes,        setShowNotes]        = useState(true);
  const [showBankDetails,  setShowBankDetails]  = useState(false);

  // Download PDF
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/quotations/${quotation.id}/pdf`, { theme, color }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quotation.quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: '✅ PDF downloaded!' }),
    onError: (e: any) => toast({ variant: 'destructive', title: 'PDF generation failed', description: e.message }),
  });

  // Send via WhatsApp
  const sendMutation = useMutation({
    mutationFn: () => api.post(`/quotations/${quotation.id}/send-whatsapp`, { theme, color }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: '✅ Sent via WhatsApp!', description: res.data.message });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Send failed', description: e.response?.data?.error?.message || 'Check phone number' }),
  });

  const busy = downloadMutation.isPending || sendMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[840px] max-h-[90vh] flex overflow-hidden">

        {/* ── Left panel — settings ── */}
        <div className="w-72 flex-shrink-0 border-r border-slate-100 overflow-y-auto scrollbar-thin p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-[18px] font-display font-bold text-slate-900">Invoice Settings</h3>
            <p className="text-[13px] text-slate-500 font-medium mt-0.5">Customize your download style</p>
          </div>

          {/* Themes */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Themes
            </p>
            <div className="space-y-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left',
                    theme === t.id
                      ? 'border-[#1F5C45] bg-[#1F5C45]/5'
                      : 'border-slate-100 hover:border-slate-200 bg-white',
                  )}
                >
                  {/* Theme thumbnail */}
                  <div className={cn(
                    'w-12 h-14 rounded-lg border-2 flex-shrink-0 overflow-hidden',
                    theme === t.id ? 'border-[#1F5C45]' : 'border-slate-200',
                  )}>
                    {t.id === 'stylish' && (
                      <div>
                        <div className="h-4 w-full" style={{ backgroundColor: color }} />
                        <div className="p-1 space-y-1">
                          <div className="h-1 bg-slate-200 rounded" />
                          <div className="h-1 bg-slate-200 rounded w-3/4" />
                          <div className="h-0.5 bg-slate-100 rounded" />
                          <div className="h-0.5 bg-slate-100 rounded w-5/6" />
                        </div>
                      </div>
                    )}
                    {t.id === 'minimalist' && (
                      <div className="p-1 space-y-1">
                        <div className="h-1.5 bg-slate-800 rounded w-2/3" />
                        <div className="h-0.5 w-full rounded" style={{ backgroundColor: color }} />
                        <div className="h-0.5 bg-slate-200 rounded" />
                        <div className="h-0.5 bg-slate-200 rounded w-3/4" />
                        <div className="h-0.5 bg-slate-200 rounded w-5/6" />
                        <div className="mt-1 h-1 rounded" style={{ backgroundColor: color + '40' }} />
                      </div>
                    )}
                    {t.id === 'gst' && (
                      <div className="p-1 space-y-1">
                        <div className="h-1 bg-slate-800 rounded w-1/2" />
                        <div className="h-0.5 bg-slate-200 rounded" />
                        <div className="h-0.5 bg-slate-200 rounded w-3/4" />
                        <div className="h-0.5" />
                        <div className="flex gap-0.5">
                          <div className="h-0.5 bg-slate-300 rounded flex-1" />
                          <div className="h-0.5 bg-slate-300 rounded flex-1" />
                        </div>
                        <div className="h-1 w-full rounded" style={{ backgroundColor: color }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-800">{t.label}</p>
                    <p className="text-[12px] text-slate-400 font-medium">{t.desc}</p>
                  </div>
                  {theme === t.id && <Check size={14} className="text-[#1F5C45] ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-3">Accent Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={cn('w-9 h-9 rounded-xl transition-all', color === c.hex ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Theme Settings */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-3">Include in PDF</p>
            <div className="space-y-2.5">
              {[
                { label: 'Item descriptions',  val: showDescriptions, set: setShowDescriptions },
                { label: 'Notes & terms',       val: showNotes,        set: setShowNotes },
                { label: 'Bank details',        val: showBankDetails,  set: setShowBankDetails },
              ].map(opt => (
                <button key={opt.label} onClick={() => opt.set(p => !p)}
                  className="flex items-center gap-3 w-full">
                  <div className={cn('w-5 h-5 rounded-md flex items-center justify-center transition-colors',
                    opt.val ? 'bg-[#1F5C45]' : 'border-2 border-slate-300 bg-white'
                  )}>
                    {opt.val && <Check size={12} className="text-white" />}
                  </div>
                  <span className="text-[14px] font-medium text-slate-700">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => downloadMutation.mutate()}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-[#1F5C45] hover:bg-[#143d2e] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Download size={16} />
              {downloadMutation.isPending ? 'Generating…' : 'Generate & Download'}
            </button>

            {quotation.clientPhone && (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={busy}
                className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <Send size={16} />
                {sendMutation.isPending ? 'Sending…' : `Send on WhatsApp`}
              </button>
            )}
            {!quotation.clientPhone && (
              <p className="text-[13px] text-amber-600 font-medium text-center bg-amber-50 rounded-xl p-3">
                ⚠️ Add client phone number to enable WhatsApp sending
              </p>
            )}
          </div>
        </div>

        {/* ── Right panel — live preview ── */}
        <div className="flex-1 bg-slate-100 overflow-y-auto scrollbar-thin flex flex-col items-center p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Live Preview</span>
          </div>

          {/* A4 preview */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] overflow-hidden">
            {/* Header */}
            <div className={cn('px-6 py-4', theme === 'stylish' ? 'text-white' : 'border-b border-slate-200')}
              style={{ backgroundColor: theme === 'stylish' ? '#0f1f18' : 'white' }}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={cn('text-[16px] font-bold', theme === 'stylish' ? 'text-white' : 'text-slate-900')}>Nahata Lawns</p>
                  <p style={{ color: color }} className="text-[11px] font-semibold">Wedding &amp; Events Venue</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-[15px] font-bold', theme === 'stylish' ? 'text-white' : 'text-slate-900')}>QUOTATION</p>
                  <p className="text-[10px] text-slate-400 font-medium">{quotation.quoteNumber}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-1" style={{ backgroundColor: color }} />

            {/* Client + Amount */}
            <div className="px-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Quotation For</p>
                  <p className="text-[14px] font-bold text-slate-900">{quotation.clientName}</p>
                  {quotation.clientPhone && <p className="text-[11px] text-slate-500 mt-0.5">{quotation.clientPhone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Grand Total</p>
                  <p className="text-[18px] font-bold" style={{ color }}>
                    ₹{quotation.grandTotal.toLocaleString('en-IN',{maximumFractionDigits:0})}
                  </p>
                </div>
              </div>
            </div>

            {/* Items preview */}
            <div className="px-6 pb-4">
              <div className="rounded-lg overflow-hidden border border-slate-100">
                <div className="bg-slate-50 px-3 py-2 flex justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Item Description</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Amount</span>
                </div>
                {(quotation.items || []).slice(0, 3).map((it: any, i: number) => (
                  <div key={i} className="px-3 py-2 border-t border-slate-100 flex justify-between">
                    <span className="text-[12px] font-semibold text-slate-800">{it.description || `Item ${i+1}`}</span>
                    <span className="text-[12px] font-bold text-slate-900">₹{(it.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                  </div>
                ))}
              </div>
              {/* Summary */}
              <div className="mt-3 rounded-lg overflow-hidden border border-slate-100">
                <div className="px-3 py-2 flex justify-between">
                  <span className="text-[11px] text-slate-500">Subtotal</span>
                  <span className="text-[11px] font-semibold">₹{quotation.subtotal.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
                <div className="px-3 py-2 flex justify-between" style={{ backgroundColor: color }}>
                  <span className="text-[12px] font-bold text-white">TOTAL</span>
                  <span className="text-[12px] font-bold text-white">₹{quotation.grandTotal.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>
              </div>
              {quotation.notes && showNotes && (
                <div className="mt-3 text-[10px] text-slate-500 italic border-t border-slate-100 pt-2">
                  NOTES: {quotation.notes.slice(0,80)}{quotation.notes.length > 80 ? '…' : ''}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <div className="border-t border-slate-400 pt-1 w-24">
                    <p className="text-[9px] text-slate-400">SIGNATURE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-slate-400 font-medium mt-4">High quality PDF will be generated with this styling</p>
        </div>

        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors z-10">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
