import { LlmProvider } from './interface';
import { MockLlmProvider } from './mock';
import { env } from '../../config/env';

let instance: LlmProvider;

export function getLlmProvider(): LlmProvider {
  if (!instance) {
    if (env.LLM_PROVIDER === 'anthropic') {
      // Real Anthropic Claude adapter would go here
      throw new Error('Anthropic adapter not yet implemented. Set LLM_PROVIDER=mock');
    }
    instance = new MockLlmProvider();
  }
  return instance;
}
