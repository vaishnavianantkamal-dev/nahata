import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Send, Download, Pencil, Trash2, Eye, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { QuotationDrawer } from './QuotationDrawer';
import { QuotationPdfModal } from './QuotationPdfModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-slate-100 text-slate-600 border-slate-200',
  SENT:     'bg-blue-50  text-blue-700  border-blue-200',
  ACCEPTED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50   text-red-600   border-red-200',
  INVOICED: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function QuotationsPage() {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editQuote,  setEditQuote]      = useState<any>(null);
  const [pdfQuote,   setPdfQuote]       = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => api.get('/quotations?pageSize=50').then(r => r.data),
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast({ title: '🗑️ Quotation deleted' });
      setDeleteTarget(null);
    },
    onError: () => toast({ variant: 'destructive', title: 'Delete failed' }),
  });

  const markAccepted = useMutation({
    mutationFn: (id: string) => api.patch(`/quotations/${id}`, { status: 'ACCEPTED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); toast({ title: '✅ Quotation accepted!' }); },
  });

  const quotations = data?.data || [];
  const total      = data?.total || 0;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-display font-bold text-slate-900 leading-tight">Quotations</h1>
          <p className="text-[15px] text-slate-600 font-medium mt-1">
            Create, manage and send professional quotations to your clients
          </p>
        </div>
        <Button
          onClick={() => { setEditQuote(null); setDrawerOpen(true); }}
          className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-11 px-5 rounded-xl font-semibold gap-2 text-[15px]"
        >
          <Plus size={16} /> New Quotation
        </Button>
      </div>

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['DRAFT','SENT','ACCEPTED','REJECTED','INVOICED'] as const).map(status => {
            const count = quotations.filter((q: any) => q.status === status).length;
            return (
              <div key={status} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
                <p className="text-[22px] font-bold font-display text-slate-900">{count}</p>
                <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{status}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="text-left pl-5">QUOTE NO.</th>
                <th className="text-left">CLIENT</th>
                <th className="text-left">PROJECT</th>
                <th className="text-left">DATE</th>
                <th className="text-right">AMOUNT</th>
                <th className="text-left">STATUS</th>
                <th className="text-center pr-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[100, 150, 140, 90, 80, 70, 120].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && quotations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <FileText size={40} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-[18px] font-bold text-slate-800 mb-2">No quotations yet</p>
                    <p className="text-[15px] text-slate-500 mb-5">Create your first professional quotation</p>
                    <Button onClick={() => setDrawerOpen(true)}
                      className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-10 px-5 rounded-xl font-semibold gap-2">
                      <Plus size={14} /> Create Quotation
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading && quotations.map((q: any) => (
                <tr key={q.id}>
                  <td className="pl-5">
                    <span className="text-[15px] font-bold text-[#1F5C45]">{q.quoteNumber}</span>
                  </td>
                  <td>
                    <p className="text-[15px] font-bold text-slate-900">{q.clientName}</p>
                    {q.clientPhone && <p className="cell-sub">{q.clientPhone}</p>}
                  </td>
                  <td>
                    <span className="text-[14px] font-semibold text-slate-700">
                      {q.projectDetails || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="text-[14px] font-semibold text-slate-600">
                      {formatDate(q.quoteDate)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="text-[16px] font-bold text-slate-900">
                      ₹{q.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td>
                    <span className={cn('inline-block px-2.5 py-1 rounded-lg text-[12px] font-bold border', STATUS_COLORS[q.status] || STATUS_COLORS.DRAFT)}>
                      {q.status}
                    </span>
                  </td>
                  <td className="pr-4">
                    <div className="flex items-center justify-center gap-0.5">
                      {/* Edit */}
                      <button onClick={() => { setEditQuote(q); setDrawerOpen(true); }}
                        title="Edit" className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
                        <Pencil size={15} />
                      </button>
                      {/* PDF / Download */}
                      <button onClick={() => setPdfQuote(q)}
                        title="Generate PDF" className="p-2 rounded-lg text-slate-500 hover:text-[#1F5C45] hover:bg-green-50 transition-all">
                        <Download size={15} />
                      </button>
                      {/* Send WhatsApp */}
                      <button onClick={() => setPdfQuote({ ...q, _autoSend: true })}
                        title="Send via WhatsApp" className="p-2 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-all">
                        <Send size={15} />
                      </button>
                      {/* Mark Accepted */}
                      {q.status !== 'ACCEPTED' && q.status !== 'INVOICED' && (
                        <button onClick={() => markAccepted.mutate(q.id)}
                          title="Mark Accepted" className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                          <CheckCircle size={15} />
                        </button>
                      )}
                      {/* Delete */}
                      <button onClick={() => setDeleteTarget(q)}
                        title="Delete" className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quotation Drawer (create/edit) */}
      <QuotationDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditQuote(null); }}
        editData={editQuote}
      />

      {/* PDF / Send Modal */}
      {pdfQuote && (
        <QuotationPdfModal
          quotation={pdfQuote}
          onClose={() => setPdfQuote(null)}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quotation {deleteTarget?.quoteNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the quotation for <strong>{deleteTarget?.clientName}</strong>. This cannot be undone.
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
