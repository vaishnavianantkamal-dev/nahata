import { WhatsAppProvider } from './interface';
import { MockWhatsAppProvider } from './mock';
import { env } from '../../config/env';

// Alternatives: twilio, gupshup, interakt, aisensy
let instance: WhatsAppProvider;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (!instance) {
    if (env.WHATSAPP_PROVIDER === 'meta') {
      // Real Meta Cloud API adapter would go here
      throw new Error('Meta WhatsApp adapter not yet implemented. Set WHATSAPP_PROVIDER=mock');
    }
    instance = new MockWhatsAppProvider();
  }
  return instance;
}
