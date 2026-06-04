import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '@/lib/api';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xl text-sm">
      <p className="text-slate-600 text-xs mb-0.5 font-medium">{label}</p>
      <p className="font-bold text-[#1F5C45] text-base">{payload[0].value}</p>
      <p className="text-slate-600 text-xs">enquiries</p>
    </div>
  );
};

export function EnquiriesByWeekChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['enquiries-by-week-30d'],
    queryFn: () => api.get('/analytics/enquiries-by-week?range=30d').then(r => r.data),
  });

  const chartData: Array<{ week: string; count: number }> = data || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-slate-800 text-base">Enquiries by Week</h3>
        <p className="text-slate-600 text-xs mt-0.5">Volume of new leads across the last 30 days</p>
      </div>
      {isLoading ? (
        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter', fontWeight: 500 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter' }}
              axisLine={false} tickLine={false} allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} name="Enquiries">
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === chartData.length - 1 ? '#C9A24B' : '#1F5C45'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
