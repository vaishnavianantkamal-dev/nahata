import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, MessageSquare, Pencil, CheckCircle, Trash2, Calendar, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditLeadModal } from './EditLeadModal';
import api from '@/lib/api';
import { relativeTime, formatDate, sourceLabel, sourceColor, eventTypeLabel, scoreBandIcon, scoreBandColor, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'whatsapp' | 'calls' | 'timeline'>('overview');
  const [note, setNote] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`).then(r => r.data),
  });

  const { data: stages } = useQuery({
    queryKey: ['stages'],
    queryFn: () => api.get('/stages').then(r => r.data),
  });

  const stageMutation = useMutation({
    mutationFn: (stageId: string) => api.patch(`/leads/${id}/stage`, { stageId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead', id] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }); toast({ title: 'Stage updated & message sent!' }); },
  });

  const callMutation = useMutation({
    mutationFn: () => api.post('/calls/click-to-call', { leadId: id }),
    onSuccess: () => { toast({ title: '📞 Call initiated!', description: 'Consent message will play automatically.' }); },
    onError: (e: any) => toast({ variant: 'destructive', title: e.response?.data?.error?.message || 'Call failed' }),
  });

  const [waBody, setWaBody] = useState('');
  const waMutation = useMutation({
    mutationFn: (body: string) => api.post('/whatsapp/send', { leadId: id, body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead', id] }); setWaBody(''); toast({ title: 'WhatsApp sent ✓' }); },
  });

  const addNoteMutation = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { content: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead', id] }); setNote(''); toast({ title: 'Note added' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline-board'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      toast({ title: '🗑️ Lead deleted successfully' });
      navigate('/leads');
    },
    onError: () => toast({ variant: 'destructive', title: 'Delete failed', description: 'Please try again.' }),
    onSettled: () => setConfirmDelete(false),
  });

  const wonMutation = useMutation({
    mutationFn: () => api.patch(`/leads/${id}/status`, { status: 'WON' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead', id] }); toast({ title: '🎉 Lead marked as Won!' }); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>;
  if (!lead) return <div className="text-slate-600">Lead not found</div>;

  const latestScore = lead.scoreEvents?.[0];

  return (
    <>
    <div className="px-6 lg:px-8 py-6 space-y-4">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Lead header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-display font-bold text-slate-800">{lead.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', sourceColor(lead.source))}>
                {sourceLabel(lead.source)}
              </span>
              <span className="text-sm text-slate-500">{lead.primaryPhone}</span>
              {lead.email && <span className="text-sm text-slate-500">{lead.email}</span>}
              {lead.scoreBand !== 'UNSCORED' && (
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', scoreBandColor(lead.scoreBand))}>
                  {scoreBandIcon(lead.scoreBand)} {lead.score}/100
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Calendar size={13} /> {lead.eventDate ? formatDate(lead.eventDate) : 'Date TBD'}</span>
              <span className="flex items-center gap-1"><Users size={13} /> {lead.guestCount ? `${lead.guestCount} guests` : 'Guests TBD'}</span>
              <span className="flex items-center gap-1"><MapPin size={13} /> {eventTypeLabel(lead.eventType)}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => callMutation.mutate()} disabled={callMutation.isPending}
              className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-9 px-4 rounded-xl font-semibold gap-1.5">
              <Phone size={14} /> Call
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTab('whatsapp')}
              className="h-9 px-4 rounded-xl font-semibold gap-1.5 border-slate-300">
              <MessageSquare size={14} /> WhatsApp
            </Button>
            {/* ── EDIT ── */}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}
              className="h-9 px-4 rounded-xl font-semibold gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
              <Pencil size={14} /> Edit
            </Button>
            {/* ── MARK WON ── */}
            {lead.status === 'OPEN' && (
              <Button size="sm" variant="outline" onClick={() => wonMutation.mutate()}
                className="h-9 px-4 rounded-xl font-semibold gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <CheckCircle size={14} /> Mark Won
              </Button>
            )}
            {/* ── DELETE → AlertDialog ── */}
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}
              className="h-9 px-4 rounded-xl font-semibold gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </Button>

            {/* Stage mover */}
            <Select value={lead.stageId} onValueChange={stageMutation.mutate}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(stages || []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-slate-100">
          {['overview','whatsapp','calls','timeline'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={cn('px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize',
                tab === t ? 'border-evergreen-700 text-evergreen-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact & Event</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ['Name', lead.name],
                ['Phone', lead.primaryPhone],
                ['Email', lead.email || '—'],
                ['Event', eventTypeLabel(lead.eventType)],
                ['Guests', lead.guestCount || '—'],
                ['Event Date', lead.eventDate ? formatDate(lead.eventDate) : '—'],
                ['Budget', lead.budgetMin || lead.budgetMax ? `₹${lead.budgetMin?.toLocaleString('en-IN') || '?'} – ₹${lead.budgetMax?.toLocaleString('en-IN') || '?'}` : '—'],
                ['Last Contact', relativeTime(lead.lastContactAt)],
                ['Owner', lead.owner?.name || 'Unassigned'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-2">
                  <span className="text-slate-600 w-28 shrink-0">{k}</span>
                  <span className="text-slate-700 font-medium">{v as string}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {latestScore && (
            <Card className="border-l-4" style={{ borderLeftColor: latestScore.band === 'HOT' ? '#ef4444' : latestScore.band === 'WARM' ? '#f59e0b' : '#3b82f6' }}>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2">AI Lead Score {scoreBandIcon(latestScore.band)} {latestScore.score}/100</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lead.calls?.[0]?.summary && (
                  <div>
                    <p className="text-slate-500 mb-1 text-xs font-medium uppercase tracking-wide">AI Summary</p>
                    <p className="text-slate-700 leading-relaxed">{lead.calls[0].summary.summary}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 mb-1 text-xs font-medium uppercase tracking-wide">Suggested Next Action</p>
                  <p className="text-evergreen-700 font-medium">{latestScore.suggestedAction}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1 text-xs font-medium uppercase tracking-wide">Rationale</p>
                  <p className="text-slate-600 text-xs">{latestScore.rationale}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {lead.notes && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-700">{lead.notes}</p></CardContent>
            </Card>
          )}

          {/* Add note */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">Add Note</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note about this lead…"
                className="w-full rounded-lg border border-slate-200 p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-evergreen-700"
              />
              <Button size="sm" disabled={!note.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate()}>
                Save Note
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'whatsapp' && (
        <Card>
          <CardHeader><CardTitle className="text-sm">WhatsApp Conversation</CardTitle></CardHeader>
          <CardContent>
            <div className="px-6 lg:px-8 py-6 space-y-3 max-h-96 overflow-y-auto mb-4">
              {(lead.messages || []).map((msg: any) => (
                <div key={msg.id} className={cn('flex', msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-xs px-3 py-2 rounded-xl text-sm', msg.direction === 'OUTBOUND' ? 'bg-evergreen-700 text-white' : 'bg-slate-100 text-slate-800')}>
                    <p>{msg.body}</p>
                    <p className={cn('text-xs mt-1 opacity-70 text-right')}>{relativeTime(msg.sentAt || msg.createdAt)} {msg.direction === 'OUTBOUND' && (msg.status === 'READ' ? '✓✓' : msg.status === 'DELIVERED' ? '✓✓' : '✓')}</p>
                  </div>
                </div>
              ))}
              {lead.messages?.length === 0 && <p className="text-slate-600 text-sm text-center py-8">No messages yet</p>}
            </div>

            <div className="flex gap-2">
              <textarea
                value={waBody}
                onChange={e => setWaBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-evergreen-700"
                rows={2}
              />
              <Button
                size="sm"
                disabled={!waBody.trim() || waMutation.isPending}
                onClick={() => waMutation.mutate(waBody)}
              >
                {waMutation.isPending ? '…' : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'calls' && (
        <div className="px-6 lg:px-8 py-6 space-y-3">
          <Button size="sm" onClick={() => callMutation.mutate()} disabled={callMutation.isPending}>
            <Phone size={14} /> Start Call
          </Button>
          {(lead.calls || []).map((call: any) => (
            <Card key={call.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', call.direction === 'INBOUND' ? 'bg-blue-500' : 'bg-evergreen-500')} />
                    <span className="text-sm font-medium">{call.direction} · {call.status}</span>
                    <span className="text-xs text-slate-600">{call.durationSec ? `${Math.floor(call.durationSec/60)}m ${call.durationSec%60}s` : ''}</span>
                  </div>
                  <span className="text-xs text-slate-600">{relativeTime(call.createdAt)}</span>
                </div>
                {call.summary && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Summary</p>
                    <p className="text-sm text-slate-700">{call.summary.summary}</p>
                    <p className="text-xs text-evergreen-700 font-medium mt-1">➤ {call.summary.nextAction}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <Card>
          <CardContent className="p-4">
            <div className="px-6 lg:px-8 py-6 space-y-4">
              {(lead.activities || []).map((act: any) => (
                <div key={act.id} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-evergreen-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{act.title}</p>
                    {act.description && <p className="text-xs text-slate-500 mt-0.5">{act.description}</p>}
                    <p className="text-xs text-slate-600 mt-0.5">{act.user?.name || 'System'} · {relativeTime(act.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    <EditLeadModal open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />

    <AlertDialog open={confirmDelete} onOpenChange={open => !open && setConfirmDelete(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to permanently delete{' '}
            <strong className="text-slate-900">{lead?.name}</strong>.
            All messages, calls, notes and activity history will be removed.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmDelete(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            className={deleteMutation.isPending ? 'opacity-60 pointer-events-none' : ''}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete Lead'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
