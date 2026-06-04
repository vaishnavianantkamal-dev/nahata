export * from './enums';
export * from './types';
export * from './schemas';

export const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 13 && raw.startsWith('+91')) return `+91${digits.slice(2)}`;
  return null;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees);
}

export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}
