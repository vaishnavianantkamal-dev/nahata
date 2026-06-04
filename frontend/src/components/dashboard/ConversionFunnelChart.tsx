import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

const COLORS = ['#1F5C45', '#0ea5e9', '#8b5cf6', '#C9A24B', '#ec4899', '#16a34a'];

export function ConversionFunnelChart() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['conversion-funnel'],
    queryFn: () => api.get('/analytics/conversion-funnel').then(r => r.data),
  });

  const funnel: Array<{ stageId: string; stageName: string; count: number; dropoffPercent: number }> = data || [];
  const maxCount = funnel[0]?.count || 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-slate-800 text-base">Conversion Funnel</h3>
        <p className="text-slate-600 text-xs mt-0.5">How leads move from enquiry to booking</p>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {funnel.map((stage, i) => {
            const pct = Math.max(6, Math.round((stage.count / maxCount) * 100));
            return (
              <button
                key={stage.stageId}
                onClick={() => navigate(`/leads?stageId=${stage.stageId}`)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-slate-500 text-right flex-shrink-0 truncate">{stage.stageName}</div>
                  <div className="flex-1 h-8 bg-slate-100 rounded-xl overflow-hidden">
                    <div
                      className="h-full rounded-xl transition-all duration-500 flex items-center px-3 group-hover:opacity-90"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    >
                      {pct > 18 && (
                        <span className="text-xs font-bold text-white">{stage.count}</span>
                      )}
                    </div>
                  </div>
                  {pct <= 18 && (
                    <span className="text-xs font-bold text-slate-600 w-6 text-right flex-shrink-0">{stage.count}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
