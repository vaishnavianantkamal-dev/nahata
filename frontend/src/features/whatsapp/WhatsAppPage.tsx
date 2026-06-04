import { useQuery } from '@tanstack/react-query';
import {
  Zap, GitBranch, Clock, CheckCheck, ArrowRight, ArrowDown,
  MessageSquare, Users, AlertCircle, CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold',
      active
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-slate-100 text-slate-500 border border-slate-200',
    )}>
      <span className={cn('w-2 h-2 rounded-full', active ? 'bg-green-500 animate-pulse' : 'bg-slate-400')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function WhatsAppPage() {
  const { data: stages }    = useQuery({ queryKey: ['stages'],    queryFn: () => api.get('/stages').then(r => r.data) });
  const { data: sequences } = useQuery({ queryKey: ['sequences'], queryFn: () => api.get('/sequences').then(r => r.data) });
  const { data: kpis }      = useQuery({ queryKey: ['kpis'],      queryFn: () => api.get('/analytics/kpis').then(r => r.data) });

  const stagesWithBinding = (stages || []).filter((s: any) => s.messageBinding?.enabled);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-5xl">

      {/* ── Header ── */}
      <div>
        <h1 className="text-[28px] font-display font-bold text-slate-900 leading-tight">WhatsApp Automation</h1>
        <p className="text-[16px] text-slate-500 font-medium mt-1">
          Every message that goes out automatically — what it says, when it fires, and to whom.
        </p>
      </div>

      {/* ── How it works flow ── */}
      <div className="bg-[#0f1f18] rounded-2xl p-6">
        <p className="text-[12px] font-bold uppercase tracking-widest text-white/40 mb-5">How It Works — End to End</p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { icon: Users,         label: 'Lead Arrives',        sub: 'Any source',             color: '#C9A24B' },
            { icon: MessageSquare, label: 'Welcome Sent',         sub: 'Instantly',              color: '#0ea5e9' },
            { icon: GitBranch,     label: 'Stage Messages',       sub: 'On each stage move',     color: '#8b5cf6' },
            { icon: Clock,         label: 'Follow-up Sequence',   sub: 'Day 2, Day 5 if silent', color: '#f59e0b' },
            { icon: CheckCheck,    label: 'Lead Responds',        sub: 'Sequence stops',         color: '#16a34a' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${step.color}30` }}
                >
                  <step.icon size={18} style={{ color: step.color }} />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white leading-tight">{step.label}</p>
                  <p className="text-[12px] text-white/45 font-medium">{step.sub}</p>
                </div>
              </div>
              {i < arr.length - 1 && <ArrowRight size={16} className="text-white/20 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'WhatsApp Sent This Month', value: kpis?.whatsappSent ?? 0,               icon: MessageSquare, color: '#25D366' },
          { label: 'Stages with Auto-Message', value: stagesWithBinding.length,               icon: GitBranch,     color: '#8b5cf6' },
          { label: 'Active Sequences',          value: (sequences||[]).filter((s:any)=>s.isActive).length, icon: Clock, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-[26px] font-bold font-display text-slate-900 leading-none">{s.value}</p>
              <p className="text-[12px] font-semibold text-slate-500 mt-1 uppercase tracking-wide leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══ TRIGGER 1 ════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border-l-4 border-[#1F5C45] border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1F5C45]/5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1F5C45] flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[18px] font-display font-bold text-slate-900">Trigger 1 — Lead Arrives</h2>
              <p className="text-[14px] text-slate-500 font-medium">
                Fires the instant a new lead is captured from any source (WedMeGood, JustDial, Website, etc.)
              </p>
            </div>
          </div>
          <StatusPill active={true} />
        </div>
        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-[14px] font-bold uppercase tracking-wide text-slate-400 mb-3">What gets sent:</p>
          <div className="flex items-start gap-4 p-4 bg-[#1F5C45]/5 rounded-xl border border-[#1F5C45]/20">
            <CheckCircle2 size={20} className="text-[#1F5C45] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-[#1F5C45] uppercase tracking-widest mb-1.5">Auto Welcome Template</p>
              <p className="text-[16px] font-medium text-slate-700 leading-relaxed italic">
                "Namaste {'{Name}'} 🙏 Thank you for your interest in Nahata Lawns! We'd love to host your special day.
                May we know your event date &amp; guest count?"
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <CheckCheck size={13} className="text-blue-500" /> Delivered in seconds
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <MessageSquare size={13} className="text-green-500" /> Name auto-filled
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <Users size={13} className="text-purple-500" /> All sources covered
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TRIGGER 2 ════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border-l-4 border-[#C9A24B] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#C9A24B]/5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C9A24B] flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[18px] font-display font-bold text-slate-900">Trigger 2 — Stage Changes</h2>
              <p className="text-[14px] text-slate-500 font-medium">
                When you drag a lead to a new stage in the Pipeline, the right message fires automatically
              </p>
            </div>
          </div>
          <StatusPill active={stagesWithBinding.length > 0} />
        </div>
        <div className="px-6 py-5">
          {stagesWithBinding.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-[15px] font-medium text-amber-700">
                No stage messages set up yet. Go to <strong>Settings → Pipeline Stages</strong> to link a template to each stage.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[14px] font-bold uppercase tracking-wide text-slate-400 mb-3">
                Stage → Message mapping ({stagesWithBinding.length} active):
              </p>
              <div className="space-y-2.5">
                {stagesWithBinding.map((s: any) => (
                  <div key={s.id}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 w-36 flex-shrink-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[15px] font-bold text-slate-800">{s.name}</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-slate-700">{s.messageBinding?.template?.name}</p>
                      {s.messageBinding?.template?.body && (
                        <p className="text-[13px] text-slate-400 font-medium truncate italic mt-0.5">
                          "{s.messageBinding.template.body.slice(0, 90)}{s.messageBinding.template.body.length > 90 ? '…' : ''}"
                        </p>
                      )}
                    </div>
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ FOLLOW-UP SEQUENCES ══════════════════════════════════════════════ */}
      {(sequences || []).map((seq: any) => (
        <div key={seq.id} className="bg-white rounded-2xl border-l-4 border-[#8b5cf6] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-purple-50/60 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8b5cf6] flex items-center justify-center">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-[18px] font-display font-bold text-slate-900">
                  Follow-up Sequence — {seq.name}
                </h2>
                <p className="text-[14px] text-slate-500 font-medium">
                  Starts after a lead arrives · sends timed reminders · stops the moment they reply
                </p>
              </div>
            </div>
            <StatusPill active={seq.isActive} />
          </div>
          <div className="px-6 py-5">
            <p className="text-[14px] font-bold uppercase tracking-wide text-slate-400 mb-4">Timeline:</p>

            {/* Visual step-by-step timeline */}
            <div className="relative pl-1">
              <div className="absolute left-5 top-5 bottom-16 w-0.5 bg-slate-200" />
              <div className="space-y-3">

                {(seq.steps || []).map((step: any, i: number) => {
                  const delay = step.delayMinutes === 0
                    ? 'RIGHT AWAY'
                    : step.delayMinutes < 1440
                    ? `After ${step.delayMinutes / 60} hours`
                    : `Day ${Math.round(step.delayMinutes / 1440)}`;
                  const isNoReply = step.condition?.ifNoReply;

                  return (
                    <div key={step.id} className="flex gap-4 items-start relative">
                      <div className="w-10 h-10 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center font-bold text-[15px] flex-shrink-0 z-10 shadow-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[16px] font-bold text-slate-900">{delay}</span>
                            {isNoReply && (
                              <span className="text-[12px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                                Only if no reply
                              </span>
                            )}
                          </div>
                          <span className="text-[13px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg">
                            {step.template?.name}
                          </span>
                        </div>
                        {step.template?.body && (
                          <p className="text-[14px] text-slate-500 font-medium mt-2 italic leading-relaxed">
                            "{step.template.body.slice(0, 110)}{step.template.body.length > 110 ? '…' : ''}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Stop condition */}
                <div className="flex gap-4 items-start relative">
                  <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 z-10 shadow-sm">
                    <CheckCheck size={18} />
                  </div>
                  <div className="flex-1 bg-green-50 rounded-xl border border-green-200 px-4 py-3.5">
                    <p className="text-[16px] font-bold text-green-800">Lead Replies → Sequence Stops Automatically</p>
                    <p className="text-[14px] font-medium text-green-600 mt-1">
                      The moment your lead responds on WhatsApp, all pending follow-ups are cancelled.
                      Your team then takes over the conversation personally.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ── Tip ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-[15px] font-medium text-blue-800">
          <strong>To edit messages:</strong> Go to <strong>Templates</strong> in the sidebar to change message content.{' '}
          To link messages to stages, go to <strong>Settings → Pipeline Stages</strong>.
        </p>
      </div>

    </div>
  );
}
