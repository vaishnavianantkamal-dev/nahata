import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { cn, sourceLabel, sourceColor, scoreBandIcon, scoreBandColor, eventTypeLabel } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { NewLeadModal } from '@/features/leads/NewLeadModal';

/* ── Draggable lead card ─────────────────────────────────────────────────── */
function LeadCard({ lead, onClick }: { lead: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-3.5 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-all select-none',
        isDragging && 'opacity-30',
      )}
    >
      <p className="text-[19px] font-bold text-slate-900 leading-snug truncate">{lead.name}</p>
      <p className="text-[19px] font-medium text-slate-600 mt-0.5">
        {eventTypeLabel(lead.eventType)}{lead.guestCount ? ` · ${lead.guestCount} pax` : ''}
      </p>
      <div className="flex items-center justify-between mt-2.5">
        <span className={cn('px-2 py-0.5 rounded-md text-[19px] font-bold border', sourceColor(lead.source))}>
          {sourceLabel(lead.source)}
        </span>
        {lead.scoreBand !== 'UNSCORED' && (
          <span className={cn('px-2 py-0.5 rounded-md text-[20px] font-bold border', scoreBandColor(lead.scoreBand))}>
            {scoreBandIcon(lead.scoreBand)} {lead.score}
          </span>
        )}
        {lead.owner && (
          <div className="w-6 h-6 rounded-full bg-[#1F5C45] text-white text-[19px] flex items-center justify-center font-bold">
            {lead.owner.name?.charAt(0)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Droppable column ────────────────────────────────────────────────────── */
function KanbanColumn({
  stage, leads, total, onCardClick,
}: {
  stage: any; leads: any[]; total: number; onCardClick: (lead: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-shrink-0 w-[240px] flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-slate-200 mb-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="text-[20px] font-bold text-slate-800">{stage.name}</span>
        </div>
        <span className="bg-slate-100 text-slate-700 text-[20px] font-bold px-2 py-0.5 rounded-full">
          {total}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-col flex flex-col gap-2 p-2 rounded-xl transition-colors min-h-[200px]',
          isOver ? 'bg-[#1F5C45]/10 border-2 border-dashed border-[#1F5C45]/40' : 'bg-slate-100/60',
        )}
      >
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8 text-[19px] text-slate-500 font-medium">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main PipelinePage ───────────────────────────────────────────────────── */
export function PipelinePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [newLeadOpen,  setNewLeadOpen]  = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /* Board query */
  const { data: board, isLoading } = useQuery({
    queryKey: ['pipeline-board'],
    queryFn: () => api.get('/pipeline/board').then(r => r.data),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });

  /* Move mutation — persists to DB */
  const moveMutation = useMutation({
    mutationFn: ({ leadId, toStageId }: { leadId: string; toStageId: string }) =>
      api.patch('/pipeline/move', { leadId, toStageId }),
    onMutate: async ({ leadId, toStageId }) => {
      await qc.cancelQueries({ queryKey: ['pipeline-board'] });
      const prev = qc.getQueryData(['pipeline-board']);

      // Optimistic update: move card between columns
      qc.setQueryData(['pipeline-board'], (old: any[]) => {
        if (!old) return old;
        let movedLead: any = null;
        const updated = old.map(col => {
          const lead = col.leads.find((l: any) => l.id === leadId);
          if (lead) { movedLead = lead; }
          return { ...col, leads: col.leads.filter((l: any) => l.id !== leadId), total: col.total - (lead ? 1 : 0) };
        });
        if (!movedLead) return old;
        return updated.map(col =>
          col.stage.id === toStageId
            ? { ...col, leads: [{ ...movedLead, stageId: toStageId }, ...col.leads], total: col.total + 1 }
            : col,
        );
      });

      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['pipeline-board'], ctx.prev);
      toast({ variant: 'destructive', title: 'Move failed', description: 'Could not update stage. Please try again.' });
    },
    onSuccess: () => {
      toast({ title: '✅ Stage updated', description: 'WhatsApp message sent automatically.' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-board'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });

  /* Find which column a lead currently sits in */
  const getLeadColumn = (leadId: string) =>
    (board || []).find((col: any) => col.leads.some((l: any) => l.id === leadId));

  const activeLead = board
    ? (board.flatMap((c: any) => c.leads) as any[]).find(l => l.id === activeId)
    : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const leadId   = active.id as string;
    const overId   = over.id as string;

    // Find the target column: over.id is either a stageId (dropped on column bg) or a leadId (dropped on card)
    const toColumn =
      (board || []).find((col: any) => col.stage.id === overId) ||          // dropped on column zone
      (board || []).find((col: any) => col.leads.some((l: any) => l.id === overId)); // dropped on card

    if (!toColumn) return;

    const fromColumn = getLeadColumn(leadId);
    if (!fromColumn) return;
    if (fromColumn.stage.id === toColumn.stage.id) return; // same column — no op

    moveMutation.mutate({ leadId, toStageId: toColumn.stage.id });
  };

  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[240px] h-64 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[30px] font-display font-bold text-slate-900 leading-tight">Pipeline</h1>
          <p className="text-[19px] text-slate-600 font-medium mt-1">
            Drag cards to move leads through stages · changes save instantly
          </p>
        </div>
        <button
          onClick={() => setNewLeadOpen(true)}
          className="flex items-center gap-2 bg-[#1F5C45] hover:bg-[#143d2e] text-white px-4 py-2.5 rounded-xl font-semibold text-[20px] transition-colors"
        >
          <Plus size={15} /> New Lead
        </button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 items-start">
          {(board || []).map((col: any) => (
            <KanbanColumn
              key={col.stage.id}
              stage={col.stage}
              leads={col.leads}
              total={col.total}
              onCardClick={lead => navigate(`/leads/${lead.id}`)}
            />
          ))}
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeLead && (
            <div className="bg-white rounded-xl border-2 border-[#1F5C45] p-3.5 shadow-2xl w-[240px] rotate-2 opacity-95">
              <p className="text-[19px] font-bold text-slate-900">{activeLead.name}</p>
              <p className="text-[19px] text-slate-600 mt-0.5">
                {eventTypeLabel(activeLead.eventType)}{activeLead.guestCount ? ` · ${activeLead.guestCount} pax` : ''}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
    </div>
  );
}
