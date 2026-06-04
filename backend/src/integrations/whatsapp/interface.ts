export interface WhatsAppProvider {
  sendText(to: string, body: string): Promise<{ providerMessageId: string }>;
  sendTemplate(to: string, templateName: string, vars: Record<string, string>): Promise<{ providerMessageId: string }>;
  verifyWebhook(req: any): boolean;
  parseInbound(payload: any): { from: string; body: string; providerMessageId: string };
  parseStatus(payload: any): { providerMessageId: string; status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' } | null;
}
