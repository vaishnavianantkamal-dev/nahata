import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const COLORS = ['#1F5C45', '#C9A24B', '#0ea5e9', '#8b5cf6', '#ec4899'];

export function SourcePerformanceChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['best-source'],
    queryFn: () => api.get('/analytics/best-source').then(r => r.data),
  });

  const sources: Array<{ source: string; label: string; total: number; bookings: number; winRate: number }> = (data || []).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-slate-800 text-base">Source Performance</h3>
        <p className="text-slate-600 text-xs mt-0.5">Win rate per lead source</p>
      </div>
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((s, i) => (
            <div key={s.source} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700 truncate">{s.label}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-xs text-slate-600">{s.total} leads</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={{ backgroundColor: `${COLORS[i % COLORS.length]}18`, color: COLORS[i % COLORS.length] }}
                    >
                      {s.winRate}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(4, s.winRate)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
              {i === 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#C9A24B] text-white flex-shrink-0">
                  Best
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
