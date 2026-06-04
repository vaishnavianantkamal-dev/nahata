import { TelephonyProvider } from './interface';
import { MockTelephonyProvider } from './mock';
import { env } from '../../config/env';

// Alternatives: twilio, knowlarity, myoperator, plivo
let instance: TelephonyProvider;

export function getTelephonyProvider(): TelephonyProvider {
  if (!instance) {
    if (env.TELEPHONY_PROVIDER === 'exotel') {
      throw new Error('Exotel adapter not yet implemented. Set TELEPHONY_PROVIDER=mock');
    }
    instance = new MockTelephonyProvider();
  }
  return instance;
}
