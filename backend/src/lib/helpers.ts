// Inlined from shared — keeps backend self-contained for deployment

export const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 13 && raw.startsWith('+91')) return `+91${digits.slice(2)}`;
  return null;
}

export enum ScoreBand {
  HOT      = 'HOT',
  WARM     = 'WARM',
  COLD     = 'COLD',
  UNSCORED = 'UNSCORED',
}

export interface CallIntelligence {
  summary:     string;
  event?:      string;
  guests?:     number;
  eventDate?:  string;
  sentiment?:  string;
  objections?: string;
  nextAction:  string;
  score:       number;
  band:        ScoreBand;
  factors: {
    buyingIntent:   number;
    budgetSignals:  number;
    eventDateClose: number;
    engagement:     number;
    sentiment:      number;
    objections:     number;
    callLength:     number;
  };
  rationale: string;
}
