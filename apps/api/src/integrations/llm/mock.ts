import { CallIntelligence, ScoreBand } from '@nahata/shared';
import { LlmProvider } from './interface';
import { logger } from '../../lib/logger';

// Keyword-based mock scorer — deterministic so the pipeline is fully demoable offline
export class MockLlmProvider implements LlmProvider {
  async summariseAndScore(input: { transcript: string; lead: any }): Promise<CallIntelligence> {
    const { transcript, lead } = input;
    const t = transcript.toLowerCase();

    logger.info({ provider: 'mock-llm', leadName: lead.name }, '[MOCK] Running AI summary & scoring');

    const buyingIntent  = this.score(t, ['confirmed', 'book', 'finalise', 'yes', 'interested', 'perfect', 'love it', 'top choice'], 60, 95);
    const budgetSignals = this.score(t, ['budget', 'lakhs', 'lakh', 'package', 'pricing', 'afford', 'rupees'], 50, 90);
    const eventDateClose = lead.eventDate ? 75 : 40;
    const engagement    = this.score(t, ['question', 'tell me', 'what about', 'how about', 'can you', 'please', 'definitely'], 55, 88);
    const sentimentScore = this.score(t, ['wonderful', 'great', 'fantastic', 'excited', 'happy', 'interested', 'like', 'love'], 50, 92);
    const objectionScore = t.includes('comparing') || t.includes('another venue') || t.includes('think about') ? 60 : 80;
    const callLength = transcript.split(' ').length > 200 ? 85 : transcript.split(' ').length > 100 ? 65 : 45;

    const overall = Math.round(
      (buyingIntent * 0.25 + budgetSignals * 0.15 + eventDateClose * 0.10 +
       engagement * 0.20 + sentimentScore * 0.15 + objectionScore * 0.10 + callLength * 0.05)
    );

    const band: ScoreBand = overall >= 80 ? ScoreBand.HOT : overall >= 50 ? ScoreBand.WARM : ScoreBand.COLD;

    const sentiment = sentimentScore >= 80 ? 'Very interested' : sentimentScore >= 60 ? 'Moderately interested' : 'Neutral';
    const objections = t.includes('comparing') ? 'Comparing with another venue' : t.includes('think') ? 'Wants to think about it' : '';

    return {
      summary: `Couple enquired about a ${lead.eventType?.toLowerCase() || 'event'} for ~${lead.guestCount || '?'} guests. ${objections ? `Objection noted: ${objections}.` : 'No major objections.'} Overall tone was ${sentiment.toLowerCase()}.`,
      event: lead.eventType,
      guests: lead.guestCount,
      eventDate: lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : undefined,
      sentiment,
      objections: objections || undefined,
      nextAction: overall >= 80 ? 'Schedule site visit and share décor photos immediately'
                : overall >= 50 ? 'Send quotation and follow up in 2 days'
                : 'Add to nurture sequence and follow up next week',
      score: overall,
      band,
      factors: { buyingIntent, budgetSignals, eventDateClose, engagement, sentiment: sentimentScore, objections: objectionScore, callLength },
      rationale: `Score ${overall}/100 based on: buying intent (${buyingIntent}), budget signals (${budgetSignals}), engagement (${engagement}), sentiment (${sentimentScore}).`,
    };
  }

  private score(text: string, keywords: string[], min: number, max: number): number {
    const matches = keywords.filter(k => text.includes(k)).length;
    if (matches === 0) return min;
    if (matches >= keywords.length / 2) return max;
    return Math.round(min + (max - min) * (matches / (keywords.length / 2)));
  }
}
