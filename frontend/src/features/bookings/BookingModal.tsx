import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Tag, MapPin, Calendar, Clock, Users, Wallet,
  FileText, Link2, User, Phone, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useCmsLists } from '@/hooks/use-cms-lists';

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: any | null;
  defaultDate?: string | null;
}

const STATUSES = [
  { value: 'CONFIRMED', label: '✅ Confirmed', sub: 'Blocks the date' },
  { value: 'TENTATIVE', label: '🕗 Tentative', sub: 'Soft hold' },
  { value: 'CANCELLED', label: '✖️ Cancelled', sub: 'Frees the date' },
];

const EMPTY = {
  leadId: '', title: '', clientName: '', clientPhone: '',
  eventType: 'WEDDING', venue: 'Main Lawn', eventDate: '',
  startTime: '', endTime: '', guestCount: '', status: 'CONFIRMED',
  amount: '', advanceReceived: '', notes: '',
};

export function BookingModal({ open, onClose, editData, defaultDate }: Props) {
  const qc = useQueryClient();
  const { allEventTypes } = useCmsLists();
  const [form, setForm] = useState<any>(EMPTY);
  const isEdit = !!editData?.id;

  // Hydrate the form when the drawer opens (edit → existing values, create → blank/prefilled date)
  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        leadId: editData.leadId || '', title: editData.title || '',
        clientName: editData.clientName || '', clientPhone: editData.clientPhone || '',
        eventType: editData.eventType || 'WEDDING', venue: editData.venue || 'Main Lawn',
        eventDate: (editData.eventDate || '').slice(0, 10),
        startTime: editData.startTime || '', endTime: editData.endTime || '',
        guestCount: editData.guestCount ?? '', status: editData.status || 'CONFIRMED',
        amount: editData.amount ?? '', advanceReceived: editData.advanceReceived ?? '',
        notes: editData.notes || '',
      });
    } else {
      setForm({ ...EMPTY, eventDate: defaultDate || '' });
    }
  }, [open, editData, defaultDate]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  // Open leads to optionally link a booking to
  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'for-booking'],
    queryFn: () => api.get('/leads?pageSize=100&status=OPEN').then(r => r.data),
    enabled: open,
  });
  const leads = leadsData?.data || [];

  // Live availability for the chosen date + venue
  const { data: availability, isFetching: checking } = useQuery({
    queryKey: ['booking-availability', form.eventDate, form.venue, editData?.id],
    queryFn: () => api.get('/bookings/availability', {
      params: { date: form.eventDate, venue: form.venue || 'Main Lawn', excludeId: editData?.id },
    }).then(r => r.data),
    enabled: open && !!form.eventDate,
  });

  const onPickLead = (leadId: string) => {
    set('leadId', leadId);
    const lead = leads.find((l: any) => l.id === leadId);
    if (lead) {
      setForm((f: any) => ({
        ...f, leadId,
        clientName: lead.name || f.clientName,
        clientPhone: lead.primaryPhone || f.clientPhone,
        eventType: lead.eventType || f.eventType,
        guestCount: f.guestCount || (lead.guestCount ?? ''),
        eventDate: f.eventDate || (lead.eventDate ? String(lead.eventDate).slice(0, 10) : ''),
      }));
    }
  };

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      isEdit ? api.patch(`/bookings/${editData.id}`, payload) : api.post('/bookings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings-calendar'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: isEdit ? '✅ Booking updated' : '✅ Booking created' });
      onClose();
    },
    onError: (e: any) => {
      const err = e.response?.data?.error;
      toast({
        variant: 'destructive',
        title: err?.code === 'DOUBLE_BOOKING' ? '⛔ Date already booked' : 'Could not save booking',
        description: err?.message || 'Please check the details and try again.',
      });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim() && !form.leadId) {
      toast({ variant: 'destructive', title: 'Client name is required' });
      return;
    }
    if (!form.eventDate) {
      toast({ variant: 'destructive', title: 'Event date is required' });
      return;
    }
    mutation.mutate({
      leadId: form.leadId || undefined,
      title: form.title.trim() || undefined,
      clientName: form.clientName.trim() || undefined,
      clientPhone: form.clientPhone.trim() || undefined,
      // Custom event types (CUSTOM::label) aren't enum values → fall back to OTHER
      eventType: String(form.eventType).startsWith('CUSTOM::') ? 'OTHER' : form.eventType,
      venue: form.venue.trim() || 'Main Lawn',
      eventDate: form.eventDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      guestCount: form.guestCount !== '' ? form.guestCount : undefined,
      status: form.status,
      amount: form.amount !== '' ? form.amount : undefined,
      advanceReceived: form.advanceReceived !== '' ? form.advanceReceived : undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const willConflict = form.status === 'CONFIRMED' && availability && !availability.available;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-full sm:max-w-[640px] md:max-w-[700px]
        bg-white shadow-2xl flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 flex-shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[24px] font-display font-bold text-slate-900 leading-tight">
              {isEdit ? 'Edit Booking' : 'New Booking'}
            </h2>
            <p className="text-[13px] sm:text-[15px] text-slate-500 font-medium mt-1">
              Block a date and prevent double-bookings on the lawn
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 sm:px-7 py-4 sm:py-6 space-y-6 sm:space-y-8">

            {/* DATE & AVAILABILITY */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Date &amp; Availability
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label icon={Calendar} text="Event Date" required />
                  <input type="date" value={form.eventDate}
                    onChange={e => set('eventDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <Label icon={MapPin} text="Venue / Lawn" />
                  <input value={form.venue} onChange={e => set('venue', e.target.value)}
                    placeholder="Main Lawn" className={inputCls} />
                </div>
              </div>

              {/* Availability banner */}
              {form.eventDate && (
                <div className="mt-3">
                  {checking ? (
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <Loader2 size={15} className="animate-spin" /> Checking availability…
                    </div>
                  ) : availability ? (
                    availability.available ? (
                      <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <CheckCircle2 size={16} /> {form.venue || 'Main Lawn'} is free on this date
                        {availability.tentative?.length > 0 && (
                          <span className="font-medium text-amber-700">
                            · {availability.tentative.length} tentative hold(s)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-[13px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>
                          Already booked: {availability.confirmed.map((c: any) => c.title).join(', ')}.
                          {form.status === 'CONFIRMED' && ' Confirming will be blocked.'}
                        </span>
                      </div>
                    )
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3">
                <div>
                  <Label icon={Clock} text="Start Time" />
                  <input type="time" value={form.startTime}
                    onChange={e => set('startTime', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <Label icon={Clock} text="End Time" />
                  <input type="time" value={form.endTime}
                    onChange={e => set('endTime', e.target.value)} className={inputCls} />
                </div>
              </div>
            </section>

            {/* CLIENT */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Client &amp; Event
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <Label icon={Link2} text="Link to Lead (optional)" />
                  <select value={form.leadId} onChange={e => onPickLead(e.target.value)} className={inputCls}>
                    <option value="">— No linked lead —</option>
                    {leads.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name} · {l.primaryPhone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label icon={User} text="Client Name" required />
                  <input value={form.clientName} onChange={e => set('clientName', e.target.value)}
                    placeholder="e.g. Priya & Aakash" className={inputCls} />
                </div>
                <div>
                  <Label icon={Phone} text="Client Phone" />
                  <input value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                    placeholder="+91 00000 00000" className={inputCls} />
                </div>
                <div>
                  <Label icon={Tag} text="Event Type" />
                  <select value={form.eventType} onChange={e => set('eventType', e.target.value)} className={inputCls}>
                    {allEventTypes.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label icon={Users} text="Guest Count" />
                  <input type="number" value={form.guestCount}
                    onChange={e => set('guestCount', e.target.value)} placeholder="e.g. 450" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <Label icon={FileText} text="Booking Title" />
                  <input value={form.title} onChange={e => set('title', e.target.value)}
                    placeholder="Auto-generated from client & event if left blank" className={inputCls} />
                </div>
              </div>
            </section>

            {/* COMMERCIALS & STATUS */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Commercials &amp; Status
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label icon={Wallet} text="Booking Amount (₹)" />
                  <input type="number" value={form.amount}
                    onChange={e => set('amount', e.target.value)} placeholder="e.g. 250000" className={inputCls} />
                </div>
                <div>
                  <Label icon={Wallet} text="Advance Received (₹)" />
                  <input type="number" value={form.advanceReceived}
                    onChange={e => set('advanceReceived', e.target.value)} placeholder="e.g. 125000" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <Label icon={CheckCircle2} text="Status" />
                  <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label} — {s.sub}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[14px] font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                    placeholder="Catering, decor, special requests…" className={`${inputCls} resize-none`} />
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex gap-2 sm:gap-3 px-5 sm:px-7 py-4 sm:py-5 border-t border-slate-100 flex-shrink-0 bg-white">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 sm:h-12 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[13px] sm:text-[15px] font-bold text-slate-700 tracking-wide uppercase transition-colors">
              Discard
            </button>
            <button type="submit" disabled={mutation.isPending || (willConflict as boolean)}
              title={willConflict ? 'Date already has a confirmed booking' : undefined}
              className="flex-1 h-10 sm:h-12 rounded-xl bg-[#0f1f18] hover:bg-[#1F5C45] text-white text-[13px] sm:text-[15px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ── Helpers ── */
const inputCls = `
  w-full h-11 rounded-xl border border-slate-200 bg-slate-50
  px-4 text-[14px] sm:text-[16px] font-medium text-slate-900
  focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:bg-white focus:border-transparent
  transition-all placeholder:text-slate-400 placeholder:font-normal
  appearance-none
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
