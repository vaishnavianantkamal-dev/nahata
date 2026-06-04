import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { sourceLabel } from '@/lib/utils';

const COLORS = ['#1F5C45', '#C9A24B', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#64748b'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xl text-sm">
      <p className="font-bold text-slate-800">{d.label}</p>
      <p className="text-slate-500 text-xs">{d.count} leads · {d.percentage}%</p>
    </div>
  );
};

export function LeadsBySourceChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['leads-by-source'],
    queryFn: () => api.get('/analytics/leads-by-source').then(r => r.data),
  });

  const chartData = (data || []).map((d: any) => ({
    ...d,
    label: sourceLabel(d.source),
    name: sourceLabel(d.source),
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-slate-800 text-base">Leads by Source</h3>
        <p className="text-slate-600 text-xs mt-0.5">Invest more where real bookings come from</p>
      </div>
      {isLoading ? (
        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
            <PieChart width={160} height={160}>
              <Pie
                data={chartData}
                cx={76}
                cy={76}
                innerRadius={48}
                outerRadius={72}
                dataKey="count"
                nameKey="name"
                paddingAngle={3}
                strokeWidth={0}
              >
                {chartData.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </div>
          <div className="flex-1 space-y-2.5">
            {chartData.map((d: any, i: number) => (
              <div key={d.source} className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-sm text-slate-700 flex-1 truncate">{d.label}</span>
                <span className="text-sm font-bold text-slate-800">{d.count}</span>
                <span className="text-xs text-slate-600 w-8 text-right">{d.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
