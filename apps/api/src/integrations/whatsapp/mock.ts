import { WhatsAppProvider } from './interface';
import { logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

// Mock adapter — logs everything, simulates delivery ticks after a delay
export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendText(to: string, body: string) {
    const providerMessageId = `MOCK_WA_${uuidv4()}`;
    logger.info({ provider: 'mock-whatsapp', to, body: body.slice(0, 100), providerMessageId }, '[MOCK] WhatsApp text sent');
    this.simulateDelivery(providerMessageId);
    return { providerMessageId };
  }

  async sendTemplate(to: string, templateName: string, vars: Record<string, string>) {
    const providerMessageId = `MOCK_WA_${uuidv4()}`;
    logger.info({ provider: 'mock-whatsapp', to, templateName, vars, providerMessageId }, '[MOCK] WhatsApp template sent');
    this.simulateDelivery(providerMessageId);
    return { providerMessageId };
  }

  verifyWebhook(_req: any) { return true; }

  parseInbound(payload: any) {
    return {
      from: payload.from || '+919999999999',
      body: payload.text?.body || payload.body || '',
      providerMessageId: payload.id || `MOCK_INBOUND_${uuidv4()}`,
    };
  }

  parseStatus(payload: any) {
    if (!payload?.providerMessageId) return null;
    return { providerMessageId: payload.providerMessageId, status: payload.status || 'DELIVERED' };
  }

  private simulateDelivery(providerMessageId: string) {
    // Simulate delivered tick after 2s, read tick after 10s
    setTimeout(() => {
      logger.debug({ providerMessageId }, '[MOCK] Simulated DELIVERED tick');
    }, 2000);
    setTimeout(() => {
      logger.debug({ providerMessageId }, '[MOCK] Simulated READ tick');
    }, 10000);
  }
}
