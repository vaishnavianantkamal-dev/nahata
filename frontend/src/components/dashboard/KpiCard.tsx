import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  delta?: number;
  icon?: LucideIcon;
  accent?: string;
  loading?: boolean;
}

export function KpiCard({ title, value, subtitle, delta, icon: Icon, accent = '#1F5C45', loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-10 w-28 bg-slate-100 rounded animate-pulse mb-2" />
        <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  const isPositive = (delta ?? 0) >= 0;
  const displayValue = typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3 gap-2">
        <p className="text-sm font-medium text-slate-500 tracking-wide uppercase flex-1 min-w-0" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
          {title}
        </p>
        {Icon && (
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}15` }}>
            <Icon size={16} style={{ color: accent }} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
        <span className="text-3xl sm:text-4xl font-bold font-display text-slate-900 leading-none tracking-tight">
          {displayValue}
        </span>
        {delta != null && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg mb-0.5 flex-shrink-0',
            isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
          )}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isPositive ? '+' : ''}{delta}%
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-600 mt-2 break-words">{subtitle}</p>
      )}
    </div>
  );
}
