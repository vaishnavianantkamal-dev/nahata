import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, MessageSquare, TrendingUp, Phone, Kanban, ArrowRight } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { EnquiriesByWeekChart } from '@/components/dashboard/EnquiriesByWeekChart';
import { LeadsBySourceChart } from '@/components/dashboard/LeadsBySourceChart';
import { ConversionFunnelChart } from '@/components/dashboard/ConversionFunnelChart';
import { SourcePerformanceChart } from '@/components/dashboard/SourcePerformanceChart';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TABS = ['Overview', 'Pipeline', 'Analytics'] as const;
type Tab = typeof TABS[number];

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const firstName = user?.name?.split(' ')[0] || 'Team';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get('/analytics/kpis').then(r => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Dark Hero Banner ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1f18 0%, #1F5C45 60%, #2d7a56 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute right-32 -bottom-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-8 top-8 w-20 h-20 rounded-full bg-[#C9A24B]/20" />

        <div className="relative px-6 lg:px-8 pt-7 pb-6">
          {/* Top row: greeting + date */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-white leading-tight">
                {getGreeting()}, {firstName}! 🌿
              </h1>
              <p className="text-white/60 text-sm mt-1.5">
                Here's what's happening with your leads today.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 text-sm font-medium whitespace-nowrap">{today}</span>
            </div>
          </div>

          {/* Quick action CTAs */}
          <div className="flex gap-3 mt-5 flex-wrap">
            <button
              onClick={() => navigate('/leads')}
              className="flex items-center gap-2.5 bg-[#C9A24B] hover:bg-[#a07d2e] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-[#C9A24B]/30 hover:shadow-[#C9A24B]/40 hover:-translate-y-0.5"
            >
              <Users size={15} />
              View Leads
              <ArrowRight size={13} className="opacity-70" />
            </button>
            <button
              onClick={() => navigate('/pipeline')}
              className="flex items-center gap-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
            >
              <Kanban size={15} />
              Open Pipeline
            </button>
            <button
              onClick={() => navigate('/whatsapp')}
              className="flex items-center gap-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
            >
              <MessageSquare size={15} />
              WhatsApp Flow
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 border-t border-white/10 pt-4">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white text-[#1F5C45] shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content below hero ───────────────────────────────────────────────── */}
      <div className="flex-1 px-6 lg:px-8 py-6 space-y-6">

        {/* KPI Row A — with deltas */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="New Leads"
            value={kpis?.newLeads ?? 0}
            subtitle="This month"
            delta={kpis?.deltas?.newLeads}
            icon={Users}
            accent="#1F5C45"
            loading={isLoading}
          />
          <KpiCard
            title="Site Visits"
            value={kpis?.siteVisits ?? 0}
            subtitle="Scheduled visits"
            delta={kpis?.deltas?.siteVisits}
            icon={CheckCircle}
            accent="#0ea5e9"
            loading={isLoading}
          />
          <KpiCard
            title="Bookings"
            value={kpis?.bookings ?? 0}
            subtitle="Confirmed this month"
            delta={kpis?.deltas?.bookings}
            icon={CheckCircle}
            accent="#16a34a"
            loading={isLoading}
          />
          <KpiCard
            title="Win Rate"
            value={`${kpis?.winRate ?? 0}%`}
            subtitle="Of qualified leads"
            delta={kpis?.deltas?.winRate}
            icon={TrendingUp}
            accent="#C9A24B"
            loading={isLoading}
          />
        </div>

        {/* KPI Row B */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Enquiries"
            value={kpis?.totalEnquiries ?? 0}
            subtitle="All time"
            icon={Users}
            accent="#8b5cf6"
            loading={isLoading}
          />
          <KpiCard
            title="In Pipeline"
            value={kpis?.inPipeline ?? 0}
            subtitle="Active leads"
            icon={Kanban}
            accent="#f59e0b"
            loading={isLoading}
          />
          <KpiCard
            title="Confirmed"
            value={kpis?.confirmed ?? 0}
            subtitle="Won bookings"
            icon={CheckCircle}
            accent="#16a34a"
            loading={isLoading}
          />
          <KpiCard
            title="WhatsApp Sent"
            value={kpis?.whatsappSent ?? 0}
            subtitle="Messages this month"
            icon={MessageSquare}
            accent="#25D366"
            loading={isLoading}
          />
        </div>

        {activeTab === 'Overview' && (
          <>
            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <EnquiriesByWeekChart />
              <LeadsBySourceChart />
            </div>
            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ConversionFunnelChart />
              <SourcePerformanceChart />
            </div>
          </>
        )}

        {activeTab === 'Pipeline' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <Kanban size={32} className="text-slate-500 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Pipeline Kanban</p>
            <p className="text-slate-600 text-sm mt-1">Drag and drop leads through your stages</p>
            <button
              onClick={() => navigate('/pipeline')}
              className="mt-4 px-5 py-2.5 bg-[#1F5C45] text-white rounded-xl text-sm font-semibold hover:bg-[#143d2e] transition-colors"
            >
              Open Pipeline →
            </button>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <EnquiriesByWeekChart />
            <LeadsBySourceChart />
            <ConversionFunnelChart />
            <SourcePerformanceChart />
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-2 border-t border-slate-100">
          <p className="text-slate-600 text-xs italic">
            "Not a single lead should ever be missed." — Nahata Lawns CRM
          </p>
        </div>
      </div>
    </div>
  );
}
