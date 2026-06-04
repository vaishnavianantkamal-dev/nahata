import { CallIntelligence } from '../../lib/helpers';

export interface LlmProvider {
  summariseAndScore(input: {
    transcript: string;
    lead: {
      name: string;
      eventType: string;
      guestCount?: number;
      eventDate?: string;
      budgetMin?: number;
      budgetMax?: number;
    };
  }): Promise<CallIntelligence>;
}
