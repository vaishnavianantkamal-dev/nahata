import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User, Phone, Mail, MapPin, Calendar, Users, Wallet,
  Tag, Star, Layers, UserCircle, X,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useCmsLists } from '@/hooks/use-cms-lists';

interface Props { open: boolean; onClose: () => void; }

const PRIORITIES = [
  { value: 'HOT',  label: '🔥 Hot',  sub: 'Ready to book' },
  { value: 'WARM', label: '🤗 Warm', sub: 'Interested' },
  { value: 'COLD', label: '❄️ Cold', sub: 'Early stage' },
];

export function NewLeadModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { allEventTypes, allSources } = useCmsLists();

  const { data: stages } = useQuery({
    queryKey: ['stages'],
    queryFn:  () => api.get('/stages').then(r => r.data),
    enabled: open,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn:  () => api.get('/users').then(r => r.data),
    enabled: open,
  });

  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '', primaryPhone: '', email: '', location: '',
      eventType: 'WEDDING', guestCount: '', eventDate: '', budgetMin: '', budgetMax: '',
      source: 'MANUAL', priority: 'WARM', stageId: '', ownerId: '', notes: '',
    },
  });

  // Reset form whenever drawer opens
  useEffect(() => { if (open) reset(); }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', {
      name:         data.name,
      primaryPhone: data.primaryPhone,
      email:        data.email || undefined,
      // Custom values (CUSTOM::label) → map to OTHER + store label in notes
      source:       data.source.startsWith('CUSTOM::')    ? 'OTHER'   : data.source,
      eventType:    data.eventType.startsWith('CUSTOM::') ? 'OTHER'   : data.eventType,
      sourceDetail: data.source.startsWith('CUSTOM::')    ? data.source.replace('CUSTOM::','') : undefined,
      notes: [
        data.eventType.startsWith('CUSTOM::') ? `Event Type: ${data.eventType.replace('CUSTOM::','')}` : '',
        data.notes || '',
      ].filter(Boolean).join('\n') || undefined,
      guestCount:   data.guestCount ? parseInt(data.guestCount) : undefined,
      eventDate:    data.eventDate  || undefined,
      budgetMin:    data.budgetMin  ? parseInt(data.budgetMin)  * 100 : undefined,
      budgetMax:    data.budgetMax  ? parseInt(data.budgetMax)  * 100 : undefined,
      stageId:      data.stageId   || undefined,
      ownerId:      data.ownerId   || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline-board'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      toast({ title: '✅ Lead created!', description: 'Welcome WhatsApp message sent automatically.' });
      onClose();
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: 'Failed to create lead', description: e.response?.data?.error?.message || 'Please check all required fields.' });
    },
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer — slides in from right */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-full max-w-[640px]
        bg-white shadow-2xl flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-7 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-[24px] font-display font-bold text-slate-900 leading-tight">
              Nurture New Lead
            </h2>
            <p className="text-[15px] text-slate-500 font-medium mt-1">
              Capture every detail to ensure better conversion
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0 ml-4 mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <form
          onSubmit={handleSubmit(d => mutation.mutate(d))}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          <div className="px-7 py-6 space-y-8">

            {/* ── PRIMARY INFORMATION ── */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Primary Information
              </p>
              <div className="grid grid-cols-2 gap-4">

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={User} text="Full Name" required />
                  <input
                    {...register('name', { required: true })}
                    placeholder="e.g. Priya & Aakash"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Phone} text="Phone Number" required />
                  <input
                    {...register('primaryPhone', { required: true })}
                    placeholder="+91 00000 00000"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Mail} text="Email Address" />
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="couple@example.com"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={MapPin} text="Location" />
                  <input
                    {...register('location')}
                    placeholder="e.g. Delhi, Punjabi Bagh"
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* ── EVENT REQUIREMENTS ── */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Event Requirements
              </p>
              <div className="grid grid-cols-2 gap-4">

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Tag} text="Event Type" />
                  <select {...register('eventType')} className={inputCls}>
                    {allEventTypes.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Users} text="Guest Count" />
                  <input
                    type="number"
                    {...register('guestCount')}
                    placeholder="e.g. 450"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Wallet} text="Budget Min (₹ Lakhs)" />
                  <input
                    type="number"
                    {...register('budgetMin')}
                    placeholder="e.g. 10"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Wallet} text="Budget Max (₹ Lakhs)" />
                  <input
                    type="number"
                    {...register('budgetMax')}
                    placeholder="e.g. 20"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Calendar} text="Event Date" />
                  <input
                    type="date"
                    {...register('eventDate')}
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* ── CLASSIFICATION & ASSIGNMENT ── */}
            <section>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Classification &amp; Assignment
              </p>
              <div className="grid grid-cols-2 gap-4">

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Tag} text="Source" />
                  <select {...register('source')} className={inputCls}>
                    {allSources.map(src => (
                      <option key={src.value} value={src.value}>{src.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Star} text="Priority" />
                  <select {...register('priority')} className={inputCls}>
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={Layers} text="Pipeline Stage" />
                  <select {...register('stageId')} className={inputCls}>
                    <option value="">Auto (New Lead)</option>
                    {(stages || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label icon={UserCircle} text="Assign To" />
                  <select {...register('ownerId')} className={inputCls}>
                    <option value="">Unassigned</option>
                    {(users || []).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[14px] font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Any notes about this lead…"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── Footer buttons ── */}
          <div className="flex gap-3 px-7 py-5 border-t border-slate-100 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[15px] font-bold text-slate-700 tracking-wide uppercase transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 h-12 rounded-xl bg-[#0f1f18] hover:bg-[#1F5C45] text-white text-[15px] font-bold tracking-wide uppercase transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Creating…' : 'Create Lead'}
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
  px-4 text-[16px] font-medium text-slate-900
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
