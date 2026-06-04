import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Users, Repeat2, Building2, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, GripVertical, LayoutList, Lock, Check, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCmsLists, BASE_EVENT_TYPES, BASE_SOURCES } from '@/hooks/use-cms-lists';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Quotation defaults card ───────────────────────────────────────────────────
function QuotationDefaultsCard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then(r => r.data) });

  const [validityDays,   setValidityDays]   = useState<number>(15);
  const [advancePct,     setAdvancePct]     = useState<number>(50);
  const [defaultGst,     setDefaultGst]     = useState<number>(0);
  const [defaultTerms,   setDefaultTerms]   = useState('');
  const [units,          setUnits]          = useState<string[]>(['Sq.ft','Sq.m','Rft','Nos','Set','Lot','Kg','Box','Day']);
  const [newUnit,        setNewUnit]        = useState('');
  const [saving,         setSaving]         = useState(false);
  const [initialized,    setInitialized]    = useState(false);

  // Pre-fill from settings
  React.useEffect(() => {
    if (settings && !initialized) {
      setValidityDays(settings.quotationDefaultValidity   ?? 15);
      setAdvancePct  (settings.quotationDefaultAdvance    ?? 50);
      setDefaultGst  (settings.quotationDefaultGst        ?? 0);
      setDefaultTerms(settings.quotationDefaultTerms      ?? '');
      if (settings.quotationUnits?.length) setUnits(settings.quotationUnits);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put('/settings/quotationDefaultValidity', { value: validityDays }),
        api.put('/settings/quotationDefaultAdvance',  { value: advancePct }),
        api.put('/settings/quotationDefaultGst',      { value: defaultGst }),
        api.put('/settings/quotationDefaultTerms',    { value: defaultTerms }),
        api.put('/settings/quotationUnits',           { value: units }),
      ]);
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: '✅ Quotation defaults saved' });
    } catch { toast({ variant: 'destructive', title: 'Save failed' }); }
    setSaving(false);
  };

  const addUnit = () => {
    if (!newUnit.trim() || units.includes(newUnit.trim())) return;
    setUnits(u => [...u, newUnit.trim()]);
    setNewUnit('');
  };

  const inp = 'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1F5C45]/10 flex items-center justify-center">
            <ClipboardList size={18} className="text-[#1F5C45]" />
          </div>
          <h2 className="text-[18px] font-display font-bold text-slate-900">Quotation Defaults</h2>
        </div>
        <button onClick={saveAll} disabled={saving}
          className="flex items-center gap-1.5 bg-[#1F5C45] hover:bg-[#143d2e] text-white text-[14px] font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
          <Check size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="p-6 space-y-5">

        {/* Numeric defaults */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[13px] font-bold text-slate-600 mb-1.5">Default Validity (days)</label>
            <input type="number" value={validityDays} onChange={e => setValidityDays(+e.target.value)} className={inp} min={1} max={365} />
            <p className="text-[12px] text-slate-400 mt-1">Pre-filled in every new quotation</p>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-slate-600 mb-1.5">Default Advance Required (%)</label>
            <input type="number" value={advancePct} onChange={e => setAdvancePct(+e.target.value)} className={inp} min={0} max={100} />
            <p className="text-[12px] text-slate-400 mt-1">Shown in PDF and calculations</p>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-slate-600 mb-1.5">Default GST (%)</label>
            <input type="number" value={defaultGst} onChange={e => setDefaultGst(+e.target.value)} className={inp} min={0} max={28} />
            <p className="text-[12px] text-slate-400 mt-1">Common values: 0%, 5%, 12%, 18%</p>
          </div>
        </div>

        {/* Default terms */}
        <div>
          <label className="block text-[13px] font-bold text-slate-600 mb-1.5">Default Terms & Conditions</label>
          <textarea
            value={defaultTerms}
            onChange={e => setDefaultTerms(e.target.value)}
            rows={4}
            placeholder="e.g. 50% advance required to confirm booking. Balance due 7 days before event. Cancellation charges apply..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45] resize-none"
          />
          <p className="text-[12px] text-slate-400 mt-1">This text will be pre-filled in the Terms field of every new quotation</p>
        </div>

        {/* Units management */}
        <div>
          <label className="block text-[13px] font-bold text-slate-600 mb-2">Measurement Units</label>
          <p className="text-[13px] text-slate-400 mb-3">These units appear in the quotation item table (Length, Width, Area dropdowns)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {units.map(u => (
              <div key={u} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-[14px] font-semibold text-slate-700">{u}</span>
                <button onClick={() => setUnits(prev => prev.filter(x => x !== u))}
                  className="text-slate-400 hover:text-red-500 transition-colors ml-1">
                  <XCircle size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addUnit(); }}
              placeholder="e.g. Ltr, Kg, Pair, Trip..."
              className="flex-1 h-10 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:border-transparent focus:bg-white transition-all"
            />
            <button onClick={addUnit} disabled={!newUnit.trim()}
              className="px-4 h-10 bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-[14px] font-bold disabled:opacity-40 transition-colors">
              + Add Unit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need React import for useEffect in sub-component
import React from 'react';

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, action, children }: {
  icon: React.ElementType; title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1F5C45]/10 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-[#1F5C45]" />
          </div>
          <h2 className="text-[20px] font-display font-bold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Stage color picker swatches ───────────────────────────────────────────────
const STAGE_COLORS = [
  '#64748b','#0ea5e9','#8b5cf6','#f59e0b','#ec4899','#16a34a',
  '#ef4444','#f97316','#06b6d4','#84cc16','#1F5C45','#C9A24B',
];

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const qc = useQueryClient();

  // ── State for dialogs ──
  const [addStageOpen,   setAddStageOpen]   = useState(false);
  const [editStage,      setEditStage]      = useState<any>(null);
  const [deleteStageTarget, setDeleteStageTarget] = useState<any>(null);
  const [addUserOpen,    setAddUserOpen]    = useState(false);
  const [editUser,       setEditUser]       = useState<any>(null);
  const [editVenueOpen,  setEditVenueOpen]  = useState(false);

  // Stage form state
  const [stageName,  setStageName]  = useState('');
  const [stageColor, setStageColor] = useState('#64748b');

  // User form state
  const [userName,  setUserName]  = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRole,  setUserRole]  = useState('AGENT');
  const [userPass,  setUserPass]  = useState('');

  // Venue form state
  const [venueName, setVenueName] = useState('');

  // ── Queries ──
  const { data: settings } = useQuery({ queryKey: ['settings'],  queryFn: () => api.get('/settings').then(r => r.data) });
  const { data: stages }   = useQuery({ queryKey: ['stages'],    queryFn: () => api.get('/stages').then(r => r.data) });
  const { data: users }    = useQuery({ queryKey: ['users'],     queryFn: () => api.get('/users').then(r => r.data) });
  const { data: sequences }= useQuery({ queryKey: ['sequences'], queryFn: () => api.get('/sequences').then(r => r.data) });

  // ── Stage mutations ──
  const createStage = useMutation({
    mutationFn: () => api.post('/stages', { name: stageName, color: stageColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stages'] });
      toast({ title: '✅ Stage added' });
      setStageName(''); setStageColor('#64748b'); setAddStageOpen(false);
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add stage' }),
  });

  const updateStage = useMutation({
    mutationFn: () => api.patch(`/stages/${editStage?.id}`, { name: stageName, color: stageColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stages'] });
      toast({ title: '✅ Stage updated' });
      setEditStage(null);
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update stage' }),
  });

  const deleteStage = useMutation({
    mutationFn: (id: string) => api.delete(`/stages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stages'] });
      toast({ title: '🗑️ Stage removed' });
      setDeleteStageTarget(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.response?.data?.error?.message || 'Cannot remove stage — reassign leads first' }),
  });

  // ── User mutations ──
  const createUser = useMutation({
    mutationFn: () => api.post('/users', { name: userName, email: userEmail, phone: userPhone, role: userRole, password: userPass }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: '✅ Team member added' });
      setUserName(''); setUserEmail(''); setUserPhone(''); setUserRole('AGENT'); setUserPass('');
      setAddUserOpen(false);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.response?.data?.error?.message || 'Failed to add member' }),
  });

  const updateUserRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: '✅ Role updated' }); setEditUser(null); },
  });

  const deactivateUser = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}`, { isActive: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Member deactivated' }); },
  });

  // ── Venue settings mutation ──
  const updateVenue = useMutation({
    mutationFn: () => api.put('/settings/venueName', { value: venueName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast({ title: '✅ Venue name saved' }); setEditVenueOpen(false); },
  });

  // ── Role color helper ──
  const roleColors: Record<string, string> = {
    OWNER:   'bg-[#1F5C45]/10 text-[#1F5C45] border border-[#1F5C45]/30',
    MANAGER: 'bg-blue-50 text-blue-700 border border-blue-200',
    AGENT:   'bg-slate-100 text-slate-600 border border-slate-200',
  };

  // CMS lists
  const cms = useCmsLists();
  const [newEventType, setNewEventType] = useState('');
  const [newSource,    setNewSource]    = useState('');
  const [editingET,    setEditingET]    = useState<string | null>(null);
  const [editingETVal, setEditingETVal] = useState('');
  const [editingSrc,   setEditingSrc]   = useState<string | null>(null);
  const [editingSrcVal,setEditingSrcVal]= useState('');

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-3xl">

      {/* Page header */}
      <div>
        <h1 className="text-[30px] font-display font-bold text-slate-900 leading-tight">Settings</h1>
        <p className="text-[19px] text-slate-600 font-medium mt-1">
          Manage stages, team members, sequences and venue details
        </p>
      </div>

      {/* ══ PIPELINE STAGES ══════════════════════════════════════════════════ */}
      <SectionCard
        icon={Layers}
        title="Pipeline Stages"
        action={
          <Button
            size="sm"
            onClick={() => { setStageName(''); setStageColor('#64748b'); setAddStageOpen(true); }}
            className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-9 px-4 rounded-xl font-semibold gap-1.5 text-[20px]"
          >
            <Plus size={14} /> Add Stage
          </Button>
        }
      >
        <div className="space-y-2.5">
          {(stages || []).map((s: any) => (
            <div key={s.id}
              className="flex items-center gap-4 px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 group transition-colors"
            >
              <GripVertical size={16} className="text-slate-300 flex-shrink-0 cursor-grab" />
              <span className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm ring-2 ring-white" style={{ backgroundColor: s.color }} />
              <span className="text-[20px] font-semibold text-slate-900 flex-1">{s.name}</span>
              <span className="text-[20px] font-semibold text-slate-500">{s.leadCount ?? 0} leads</span>
              {s.isWon  && <span className="text-[19px] font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">Won ✓</span>}
              {s.isLost && <span className="text-[19px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">Lost</span>}

              {/* Edit + Delete */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditStage(s); setStageName(s.name); setStageColor(s.color); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  title="Edit stage"
                >
                  <Pencil size={14} />
                </button>
                {!s.isWon && !s.isLost && !s.isDefault && (
                  <button
                    onClick={() => setDeleteStageTarget(s)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Remove stage"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[19px] text-slate-500 font-medium mt-4 pl-1">
          💡 Drag-to-reorder is available on the Pipeline Kanban board. Hover a row to edit or remove it.
        </p>
      </SectionCard>

      {/* ══ TEAM MEMBERS ═════════════════════════════════════════════════════ */}
      <SectionCard
        icon={Users}
        title="Team Members"
        action={
          <Button
            size="sm"
            onClick={() => { setUserName(''); setUserEmail(''); setUserPhone(''); setUserRole('AGENT'); setUserPass(''); setAddUserOpen(true); }}
            className="bg-[#1F5C45] hover:bg-[#143d2e] text-white h-9 px-4 rounded-xl font-semibold gap-1.5 text-[20px]"
          >
            <Plus size={14} /> Add Member
          </Button>
        }
      >
        <div className="space-y-2.5">
          {(users || []).map((u: any) => (
            <div key={u.id}
              className="flex items-center gap-4 px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 group transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#1F5C45] text-white flex items-center justify-center text-[20px] font-bold flex-shrink-0">
                {u.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[20px] font-bold text-slate-900 leading-snug">{u.name}</p>
                <p className="text-[20px] font-medium text-slate-500 truncate">{u.email}</p>
              </div>
              <span className={cn('text-[19px] font-bold px-3 py-1 rounded-lg capitalize', roleColors[u.role] || roleColors.AGENT)}>
                {u.role.toLowerCase()}
              </span>
              {u.isActive
                ? <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                : <XCircle     size={20} className="text-slate-300 flex-shrink-0" />
              }
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditUser(u)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  title="Edit role"
                >
                  <Pencil size={14} />
                </button>
                {u.isActive && (
                  <button
                    onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateUser.mutate(u.id); }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Deactivate"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ══ FOLLOW-UP SEQUENCES ══════════════════════════════════════════════ */}
      <SectionCard icon={Repeat2} title="Follow-up Sequences">
        <div className="space-y-3">
          {(sequences || []).map((seq: any) => (
            <div key={seq.id} className="px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[20px] font-bold text-slate-900">{seq.name}</p>
                <span className={cn(
                  'text-[19px] font-bold px-3 py-1 rounded-lg',
                  seq.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200',
                )}>
                  {seq.isActive ? '● Active' : '○ Inactive'}
                </span>
              </div>
              <p className="text-[20px] font-medium text-slate-600">
                {seq.steps?.length ?? 0} steps
                {seq.stopOnReply ? ' · stops automatically when lead replies' : ''}
              </p>
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {(seq.steps || []).map((step: any, i: number) => (
                  <span key={step.id}
                    className="text-[19px] font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700"
                  >
                    Step {i+1} · {step.delayMinutes === 0 ? 'Immediately' : step.delayMinutes < 1440 ? `After ${step.delayMinutes/60}h` : `Day ${Math.round(step.delayMinutes/1440)}`}
                    {step.condition?.ifNoReply ? ' (if no reply)' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {(!sequences || sequences.length === 0) && (
            <p className="text-[19px] text-slate-500 font-medium py-4 text-center">No sequences configured yet.</p>
          )}
        </div>
      </SectionCard>

      {/* ══ VENUE SETTINGS ══════════════════════════════════════════════════ */}
      {settings && (
        <SectionCard
          icon={Building2}
          title="Venue Settings"
          action={
            <Button size="sm" variant="outline"
              onClick={() => { setVenueName(settings.venueName || ''); setEditVenueOpen(true); }}
              className="h-9 px-4 rounded-xl font-semibold text-[20px] gap-1.5"
            >
              <Pencil size={13} /> Edit
            </Button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['Venue Name',     settings.venueName],
              ['Timezone',       settings.timezone],
              ['Currency',       settings.currency],
              ['Country Code',   settings.defaultCountryCode],
              ['Hot score ≥',    settings.scoreThresholds?.hot ?? 80],
              ['Warm score ≥',   settings.scoreThresholds?.warm ?? 50],
            ] as [string, string | number][]).map(([label, value]) => (
              <div key={label as string} className="px-4 py-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[19px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                <p className="text-[19px] font-bold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ══ CONTENT MANAGEMENT SYSTEM ══════════════════════════════════════ */}
      <SectionCard icon={LayoutList} title="Content Management">
        <p className="text-[15px] text-slate-500 font-medium mb-6">
          Manage every dropdown in the system — add, rename or remove custom options.
          Fixed options (🔒) are system defaults and cannot be removed.
        </p>

        {/* ─ Event Types ─ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[17px] font-bold text-slate-800">Event Types</h3>
            <span className="text-[13px] text-slate-400 font-medium">Used in: New Lead, Lead Detail, Filters</span>
          </div>

          <div className="space-y-2 mb-3">
            {/* Fixed base options */}
            {BASE_EVENT_TYPES.map(et => (
              <div key={et.value} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <Lock size={14} className="text-slate-300 flex-shrink-0" />
                <span className="text-[16px] font-semibold text-slate-700 flex-1">{et.label}</span>
                <span className="text-[12px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-lg">System default</span>
              </div>
            ))}

            {/* Custom options */}
            {cms.customEventTypes.map((label: string) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#1F5C45]/30 group">
                {editingET === label ? (
                  <>
                    <input
                      value={editingETVal}
                      onChange={e => setEditingETVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { cms.renameEventType(label, editingETVal); setEditingET(null); }
                        if (e.key === 'Escape') setEditingET(null);
                      }}
                      autoFocus
                      className="flex-1 h-9 rounded-lg border border-[#1F5C45] px-3 text-[16px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1F5C45]"
                    />
                    <button onClick={() => { cms.renameEventType(label, editingETVal); setEditingET(null); }}
                      className="p-1.5 rounded-lg bg-[#1F5C45] text-white hover:bg-[#143d2e]">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingET(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                      <XCircle size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[16px] font-semibold text-[#1F5C45] flex-1">{label}</span>
                    <span className="text-[12px] text-[#1F5C45] font-medium bg-[#1F5C45]/10 px-2 py-0.5 rounded-lg">Custom</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingET(label); setEditingETVal(label); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => cms.removeEventType(label)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new event type */}
          <div className="flex gap-2">
            <input
              value={newEventType}
              onChange={e => setNewEventType(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newEventType.trim()) { cms.addEventType(newEventType); setNewEventType(''); } }}
              placeholder="e.g. Haldi Ceremony, Mehendi, Pool Party…"
              className="flex-1 h-11 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45] focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
            <button
              onClick={() => { if (newEventType.trim()) { cms.addEventType(newEventType); setNewEventType(''); } }}
              disabled={!newEventType.trim() || cms.saving}
              className="flex items-center gap-2 px-4 h-11 bg-[#1F5C45] hover:bg-[#143d2e] text-white rounded-xl font-semibold text-[15px] disabled:opacity-40 transition-colors"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* ─ Lead Sources ─ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[17px] font-bold text-slate-800">Lead Sources</h3>
            <span className="text-[13px] text-slate-400 font-medium">Used in: New Lead, Filters, Analytics</span>
          </div>

          <div className="space-y-2 mb-3">
            {/* Fixed base sources */}
            {BASE_SOURCES.map(src => (
              <div key={src.value} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <Lock size={14} className="text-slate-300 flex-shrink-0" />
                <span className="text-[16px] font-semibold text-slate-700 flex-1">{src.label}</span>
                <span className="text-[12px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-lg">System default</span>
              </div>
            ))}

            {/* Custom sources */}
            {cms.customSources.map((label: string) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#C9A24B]/40 group">
                {editingSrc === label ? (
                  <>
                    <input
                      value={editingSrcVal}
                      onChange={e => setEditingSrcVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { cms.renameSource(label, editingSrcVal); setEditingSrc(null); }
                        if (e.key === 'Escape') setEditingSrc(null);
                      }}
                      autoFocus
                      className="flex-1 h-9 rounded-lg border border-[#C9A24B] px-3 text-[16px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#C9A24B]"
                    />
                    <button onClick={() => { cms.renameSource(label, editingSrcVal); setEditingSrc(null); }}
                      className="p-1.5 rounded-lg bg-[#C9A24B] text-white hover:bg-[#a07d2e]">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingSrc(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                      <XCircle size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[16px] font-semibold text-[#a07d2e] flex-1">{label}</span>
                    <span className="text-[12px] text-[#a07d2e] font-medium bg-[#C9A24B]/10 px-2 py-0.5 rounded-lg">Custom</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingSrc(label); setEditingSrcVal(label); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => cms.removeSource(label)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new source */}
          <div className="flex gap-2">
            <input
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSource.trim()) { cms.addSource(newSource); setNewSource(''); } }}
              placeholder="e.g. Instagram, Facebook, Walk-in, Newspaper Ad…"
              className="flex-1 h-11 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-[#C9A24B] focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
            <button
              onClick={() => { if (newSource.trim()) { cms.addSource(newSource); setNewSource(''); } }}
              disabled={!newSource.trim() || cms.saving}
              className="flex items-center gap-2 px-4 h-11 bg-[#C9A24B] hover:bg-[#a07d2e] text-white rounded-xl font-semibold text-[15px] disabled:opacity-40 transition-colors"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ══ QUOTATION DEFAULTS ══════════════════════════════════════════════ */}
      <QuotationDefaultsCard />

      {/* ══════════════════════════════ DIALOGS ════════════════════════════ */}

      {/* Add / Edit Stage */}
      <Dialog open={addStageOpen || !!editStage} onOpenChange={open => { if (!open) { setAddStageOpen(false); setEditStage(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editStage ? 'Edit Stage' : 'Add New Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-[20px] font-semibold text-slate-700 mb-1.5">Stage Name *</label>
              <Input
                value={stageName}
                onChange={e => setStageName(e.target.value)}
                placeholder="e.g. Pre-Booking"
                className="h-10 rounded-xl text-[19px] font-medium"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[20px] font-semibold text-slate-700 mb-2">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStageColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-lg transition-all',
                      stageColor === c ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => { setAddStageOpen(false); setEditStage(null); }} className="flex-1 h-10 rounded-xl font-semibold">Cancel</Button>
              <Button
                className="flex-1 h-10 rounded-xl font-semibold bg-[#1F5C45] hover:bg-[#143d2e] text-white"
                disabled={!stageName.trim() || createStage.isPending || updateStage.isPending}
                onClick={() => editStage ? updateStage.mutate() : createStage.mutate()}
              >
                {editStage ? 'Save Changes' : 'Add Stage'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Stage confirm */}
      <AlertDialog open={!!deleteStageTarget} onOpenChange={open => !open && setDeleteStageTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove stage "{deleteStageTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              All leads in this stage must be reassigned first. If the stage has no leads, it will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStageTarget && deleteStage.mutate(deleteStageTarget.id)}>
              Remove Stage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Team Member */}
      <Dialog open={addUserOpen} onOpenChange={open => !open && setAddUserOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[
              { label: 'Full Name *',   value: userName,  set: setUserName,  type: 'text',     placeholder: 'Ravi Kumar' },
              { label: 'Email *',       value: userEmail, set: setUserEmail, type: 'email',    placeholder: 'ravi@nahatalawns.com' },
              { label: 'Phone (+91)',   value: userPhone, set: setUserPhone, type: 'tel',      placeholder: '+919876543210' },
              { label: 'Password *',   value: userPass,  set: setUserPass,  type: 'password', placeholder: 'Min 8 characters' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-[20px] font-semibold text-slate-700 mb-1">{f.label}</label>
                <Input
                  type={f.type}
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="h-10 rounded-xl text-[19px] font-medium"
                />
              </div>
            ))}
            <div>
              <label className="block text-[20px] font-semibold text-slate-700 mb-1">Role *</label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger className="h-10 rounded-xl font-semibold text-[20px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENT">Agent — works leads</SelectItem>
                  <SelectItem value="MANAGER">Manager — full access except users</SelectItem>
                  <SelectItem value="OWNER">Owner — full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setAddUserOpen(false)} className="flex-1 h-10 rounded-xl font-semibold">Cancel</Button>
              <Button
                className="flex-1 h-10 rounded-xl font-semibold bg-[#1F5C45] hover:bg-[#143d2e] text-white"
                disabled={!userName || !userEmail || !userPass || createUser.isPending}
                onClick={() => createUser.mutate()}
              >
                {createUser.isPending ? 'Adding…' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Role */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Role — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Select defaultValue={editUser?.role} onValueChange={r => setEditUser((u: any) => ({ ...u, role: r }))}>
              <SelectTrigger className="h-10 rounded-xl font-semibold text-[20px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditUser(null)} className="flex-1 h-10 rounded-xl font-semibold">Cancel</Button>
              <Button
                className="flex-1 h-10 rounded-xl font-semibold bg-[#1F5C45] hover:bg-[#143d2e] text-white"
                onClick={() => updateUserRole.mutate({ id: editUser.id, role: editUser.role })}
                disabled={updateUserRole.isPending}
              >
                Save Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Venue Name */}
      <Dialog open={editVenueOpen} onOpenChange={open => !open && setEditVenueOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Venue Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder="Nahata Lawns"
              className="h-10 rounded-xl text-[19px] font-medium"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditVenueOpen(false)} className="flex-1 h-10 rounded-xl font-semibold">Cancel</Button>
              <Button
                className="flex-1 h-10 rounded-xl font-semibold bg-[#1F5C45] hover:bg-[#143d2e] text-white"
                disabled={!venueName.trim() || updateVenue.isPending}
                onClick={() => updateVenue.mutate()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
