export function formatSource(s: string): string {
  const m: Record<string, string> = {
    WEDMEGOOD: 'WedMeGood', JUSTDIAL: 'JustDial', GOOGLE_MAPS: 'Google Maps',
    WEBSITE: 'Website', MANUAL: 'Manual', WHATSAPP_INBOUND: 'WhatsApp',
    IVR_INBOUND: 'IVR Call', REFERRAL: 'Referral', OTHER: 'Other',
  };
  return m[s] || s;
}
