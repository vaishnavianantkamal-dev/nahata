import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Plus, Wallet, TrendingUp, AlertCircle, Receipt, Eye, Send, CircleDollarSign,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InvoicePaymentModal } from './InvoicePaymentModal';
import { InvoiceDetailDrawer } from '@/features/invoices/InvoiceDetailDrawer';

const STATUS_BADGE: Record<string, string> = {
  PAID:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  UNPAID:  'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
};
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

type TabKey = 'OUTSTANDING' | 'ALL' | 'PAID';

export function PaymentsPage() {
  const [payOpen, setPayOpen] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('OUTSTANDING');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data),
    refetchInterval: 30_000,
  });

  const summary = data?.summary || { totalBilled: 0, totalReceived: 0, totalOutstanding: 0, count: 0, paidCount: 0 };
  const allInvoices: any[] = data?.data || [];

  const rows = useMemo(() => {
    const active = allInvoices.filter(i => i.status !== 'CANCELLED');
    if (tab === 'OUTSTANDING') return active.filter(i => i.balance > 0);
    if (tab === 'PAID') return active.filter(i => i.status === 'PAID');
    return active;
  }, [allInvoices, tab]);

  const reminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/send-whatsapp`),
    onSuccess: (res) => toast({ title: '✅ Reminder sent', description: res.data.message }),
    onError: (e: any) => toast({ variant: 'destructive', title: 'Could not send reminder', description: e.response?.data?.error?.message || 'Check the client phone number.' }),
  });

  const openRecord = (invoiceId?: string) => { setPayFor(invoiceId || null); setPayOpen(true); };
  const collectionPct = summary.totalBilled > 0 ? Math.round((summary.totalReceived / summary.totalBilled) * 100) : 0;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-display font-bold text-slate-900 leading-tight">Payments &amp; Collections</h1>
          <p className="text-[15px] text-slate-600 font-medium mt-1">Track advances, balance due and revenue received against invoices</p>
        </div>
        <Button onClick={() => openRecord()} className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-11 px-5 rounded-xl font-semibold gap-2 text-[15px]">
          <Plus size={16} /> Record Payment
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Receipt} label="Invoiced" value={fmtINR(summary.totalBilled)} sub={`${summary.count} invoices`} tone="slate" />
        <StatCard icon={TrendingUp} label="Received" value={fmtINR(summary.totalReceived)} sub={`${summary.paidCount} fully paid`} tone="emerald" />
        <StatCard icon={AlertCircle} label="Outstanding" value={fmtINR(summary.totalOutstanding)} sub="balance due" tone="red" />
        <StatCard icon={CircleDollarSign} label="Collection" value={`${collectionPct}%`} sub="of invoiced" tone="green" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {([['OUTSTANDING', 'Outstanding'], ['ALL', 'All'], ['PAID', 'Paid']] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setTab(val)}
            className={cn('px-4 py-2 rounded-xl text-[14px] font-bold transition-all', tab === val ? 'bg-[#1F5C45] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300')}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="text-left pl-5">INVOICE NO.</th>
                <th className="text-left">CLIENT</th>
                <th className="text-left">DATE</th>
                <th className="text-right">TOTAL</th>
                <th className="text-right">RECEIVED</th>
                <th className="text-right">BALANCE</th>
                <th className="text-left">STATUS</th>
                <th className="text-center pr-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(4)].map((_, i) => (
                <tr key={i}>{[120, 150, 90, 90, 90, 90, 80, 110].map((w, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} /></td>
                ))}</tr>
              ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Wallet size={40} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-[18px] font-bold text-slate-800 mb-2">
                      {tab === 'OUTSTANDING' ? 'No outstanding balances' : 'No invoices yet'}
                    </p>
                    <p className="text-[15px] text-slate-500 mb-5">
                      {tab === 'OUTSTANDING' ? 'Everything billed has been collected 🎉' : 'Create an invoice to start tracking payments'}
                    </p>
                    <Button onClick={() => openRecord()} className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-10 px-5 rounded-xl font-semibold gap-2">
                      <Plus size={14} /> Record Payment
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading && rows.map((inv: any) => (
                <tr key={inv.id} className="cursor-pointer" onClick={() => setDetailId(inv.id)}>
                  <td className="pl-5"><span className="text-[15px] font-bold text-[#1F5C45]">{inv.invoiceNumber}</span></td>
                  <td>
                    <p className="text-[15px] font-bold text-slate-900">{inv.clientName}</p>
                    {inv.payments?.length > 0 && <p className="cell-sub">last paid {formatDate(inv.payments[inv.payments.length - 1].paidOn)}</p>}
                  </td>
                  <td><span className="text-[14px] font-semibold text-slate-600">{formatDate(inv.issueDate)}</span></td>
                  <td className="text-right"><span className="text-[15px] font-bold text-slate-900">{fmtINR(inv.grandTotal)}</span></td>
                  <td className="text-right"><span className="text-[15px] font-semibold text-emerald-700">{fmtINR(inv.totalPaid)}</span></td>
                  <td className="text-right"><span className={cn('text-[15px] font-bold', inv.balance > 0 ? 'text-red-600' : 'text-emerald-700')}>{fmtINR(inv.balance)}</span></td>
                  <td><span className={cn('inline-block px-2.5 py-1 rounded-lg text-[12px] font-bold border', STATUS_BADGE[inv.status])}>{inv.status}</span></td>
                  <td className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-0.5">
                      {inv.balance > 0 && (
                        <button onClick={() => openRecord(inv.id)} title="Record payment" className="p-2 rounded-lg text-slate-500 hover:text-[#1F5C45] hover:bg-green-50 transition-all"><Plus size={15} /></button>
                      )}
                      <button onClick={() => setDetailId(inv.id)} title="View ledger" className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"><Eye size={15} /></button>
                      {inv.balance > 0 && inv.clientPhone && (
                        <button onClick={() => reminderMutation.mutate(inv.id)} disabled={reminderMutation.isPending}
                          title="Send balance reminder (WhatsApp)" className="p-2 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-50"><Send size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InvoicePaymentModal open={payOpen} onClose={() => { setPayOpen(false); setPayFor(null); }} invoiceId={payFor} />
      <InvoiceDetailDrawer open={!!detailId} onClose={() => setDetailId(null)} invoiceId={detailId} />
    </div>
  );
}

const TONES: Record<string, string> = {
  slate: 'text-slate-600 bg-slate-100', emerald: 'text-emerald-600 bg-emerald-50',
  red: 'text-red-600 bg-red-50', green: 'text-[#1F5C45] bg-green-50',
};
function StatCard({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', TONES[tone])}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-[19px] font-bold font-display text-slate-900 leading-tight truncate">{value}</p>
        <p className="text-[12px] font-semibold text-slate-500">{label} · <span className="text-slate-400">{sub}</span></p>
      </div>
    </div>
  );
}
