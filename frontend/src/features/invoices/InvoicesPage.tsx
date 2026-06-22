import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, FileText, Receipt, TrendingUp, AlertCircle, Eye,
} from 'lucide-react';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InvoiceModal } from './InvoiceModal';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  UNPAID: 'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
};
const fmtINR = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export function InvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data),
    refetchInterval: 30_000,
  });

  const invoices: any[] = data?.data || [];
  const summary = data?.summary || { count: 0, totalBilled: 0, totalReceived: 0, totalOutstanding: 0, paidCount: 0 };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-display font-bold text-slate-900 leading-tight">Invoices</h1>
          <p className="text-[15px] text-slate-600 font-medium mt-1">Proforma &amp; GST tax invoices with CGST/SGST and payment tracking</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-11 px-5 rounded-xl font-semibold gap-2 text-[15px]">
          <Plus size={16} /> New Invoice
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Receipt} label="Billed" value={fmtINR(summary.totalBilled)} sub={`${summary.count} invoices`} tone="slate" />
        <Stat icon={TrendingUp} label="Received" value={fmtINR(summary.totalReceived)} sub={`${summary.paidCount} paid`} tone="emerald" />
        <Stat icon={AlertCircle} label="Outstanding" value={fmtINR(summary.totalOutstanding)} sub="balance due" tone="red" />
        <Stat icon={FileText} label="Collection" value={`${summary.totalBilled > 0 ? Math.round((summary.totalReceived / summary.totalBilled) * 100) : 0}%`} sub="of billed" tone="green" />
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
                <th className="text-right">BALANCE</th>
                <th className="text-left">STATUS</th>
                <th className="text-center pr-4">VIEW</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(4)].map((_, i) => (
                <tr key={i}>{[120, 150, 90, 90, 90, 80, 50].map((w, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} /></td>
                ))}</tr>
              ))}

              {!isLoading && invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Receipt size={40} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-[18px] font-bold text-slate-800 mb-2">No invoices yet</p>
                    <p className="text-[15px] text-slate-500 mb-5">Generate a proforma or tax invoice from a quotation</p>
                    <Button onClick={() => setCreateOpen(true)} className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-10 px-5 rounded-xl font-semibold gap-2">
                      <Plus size={14} /> Create Invoice
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading && invoices.map((inv: any) => (
                <tr key={inv.id} className="cursor-pointer" onClick={() => setDetailId(inv.id)}>
                  <td className="pl-5"><span className="text-[15px] font-bold text-[#1F5C45]">{inv.invoiceNumber}</span></td>
                  <td><p className="text-[15px] font-bold text-slate-900">{inv.clientName}</p>{inv.clientGstin && <p className="cell-sub">{inv.clientGstin}</p>}</td>
                  <td><span className="text-[14px] font-semibold text-slate-600">{formatDate(inv.issueDate)}</span></td>
                  <td className="text-right"><span className="text-[15px] font-bold text-slate-900">{fmtINR(inv.grandTotal)}</span></td>
                  <td className="text-right"><span className={cn('text-[15px] font-bold', inv.balance > 0 ? 'text-red-600' : 'text-emerald-700')}>{fmtINR(inv.balance)}</span></td>
                  <td><span className={cn('inline-block px-2.5 py-1 rounded-lg text-[12px] font-bold border', STATUS_BADGE[inv.status])}>{inv.status}</span></td>
                  <td className="pr-4 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setDetailId(inv.id); }} className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <InvoiceDetailDrawer open={!!detailId} onClose={() => setDetailId(null)} invoiceId={detailId} />
    </div>
  );
}

const TONES: Record<string, string> = {
  slate: 'text-slate-600 bg-slate-100', emerald: 'text-emerald-600 bg-emerald-50',
  red: 'text-red-600 bg-red-50', green: 'text-[#1F5C45] bg-green-50',
};
function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub: string; tone: string }) {
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
