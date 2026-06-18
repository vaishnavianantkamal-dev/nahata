import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, TrendingUp } from 'lucide-react';
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
        'group bg-white rounded-lg border border-slate-200 p-4 cursor-grab active:cursor-grabbing',
        'hover:shadow-lg hover:border-slate-300 transition-all select-none duration-200',
        'hover:-translate-y-1',
        isDragging && 'opacity-40 shadow-xl',
      )}
    >
      <div className="flex gap-2 items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-snug truncate group-hover:text-slate-800">
            {lead.name}
          </p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {eventTypeLabel(lead.eventType)}{lead.guestCount ? ` · ${lead.guestCount} guests` : ''}
          </p>
        </div>
        <GripVertical size={14} className="text-slate-300 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={cn('px-2 py-1 rounded text-xs font-semibold border', sourceColor(lead.source))}>
          {sourceLabel(lead.source)}
        </span>
        {lead.scoreBand !== 'UNSCORED' && (
          <span className={cn('px-2 py-1 rounded text-xs font-semibold border flex items-center gap-1', scoreBandColor(lead.scoreBand))}>
            {scoreBandIcon(lead.scoreBand)} {lead.score}
          </span>
        )}
      </div>

      {lead.owner && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1F5C45] to-[#0d2818] text-white text-xs flex items-center justify-center font-bold shadow-sm">
              {lead.owner.name?.charAt(0)}
            </div>
            <span className="text-xs text-slate-500 font-medium">{lead.owner.name}</span>
          </div>
        </div>
      )}
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
    <div className="flex-shrink-0 w-[320px] flex flex-col h-full">
      {/* Column header */}
      <div className="mb-3">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: stage.color }} />
            <div>
              <h3 className="text-sm font-bold text-slate-900">{stage.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <span className="text-xs font-semibold text-white bg-slate-400 px-2.5 py-1 rounded-full">
                {total}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-col flex flex-col gap-2.5 p-3 rounded-lg transition-all duration-200 flex-1',
          isOver
            ? 'bg-[#1F5C45]/8 border-2 border-dashed border-[#1F5C45]/40 shadow-inner'
            : 'bg-slate-50/60 border border-slate-100/50',
        )}
      >
        <div className="flex flex-col gap-2.5">
          {leads.map((lead, idx) => (
            <div
              key={lead.id}
              style={{
                animation: `slideIn 0.3s ease-out ${idx * 0.05}s backwards`,
              }}
            >
              <LeadCard
                lead={lead}
                onClick={() => onCardClick(lead)}
              />
            </div>
          ))}
        </div>

        {leads.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center mb-2">
              <TrendingUp size={18} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {isOver ? 'Drop here' : 'No leads yet'}
            </p>
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
      toast({ title: '✅ Lead moved', description: 'Stage updated and message sent.' });
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

    const leadId = active.id as string;
    const overId = over.id as string;

    // Find the target column
    const toColumn =
      (board || []).find((col: any) => col.stage.id === overId) ||
      (board || []).find((col: any) => col.leads.some((l: any) => l.id === overId));

    if (!toColumn) return;

    const fromColumn = getLeadColumn(leadId);
    if (!fromColumn) return;
    if (fromColumn.stage.id === toColumn.stage.id) return;

    moveMutation.mutate({ leadId, toStageId: toColumn.stage.id });
  };

  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 py-6">
        <div className="mb-6 h-16 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg animate-pulse" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[320px] h-96 bg-gradient-to-b from-slate-100 to-slate-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Drag cards to move leads through stages · changes save instantly
          </p>
        </div>
        <button
          onClick={() => setNewLeadOpen(true)}
          className={cn(
            'flex items-center gap-2 bg-[#1F5C45] hover:bg-[#143d2e] text-white',
            'px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200',
            'hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
            'flex-shrink-0'
          )}
        >
          <Plus size={16} className="font-bold" />
          New Lead
        </button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto pb-8 items-start">
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
            <div className="bg-white rounded-lg border-2 border-[#1F5C45] p-4 shadow-2xl w-[320px] rotate-1 opacity-98">
              <p className="text-sm font-bold text-slate-900">{activeLead.name}</p>
              <p className="text-xs text-slate-600 mt-1">
                {eventTypeLabel(activeLead.eventType)}{activeLead.guestCount ? ` · ${activeLead.guestCount} guests` : ''}
              </p>
              <div className="flex gap-1.5 mt-3">
                <span className={cn('px-2 py-1 rounded text-xs font-semibold border', sourceColor(activeLead.source))}>
                  {sourceLabel(activeLead.source)}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .kanban-col {
          scrollbar-width: thin;
          scrollbar-color: rgba(100, 116, 139, 0.2) transparent;
        }

        .kanban-col::-webkit-scrollbar {
          width: 6px;
        }

        .kanban-col::-webkit-scrollbar-track {
          background: transparent;
        }

        .kanban-col::-webkit-scrollbar-thumb {
          background-color: rgba(100, 116, 139, 0.2);
          border-radius: 3px;
        }

        .kanban-col::-webkit-scrollbar-thumb:hover {
          background-color: rgba(100, 116, 139, 0.3);
        }
      `}</style>
    </div>
  );
}
