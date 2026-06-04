import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(date: string | Date | null | undefined) {
  if (!date) return 'Never';
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return '—'; }
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatINR(paise: number | null | undefined) {
  if (paise == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise);
}

export function scoreBandColor(band: string) {
  if (band === 'HOT')  return 'text-red-500 bg-red-50 border-red-200';
  if (band === 'WARM') return 'text-amber-500 bg-amber-50 border-amber-200';
  if (band === 'COLD') return 'text-blue-500 bg-blue-50 border-blue-200';
  return 'text-slate-400 bg-slate-50 border-slate-200';
}

export function scoreBandIcon(band: string) {
  if (band === 'HOT')  return '🔥';
  if (band === 'WARM') return '🤗';
  if (band === 'COLD') return '❄️';
  return '—';
}

export function sourceColor(source: string) {
  const colors: Record<string, string> = {
    WEDMEGOOD:        'bg-pink-100 text-pink-700 border-pink-200',
    JUSTDIAL:         'bg-orange-100 text-orange-700 border-orange-200',
    GOOGLE_MAPS:      'bg-blue-100 text-blue-700 border-blue-200',
    WEBSITE:          'bg-green-100 text-green-700 border-green-200',
    MANUAL:           'bg-slate-100 text-slate-700 border-slate-200',
    WHATSAPP_INBOUND: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    IVR_INBOUND:      'bg-purple-100 text-purple-700 border-purple-200',
    REFERRAL:         'bg-yellow-100 text-yellow-700 border-yellow-200',
    OTHER:            'bg-gray-100 text-gray-700 border-gray-200',
  };
  return colors[source] || colors.OTHER;
}

export function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    WEDMEGOOD: 'WedMeGood', JUSTDIAL: 'JustDial', GOOGLE_MAPS: 'Google Maps',
    WEBSITE: 'Website', MANUAL: 'Manual', WHATSAPP_INBOUND: 'WhatsApp',
    IVR_INBOUND: 'IVR Call', REFERRAL: 'Referral', OTHER: 'Other',
  };
  return labels[source] || source;
}

export function eventTypeLabel(et: string) {
  const m: Record<string, string> = {
    WEDDING: 'Wedding', RECEPTION: 'Reception', ENGAGEMENT: 'Engagement',
    SANGEET: 'Sangeet', BIRTHDAY: 'Birthday', CORPORATE: 'Corporate', OTHER: 'Other',
  };
  return m[et] || et;
}

export function stageColor(color: string) {
  return color || '#64748b';
}
