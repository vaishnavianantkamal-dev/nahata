import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday, parseISO,
} from 'date-fns';
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock,
  CircleDollarSign, Sparkles, Pencil, Trash2, Users, MapPin,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn, eventTypeLabel } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { BookingModal } from './BookingModal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: 'bg-[#1F5C45] text-white',
  TENTATIVE: 'bg-amber-100 text-amber-800 border border-amber-300',
  CANCELLED: 'bg-slate-100 text-slate-400 line-through',
};
const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TENTATIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function BookingsPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const ym = format(cursor, 'yyyy-MM');

  const { data, isLoading } = useQuery({
    queryKey: ['bookings-calendar', ym],
    queryFn: () => api.get(`/bookings/calendar?month=${ym}`).then(r => r.data),
    refetchInterval: 30_000,
  });

  const bookings: any[] = data?.bookings || [];
  const enquiries: any[] = data?.enquiries || [];

  // Group by day for fast cell lookup
  const { bookingsByDay, enquiriesByDay } = useMemo(() => {
    const b: Record<string, any[]> = {};
    const e: Record<string, any[]> = {};
    for (const bk of bookings) (b[bk.eventDate] ||= []).push(bk);
    for (const eq of enquiries) (e[eq.eventDate] ||= []).push(eq);
    return { bookingsByDay: b, enquiriesByDay: e };
  }, [bookings, enquiries]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  // Stats for the visible month
  const stats = useMemo(() => {
    const confirmed = bookings.filter(b => b.status === 'CONFIRMED');
    const tentative = bookings.filter(b => b.status === 'TENTATIVE');
    const value = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);
    return { confirmed: confirmed.length, tentative: tentative.length, value, enquiries: enquiries.length };
  }, [bookings, enquiries]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings-calendar'] });
      toast({ title: '🗑️ Booking deleted' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({
      variant: 'destructive', title: 'Delete failed',
      description: e.response?.data?.error?.message || 'Only owners and managers can delete bookings.',
    }),
  });

  const openCreate = (date?: string) => { setEditBooking(null); setDefaultDate(date || selected); setModalOpen(true); };
  const openEdit = (b: any) => { setEditBooking(b); setDefaultDate(null); setModalOpen(true); };

  const selectedBookings = (bookingsByDay[selected] || []);
  const selectedEnquiries = (enquiriesByDay[selected] || []);
  const selectedConfirmed = selectedBookings.filter(b => b.status === 'CONFIRMED');

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-display font-bold text-slate-900 leading-tight">Bookings &amp; Availability</h1>
          <p className="text-[15px] text-slate-600 font-medium mt-1">
            See what's booked, spot free dates, and never double-book the lawn
          </p>
        </div>
        <Button onClick={() => openCreate()}
          className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-11 px-5 rounded-xl font-semibold gap-2 text-[15px]">
          <Plus size={16} /> New Booking
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label="Confirmed" value={stats.confirmed} tone="emerald" />
        <StatCard icon={Clock} label="Tentative" value={stats.tentative} tone="amber" />
        <StatCard icon={CircleDollarSign} label="Confirmed Value"
          value={`₹${stats.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} tone="green" />
        <StatCard icon={Sparkles} label="Enquiry Dates" value={stats.enquiries} tone="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-[18px] font-display font-bold text-slate-900">{format(cursor, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setCursor(c => subMonths(c, 1))}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={() => { setCursor(startOfMonth(new Date())); setSelected(format(new Date(), 'yyyy-MM-dd')); }}
                className="px-3 py-1.5 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">Today</button>
              <button onClick={() => setCursor(c => addMonths(c, 1))}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map(d => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursor);
              const dayBookings = bookingsByDay[key] || [];
              const dayEnquiries = enquiriesByDay[key] || [];
              const hasConfirmed = dayBookings.some(b => b.status === 'CONFIRMED');
              const isSelected = key === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    'min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors relative',
                    inMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 text-slate-300',
                    isSelected && 'ring-2 ring-inset ring-[#1F5C45] bg-emerald-50/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold',
                      isToday(day) ? 'bg-[#C9A24B] text-white' : inMonth ? 'text-slate-700' : 'text-slate-300',
                    )}>{format(day, 'd')}</span>
                    {hasConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C45]" />}
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 2).map(b => (
                      <div key={b.id} className={cn('truncate rounded px-1.5 py-0.5 text-[10px] font-bold', STATUS_PILL[b.status])}>
                        {b.startTime ? `${b.startTime} ` : ''}{b.title}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <div className="text-[10px] font-bold text-slate-400 px-1">+{dayBookings.length - 2} more</div>
                    )}
                    {dayEnquiries.length > 0 && (
                      <div className="flex items-center gap-1 px-1 text-[10px] font-semibold text-blue-500">
                        <Sparkles size={9} /> {dayEnquiries.length} enquir{dayEnquiries.length > 1 ? 'ies' : 'y'}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {isLoading && <div className="px-5 py-3 text-[13px] text-slate-400 font-medium">Loading bookings…</div>}
        </div>

        {/* Day panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Selected date</p>
              <h3 className="text-[17px] font-display font-bold text-slate-900">
                {format(parseISO(selected), 'EEE, dd MMM yyyy')}
              </h3>
            </div>
            <span className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-bold border',
              selectedConfirmed.length === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200',
            )}>
              {selectedConfirmed.length === 0 ? 'Available' : 'Booked'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 max-h-[520px]">
            {selectedBookings.length === 0 && selectedEnquiries.length === 0 && (
              <div className="text-center py-10">
                <CalendarDays size={36} className="text-slate-200 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-slate-500">Nothing on this date</p>
                <p className="text-[13px] text-slate-400 mt-1">This date is free to book</p>
              </div>
            )}

            {selectedBookings.map(b => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 truncate">{b.title}</p>
                    <p className="text-[13px] text-slate-500 font-medium">{b.clientName}{b.clientPhone ? ` · ${b.clientPhone}` : ''}</p>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border flex-shrink-0', STATUS_BADGE[b.status])}>
                    {b.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin size={12} />{b.venue}</span>
                  <span>{eventTypeLabel(b.eventType)}</span>
                  {(b.startTime || b.endTime) && (
                    <span className="inline-flex items-center gap-1"><Clock size={12} />{b.startTime || '—'}{b.endTime ? `–${b.endTime}` : ''}</span>
                  )}
                  {b.guestCount != null && <span className="inline-flex items-center gap-1"><Users size={12} />{b.guestCount}</span>}
                  {b.amount != null && <span className="text-slate-700">₹{Number(b.amount).toLocaleString('en-IN')}</span>}
                </div>
                <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-slate-100">
                  <button onClick={() => openEdit(b)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(b)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {selectedEnquiries.length > 0 && (
              <div className="pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-400 mb-2 flex items-center gap-1">
                  <Sparkles size={11} /> Enquiries on this date
                </p>
                <div className="space-y-1.5">
                  {selectedEnquiries.map(eq => (
                    <div key={eq.id} className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2">
                      <p className="text-[13px] font-bold text-slate-800">{eq.name}</p>
                      <p className="text-[12px] text-slate-500 font-medium">{eventTypeLabel(eq.eventType)} · enquiry (not yet booked)</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100">
            <Button onClick={() => openCreate(selected)}
              className="w-full bg-[#0f1f18] hover:bg-[#1F5C45] text-white h-11 rounded-xl font-semibold gap-2">
              <Plus size={16} /> Book this date
            </Button>
          </div>
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditBooking(null); }}
        editData={editBooking}
        defaultDate={defaultDate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the booking for <strong>{deleteTarget?.clientName}</strong> on {deleteTarget && format(parseISO(deleteTarget.eventDate), 'dd MMM yyyy')}. This frees the date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  green: 'text-[#1F5C45] bg-green-50',
  blue: 'text-blue-600 bg-blue-50',
};

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: any; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', TONES[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[20px] font-bold font-display text-slate-900 leading-tight truncate">{value}</p>
        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}
