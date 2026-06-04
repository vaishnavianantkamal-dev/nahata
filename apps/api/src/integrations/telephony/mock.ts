import { TelephonyProvider } from './interface';
import { logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

// Mock adapter — simulates Exotel click-to-call + webhook callbacks
export class MockTelephonyProvider implements TelephonyProvider {
  async clickToCall(agentNumber: string, leadNumber: string) {
    const providerCallId = `EX_MOCK_${uuidv4()}`;
    logger.info({ provider: 'mock-telephony', agentNumber, leadNumber, providerCallId }, '[MOCK] Click-to-call initiated');
    return { providerCallId };
  }

  async fetchRecording(providerCallId: string) {
    logger.info({ providerCallId }, '[MOCK] Fetching recording (returning sample)');
    // Returns a dummy URL; in real usage this would be a signed URL to the recording
    return { url: `https://sample-audio.example.com/${providerCallId}.mp3` };
  }

  verifyWebhook(_req: any) { return true; }
}
