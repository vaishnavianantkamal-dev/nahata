import { logger } from '../../lib/logger';
import { env } from '../../config/env';

export interface SttProvider {
  transcribe(audioUrlOrKey: string, lang?: string): Promise<{ text: string; lang: string }>;
}

class MockSttProvider implements SttProvider {
  async transcribe(audioUrlOrKey: string) {
    logger.info({ provider: 'mock-stt', audioUrlOrKey }, '[MOCK] Transcribing audio');
    // Return a realistic dummy transcript so AI scoring works offline
    return {
      text: 'Agent: Good morning, am I speaking with the enquiry caller? Caller: Yes, this is me. We are interested in hosting a wedding at your venue. Agent: Wonderful! We would love to host your special day. Could you tell me about the date and number of guests? Caller: We are looking at a December wedding, about 300 guests. We have a budget of around 15 to 20 lakhs and we definitely want premium décor and catering. Agent: That sounds perfect. Shall we schedule a site visit this weekend? Caller: Yes please! We are very interested and this is our top choice right now.',
      lang: 'en-IN',
    };
  }
}

let instance: SttProvider;
export function getSttProvider(): SttProvider {
  if (!instance) {
    if (env.STT_PROVIDER === 'deepgram') {
      throw new Error('Deepgram adapter not yet implemented. Set STT_PROVIDER=mock');
    }
    instance = new MockSttProvider();
  }
  return instance;
}
