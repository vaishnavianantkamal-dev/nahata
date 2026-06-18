import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, Eye, CheckCircle, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NewLeadModal } from './NewLeadModal';
import { EditLeadModal } from './EditLeadModal';
import api from '@/lib/api';
import {
  relativeTime, sourceLabel, sourceColor, eventTypeLabel,
  scoreBandIcon, scoreBandColor, cn,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function LeadsPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [source,    setSource]    = useState('');
  const [scoreBand, setScoreBand] = useState('');
  const [sort,      setSort]      = useState('createdAt');
  const [page,      setPage]      = useState(1);
  const [newLeadOpen,  setNewLeadOpen]  = useState(false);
  const [editLead,     setEditLead]     = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null); // lead to confirm-delete

  /* ── Query ─────────────────────────────────────────────────────────────── */
  const queryKey = ['leads', { search, source, scoreBand, sort, page }];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.get('/leads', {
        params: {
          search:    search    || undefined,
          source:    source    || undefined,
          scoreBand: scoreBand || undefined,
          sort,
          page,
          pageSize: 25,
          order: sort === 'score' ? 'desc' : 'desc',
        },
      }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  /* ── Delete mutation — uses DELETE /leads/:id (sets deletedAt) ──────────── */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onMutate: async (id: string) => {
      // Optimistic: remove the row immediately
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old: any) => old
        ? { ...old, data: old.data.filter((l: any) => l.id !== id), total: old.total - 1 }
        : old,
      );
      return { previous };
    },
    onError: (_err, _id, ctx: any) => {
      // Roll back on failure
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not remove lead — please try again.' });
    },
    onSuccess: () => {
      toast({ title: '🗑️ Lead deleted successfully' });
    },
    onSettled: () => {
      // Always refetch to sync with server
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline-board'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      setDeleteTarget(null);
    },
  });

  /* ── Won mutation ───────────────────────────────────────────────────────── */
  const wonMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leads/${id}/status`, { status: 'WON' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      toast({ title: '🎉 Lead marked as Won!' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Could not mark Won' }),
  });

  const leads = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[30px] font-display font-bold text-slate-900 leading-tight">Leads</h1>
          <p className="text-[17px] sm:text-[19px] text-slate-600 font-medium mt-1 truncate">
            {isLoading ? '…' : total} total enquiries — unified inbox
          </p>
        </div>
        <Button
          onClick={() => setNewLeadOpen(true)}
          className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-10 px-5 rounded-xl font-semibold gap-2 text-[19px]"
        >
          <Plus size={16} /> New Lead
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        <div className="relative flex-1 min-w-fit">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search…"
            className="pl-10 h-10 rounded-xl border-slate-200 text-[17px] sm:text-[19px] font-medium bg-white w-full"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={source || '_all'} onValueChange={v => { setSource(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32 sm:w-40 h-10 rounded-xl font-semibold text-[16px] sm:text-[20px] bg-white">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Sources</SelectItem>
            {['WEDMEGOOD','JUSTDIAL','GOOGLE_MAPS','WEBSITE','MANUAL','REFERRAL'].map(s => (
              <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scoreBand || '_all'} onValueChange={v => { setScoreBand(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-28 sm:w-36 h-10 rounded-xl font-semibold text-[16px] sm:text-[20px] bg-white">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Scores</SelectItem>
            <SelectItem value="HOT">🔥 Hot</SelectItem>
            <SelectItem value="WARM">🤗 Warm</SelectItem>
            <SelectItem value="COLD">❄️ Cold</SelectItem>
            <SelectItem value="UNSCORED">Unscored</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={v => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-28 sm:w-44 h-10 rounded-xl font-semibold text-[16px] sm:text-[20px] bg-white">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Newest</SelectItem>
            <SelectItem value="score">By Score</SelectItem>
            <SelectItem value="lastContactAt">Last Contact</SelectItem>
            <SelectItem value="eventDate">Event Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table>
            <thead>
              <tr>
                <th className="text-left pl-4 sm:pl-5">NAME</th>
                <th className="text-left hidden sm:table-cell">SOURCE</th>
                <th className="text-left hidden md:table-cell">FUNCTION</th>
                <th className="text-left hidden lg:table-cell">STAGE</th>
                <th className="text-left hidden xl:table-cell">SCORE</th>
                <th className="text-left hidden lg:table-cell">LAST CONTACT</th>
                <th className="text-center pr-4 sm:pr-5">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading skeletons */}
              {isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 sm:px-5 py-3 sm:py-4">
                    <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-40" />
                  </td>
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <td key={j} className="px-4 sm:px-5 py-3 sm:py-4 hidden sm:table-cell">
                      <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Empty state */}
              {!isLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="text-5xl mb-4">🌿</div>
                    <p className="text-[20px] font-bold text-slate-800 mb-2">No leads found</p>
                    <p className="text-[19px] text-slate-500 mb-6">
                      {search || source || scoreBand
                        ? 'No leads match your filters. Try clearing them.'
                        : 'Not a single lead should be missed — add your first one!'}
                    </p>
                    {!search && !source && !scoreBand && (
                      <Button
                        onClick={() => setNewLeadOpen(true)}
                        className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-10 px-6 rounded-xl font-semibold gap-2"
                      >
                        <Plus size={15} /> Add First Lead
                      </Button>
                    )}
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoading && leads.map((lead: any) => (
                <tr key={lead.id}>
                  {/* Name + phone */}
                  <td className="pl-4 sm:pl-5 pr-2 sm:pr-4">
                    <button
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="text-left group"
                    >
                      <p className="text-[16px] sm:text-[19px] font-bold text-slate-900 group-hover:text-[#1F5C45] transition-colors leading-snug truncate">
                        {lead.name}
                      </p>
                      <p className="cell-sub text-[14px] sm:text-[16px] truncate">{lead.primaryPhone}</p>
                    </button>
                  </td>

                  {/* Source badge */}
                  <td className="hidden sm:table-cell pr-2 sm:pr-4">
                    <span className={cn('inline-block px-2.5 py-1 rounded-lg text-[16px] sm:text-[20px] font-bold border whitespace-nowrap', sourceColor(lead.source))}>
                      {sourceLabel(lead.source)}
                    </span>
                  </td>

                  {/* Function */}
                  <td className="hidden md:table-cell pr-2 sm:pr-4">
                    <span className="text-[16px] sm:text-[19px] font-semibold text-slate-900 block truncate">
                      {eventTypeLabel(lead.eventType)}
                    </span>
                    {lead.guestCount && (
                      <span className="cell-sub block text-[14px] sm:text-[16px]">{lead.guestCount} pax</span>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="hidden lg:table-cell pr-2 sm:pr-4">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lead.stage?.color || '#94a3b8' }}
                      />
                      <span className="text-[16px] sm:text-[19px] font-semibold text-slate-900 truncate">{lead.stage?.name}</span>
                    </span>
                  </td>

                  {/* Score */}
                  <td className="hidden xl:table-cell pr-2 sm:pr-4">
                    {lead.scoreBand !== 'UNSCORED' ? (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[16px] sm:text-[19px] font-bold border whitespace-nowrap',
                        scoreBandColor(lead.scoreBand),
                      )}>
                        {scoreBandIcon(lead.scoreBand)} {lead.score}
                      </span>
                    ) : (
                      <span className="text-[16px] sm:text-[20px] text-slate-500 font-semibold">—</span>
                    )}
                  </td>

                  {/* Last contact */}
                  <td className="hidden lg:table-cell pr-2 sm:pr-4">
                    <span className="text-[16px] sm:text-[20px] font-semibold text-slate-700">
                      {relativeTime(lead.lastContactAt)}
                    </span>
                  </td>

                  {/* ── Actions — always visible ───────────────────────────── */}
                  <td className="pr-3 sm:pr-4">
                    <div className="flex items-center justify-center gap-0.5">

                      {/* VIEW */}
                      <button
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        title="View details"
                        className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-[#1F5C45] hover:bg-green-50 transition-all"
                      >
                        <Eye size={14} className="sm:size-4" />
                      </button>

                      {/* EDIT */}
                      <button
                        onClick={() => setEditLead(lead)}
                        title="Edit lead"
                        className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Pencil size={14} className="sm:size-4" />
                      </button>

                      {/* MARK WON */}
                      {lead.status === 'OPEN' && (
                        <button
                          onClick={() => wonMutation.mutate(lead.id)}
                          title="Mark as Won"
                          disabled={wonMutation.isPending}
                          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
                        >
                          <CheckCircle size={14} className="sm:size-4" />
                        </button>
                      )}

                      {/* DELETE → AlertDialog */}
                      <button
                        onClick={() => setDeleteTarget(lead)}
                        title="Delete lead"
                        className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={14} className="sm:size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-slate-50">
            <span className="text-[15px] sm:text-[20px] font-semibold text-slate-600">
              Showing {Math.min((page-1)*25+1, total)}–{Math.min(page*25, total)} of{' '}
              <strong className="text-slate-900">{total}</strong>
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" disabled={page===1}
                onClick={() => setPage(p => p-1)} className="h-8 sm:h-9 rounded-xl font-semibold flex-1 sm:flex-none text-[14px]">
                ← Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page*25>=total}
                onClick={() => setPage(p => p+1)} className="h-8 sm:h-9 rounded-xl font-semibold flex-1 sm:flex-none text-[14px]">
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <NewLeadModal  open={newLeadOpen}  onClose={() => setNewLeadOpen(false)} />
      <EditLeadModal open={!!editLead}   onClose={() => setEditLead(null)} lead={editLead} />

      {/* ── Delete Confirmation AlertDialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete{' '}
              <strong className="text-slate-900">{deleteTarget?.name}</strong>.
              All associated messages, calls, and activities will also be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className={deleteMutation.isPending ? 'opacity-60 pointer-events-none' : ''}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete Lead'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
