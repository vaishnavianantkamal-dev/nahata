import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Nahata Lawns CRM...');

  // ── Users ──────────────────────────────────────────────────────────────
  const ownerHash = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || 'NahataOwner2024!', 12);
  const owner = await prisma.user.upsert({
    where: { email: process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com' },
    update: {},
    create: {
      name: 'Nahata Lawns Owner',
      email: process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com',
      phone: '+919876543210',
      passwordHash: ownerHash,
      role: 'OWNER',
      isActive: true,
    },
  });

  const managerHash = await bcrypt.hash('Manager2024!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@nahatalawns.com' },
    update: {},
    create: {
      name: 'Vikram Sharma',
      email: 'manager@nahatalawns.com',
      phone: '+919876543211',
      passwordHash: managerHash,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const agent1Hash = await bcrypt.hash('Agent2024!', 12);
  const agent1 = await prisma.user.upsert({
    where: { email: 'siyer@nahatalawns.com' },
    update: {},
    create: {
      name: 'S. Iyer',
      email: 'siyer@nahatalawns.com',
      phone: '+919876543212',
      passwordHash: agent1Hash,
      role: 'AGENT',
      isActive: true,
    },
  });

  const agent2Hash = await bcrypt.hash('Agent2024!', 12);
  const agent2 = await prisma.user.upsert({
    where: { email: 'mjoshi@nahatalawns.com' },
    update: {},
    create: {
      name: 'M. Joshi',
      email: 'mjoshi@nahatalawns.com',
      phone: '+919876543213',
      passwordHash: agent2Hash,
      role: 'AGENT',
      isActive: true,
    },
  });

  console.log('✅ Users seeded');

  // ── Stages ─────────────────────────────────────────────────────────────
  const stagesData = [
    { name: 'New Lead',              key: 'new',          order: 1, color: '#64748b', isDefault: true },
    { name: 'Contacted',             key: 'contacted',    order: 2, color: '#0ea5e9' },
    { name: 'Site Visit',            key: 'site_visit',   order: 3, color: '#8b5cf6' },
    { name: 'Quotation',             key: 'quotation',    order: 4, color: '#f59e0b' },
    { name: 'Negotiation',           key: 'negotiation',  order: 5, color: '#ec4899' },
    { name: 'Confirmed',             key: 'confirmed',    order: 6, color: '#16a34a', isWon: true },
    { name: 'Lost / Not Interested', key: 'lost',         order: 7, color: '#94a3b8', isLost: true },
  ];

  const stages: Record<string, any> = {};
  for (const s of stagesData) {
    const stage = await prisma.stage.upsert({
      where: { key: s.key },
      update: { name: s.name, order: s.order, color: s.color },
      create: {
        name: s.name,
        key: s.key,
        order: s.order,
        color: s.color,
        isWon: (s as any).isWon || false,
        isLost: (s as any).isLost || false,
        isDefault: (s as any).isDefault || false,
      },
    });
    stages[s.key] = stage;
  }

  console.log('✅ Stages seeded');

  // ── Template Groups + Templates ─────────────────────────────────────────
  const tgData = [
    {
      name: 'Welcome & Enquiry', description: 'First impressions matter', icon: '👋', color: '#0ea5e9', order: 1, isSystem: true,
      templates: [
        {
          name: 'Instant Welcome',
          body: 'Namaste {Name} 🙏 Thank you for your interest in Nahata Lawns! We\'d love to host your special day. May we know your event date & guest count?',
          order: 1,
        },
        {
          name: 'Website Enquiry Response',
          body: 'Hi {Name}! We received your enquiry from our website. Nahata Lawns would be honoured to host your {EventType}. Our team will call you shortly to discuss details.',
          order: 2,
        },
        {
          name: 'JustDial / Google Lead Response',
          body: 'Namaste {Name}! Thank you for reaching out to Nahata Lawns. We specialise in making weddings & celebrations truly memorable. When is your event and how many guests are you expecting?',
          order: 3,
        },
      ],
    },
    {
      name: 'Follow-up Reminders', description: 'Keep leads warm automatically', icon: '🔔', color: '#f59e0b', order: 2, isSystem: true,
      templates: [
        {
          name: 'Gentle Reminder – Day 2',
          body: 'Hi {Name}, just checking in about your event at Nahata Lawns. We\'d love to answer any questions and help you plan your perfect day. Shall we schedule a quick call? 😊',
          order: 1,
        },
        {
          name: 'Still Interested? – Day 5',
          body: 'Dear {Name}, we\'ve kept your preferred date on hold for you. Nahata Lawns has beautiful spaces for a {EventType} — our availability is filling up for that season. Shall we take the next step?',
          order: 2,
        },
        {
          name: 'Final Nudge – Day 10',
          body: 'Hi {Name}! We understand you\'re busy planning. Just a gentle reminder that your enquiry for {EventType} at Nahata Lawns is still open. We\'d hate for you to miss our best dates! 🌿',
          order: 3,
        },
        {
          name: 'Re-engagement',
          body: 'Namaste {Name}! It\'s been a while since we heard from you. If your plans are still on, Nahata Lawns would love to host your celebration. What\'s a good time to chat?',
          order: 4,
        },
      ],
    },
    {
      name: 'Site Visit', description: 'Confirm and remind site visits', icon: '🌿', color: '#8b5cf6', order: 3, isSystem: true,
      templates: [
        {
          name: 'Site Visit Confirmation',
          body: 'Hi {Name}, your site visit is confirmed for {Date} 🌿 Our team will welcome you at the gate. Looking forward to showing you the lawns! Please carry a photo ID. See you soon!',
          order: 1,
        },
        {
          name: 'Site Visit Reminder',
          body: 'Dear {Name}, a friendly reminder about your site visit at Nahata Lawns tomorrow. We\'re excited to show you everything we have for your {EventType}! 🌸',
          order: 2,
        },
      ],
    },
    {
      name: 'Quotation & Pricing', description: 'Share proposals professionally', icon: '📋', color: '#ec4899', order: 4, isSystem: true,
      templates: [
        {
          name: 'Quotation Sent',
          body: 'Hi {Name}, as discussed, we\'ve prepared a special proposal for your {EventType} at Nahata Lawns. Please review and let us know if you\'d like any adjustments. We look forward to your feedback! 💌',
          order: 1,
        },
        {
          name: 'Quotation Follow-up',
          body: 'Dear {Name}, just following up on the proposal we shared for your {EventType}. Happy to discuss any questions or customise the package further for you. 🙏',
          order: 2,
        },
      ],
    },
    {
      name: 'Booking Confirmed', description: 'Celebrate and guide next steps', icon: '🎉', color: '#16a34a', order: 5, isSystem: true,
      templates: [
        {
          name: 'Booking Confirmation',
          body: 'Congratulations {Name}! 🎉 Your booking is confirmed at Nahata Lawns. We are thrilled to host your {EventType}! Here are your next steps and our contact for any help. Welcome to the Nahata family! 🌿',
          order: 1,
        },
        {
          name: 'Post-booking Welcome',
          body: 'Dear {Name}, welcome! We\'ve noted all the details for your {EventType}. Our coordination team will reach out within 48 hours to begin planning. Excited to make your day unforgettable! ✨',
          order: 2,
        },
      ],
    },
  ];

  const tgMap: Record<string, any> = {};
  const tplMap: Record<string, any> = {};

  for (const tgd of tgData) {
    const { templates, ...groupData } = tgd;
    const tg = await prisma.templateGroup.upsert({
      where: { id: (await prisma.templateGroup.findFirst({ where: { name: tgd.name } }))?.id || 'none' },
      update: { name: tgd.name },
      create: { ...groupData },
    });
    tgMap[tgd.name] = tg;

    for (const t of templates) {
      const existing = await prisma.template.findFirst({ where: { groupId: tg.id, name: t.name } });
      const tpl = existing
        ? await prisma.template.update({ where: { id: existing.id }, data: t })
        : await prisma.template.create({ data: { ...t, groupId: tg.id } });
      tplMap[t.name] = tpl;
    }
  }

  console.log('✅ Templates seeded');

  // ── Stage Message Bindings ──────────────────────────────────────────────
  const bindings = [
    { stageKey: 'new',        templateName: 'Instant Welcome' },
    { stageKey: 'site_visit', templateName: 'Site Visit Confirmation' },
    { stageKey: 'confirmed',  templateName: 'Booking Confirmation' },
  ];

  for (const b of bindings) {
    const stage = stages[b.stageKey];
    const template = tplMap[b.templateName];
    if (stage && template) {
      await prisma.stageMessageBinding.upsert({
        where: { stageId: stage.id },
        update: { templateId: template.id, enabled: true },
        create: { stageId: stage.id, templateId: template.id, enabled: true },
      });
    }
  }

  console.log('✅ Stage bindings seeded');

  // ── Sequences ───────────────────────────────────────────────────────────
  const existingSeq = await prisma.sequence.findFirst({ where: { name: 'New Enquiry Nurture' } });
  const seq = existingSeq || await prisma.sequence.create({
    data: {
      name: 'New Enquiry Nurture',
      description: 'Automatically nurtures new leads with timed follow-ups until they respond',
      isActive: true,
      trigger: 'LEAD_CREATED',
      stopOnReply: true,
      stopOnStageChange: true,
      steps: {
        create: [
          { order: 1, delayMinutes: 0,       templateId: tplMap['Instant Welcome'].id,         condition: {} },
          { order: 2, delayMinutes: 2*24*60, templateId: tplMap['Gentle Reminder – Day 2'].id, condition: { ifNoReply: true } },
          { order: 3, delayMinutes: 5*24*60, templateId: tplMap['Still Interested? – Day 5'].id, condition: { ifNoReply: true } },
        ],
      },
    },
  });

  console.log('✅ Sequences seeded');

  // ── Source Integrations ─────────────────────────────────────────────────
  const sourceIntegrations = [
    { source: 'WEDMEGOOD' as const,   displayName: 'WedMeGood',   webhookSecret: 'wedmegood_secret_2024' },
    { source: 'JUSTDIAL' as const,    displayName: 'JustDial',    webhookSecret: 'justdial_secret_2024' },
    { source: 'GOOGLE_MAPS' as const, displayName: 'Google Maps', webhookSecret: 'googlemaps_secret_2024' },
    { source: 'WEBSITE' as const,     displayName: 'Website',     webhookSecret: 'website_secret_2024' },
  ];

  for (const si of sourceIntegrations) {
    await prisma.sourceIntegration.upsert({
      where: { source: si.source },
      update: {},
      create: { ...si, isEnabled: true, fieldMapping: {} },
    });
  }

  console.log('✅ Source integrations seeded');

  // ── Settings ────────────────────────────────────────────────────────────
  const settings = [
    { key: 'venueName',       value: 'Nahata Lawns' },
    { key: 'timezone',        value: 'Asia/Kolkata' },
    { key: 'currency',        value: 'INR' },
    { key: 'defaultCountryCode', value: '+91' },
    { key: 'consentText',     value: 'This call may be recorded for quality and training purposes.' },
    { key: 'ivrGreeting',     value: 'Welcome to Nahata Lawns. For event enquiries, press 1. For existing bookings, press 2.' },
    { key: 'businessHours',   value: { start: '09:00', end: '20:00', timezone: 'Asia/Kolkata', days: [1,2,3,4,5,6] } },
    { key: 'scoreThresholds', value: { hot: 80, warm: 50 } },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    });
  }

  console.log('✅ Settings seeded');

  // ── Leads ───────────────────────────────────────────────────────────────
  const leadsData = [
    { name: 'Priya & Aakash',   phone: '+919811111101', source: 'WEDMEGOOD' as const,   eventType: 'WEDDING' as const,    stageKey: 'new',         guests: 450, daysAgo: 0,  ownerId: agent1.id, score: null,  band: 'UNSCORED' as const },
    { name: 'Sneha Verma',       phone: '+919811111102', source: 'GOOGLE_MAPS' as const, eventType: 'RECEPTION' as const,  stageKey: 'site_visit',  guests: 200, daysAgo: 1,  ownerId: agent2.id, score: 64,    band: 'WARM' as const },
    { name: 'Rohan Mehta',       phone: '+919811111103', source: 'WEBSITE' as const,     eventType: 'ENGAGEMENT' as const, stageKey: 'quotation',   guests: 120, daysAgo: 2,  ownerId: agent1.id, score: 55,    band: 'WARM' as const },
    { name: 'Kapoor Family',     phone: '+919811111104', source: 'JUSTDIAL' as const,    eventType: 'SANGEET' as const,    stageKey: 'negotiation', guests: 300, daysAgo: 0,  ownerId: agent2.id, score: 72,    band: 'WARM' as const },
    { name: 'Anita & Dev',       phone: '+919811111105', source: 'WEDMEGOOD' as const,   eventType: 'WEDDING' as const,    stageKey: 'confirmed',   guests: 600, daysAgo: 3,  ownerId: agent1.id, score: 91,    band: 'HOT' as const },
    { name: 'Priya & Aman',      phone: '+919811111106', source: 'WEDMEGOOD' as const,   eventType: 'WEDDING' as const,    stageKey: 'site_visit',  guests: 300, daysAgo: 1,  ownerId: agent1.id, score: 86,    band: 'HOT' as const },
    { name: 'Sharma Family',     phone: '+919811111107', source: 'GOOGLE_MAPS' as const, eventType: 'WEDDING' as const,    stageKey: 'contacted',   guests: 400, daysAgo: 2,  ownerId: agent2.id, score: 64,    band: 'WARM' as const },
    { name: 'V. Joshi',          phone: '+919811111108', source: 'JUSTDIAL' as const,    eventType: 'WEDDING' as const,    stageKey: 'new',         guests: 150, daysAgo: 4,  ownerId: null,      score: 38,    band: 'COLD' as const },
    { name: 'Mehta Celebrations',phone: '+919811111109', source: 'WEBSITE' as const,     eventType: 'RECEPTION' as const,  stageKey: 'contacted',   guests: 250, daysAgo: 3,  ownerId: agent1.id, score: null,  band: 'UNSCORED' as const },
    { name: 'Riya & Arjun',      phone: '+919811111110', source: 'WEDMEGOOD' as const,   eventType: 'WEDDING' as const,    stageKey: 'quotation',   guests: 500, daysAgo: 5,  ownerId: agent2.id, score: 78,    band: 'WARM' as const },
    { name: 'Gupta Wedding',     phone: '+919811111111', source: 'JUSTDIAL' as const,    eventType: 'WEDDING' as const,    stageKey: 'new',         guests: 350, daysAgo: 1,  ownerId: null,      score: null,  band: 'UNSCORED' as const },
    { name: 'Aisha & Kabir',     phone: '+919811111112', source: 'GOOGLE_MAPS' as const, eventType: 'RECEPTION' as const,  stageKey: 'site_visit',  guests: 180, daysAgo: 6,  ownerId: agent1.id, score: 69,    band: 'WARM' as const },
    { name: 'Singh Sangeet',     phone: '+919811111113', source: 'WEBSITE' as const,     eventType: 'SANGEET' as const,    stageKey: 'negotiation', guests: 220, daysAgo: 2,  ownerId: agent2.id, score: 82,    band: 'HOT' as const },
    { name: 'Patel & Sons',      phone: '+919811111114', source: 'WEDMEGOOD' as const,   eventType: 'BIRTHDAY' as const,   stageKey: 'confirmed',   guests: 100, daysAgo: 7,  ownerId: agent1.id, score: 95,    band: 'HOT' as const },
    { name: 'Nair Family',       phone: '+919811111115', source: 'REFERRAL' as const,    eventType: 'ENGAGEMENT' as const, stageKey: 'new',         guests: 80,  daysAgo: 0,  ownerId: null,      score: null,  band: 'UNSCORED' as const },
  ];

  const createdLeads: Record<string, any> = {};
  for (const l of leadsData) {
    const existing = await prisma.lead.findFirst({ where: { primaryPhone: l.phone } });
    const createdAt = new Date(Date.now() - l.daysAgo * 24 * 60 * 60 * 1000);
    const lead = existing || await prisma.lead.create({
      data: {
        name: l.name,
        primaryPhone: l.phone,
        source: l.source,
        eventType: l.eventType,
        guestCount: l.guests,
        eventDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        stageId: stages[l.stageKey].id,
        status: stages[l.stageKey].isWon ? 'WON' : 'OPEN',
        ownerId: l.ownerId,
        score: l.score,
        scoreBand: l.band,
        lastContactAt: l.daysAgo === 0 ? new Date() : new Date(Date.now() - l.daysAgo * 24 * 60 * 60 * 1000),
        firstResponseAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
        createdAt,
      },
    });
    createdLeads[l.name] = lead;

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: 'LEAD_CREATED',
        title: 'Lead created',
        description: `Enquiry received from ${l.source}`,
        createdAt,
      },
    });
  }

  console.log('✅ Leads seeded');

  // ── Historical leads for analytics (creates 128 leads spread over past month) ──
  const historicalSources = ['WEDMEGOOD', 'WEDMEGOOD', 'WEDMEGOOD', 'WEDMEGOOD', 'GOOGLE_MAPS', 'GOOGLE_MAPS', 'WEBSITE', 'WEBSITE', 'JUSTDIAL', 'JUSTDIAL'] as const;
  const historicalEvents  = ['WEDDING', 'WEDDING', 'RECEPTION', 'SANGEET', 'ENGAGEMENT'] as const;
  const historicalStages  = ['new', 'contacted', 'site_visit', 'quotation', 'negotiation', 'confirmed', 'lost'] as const;

  for (let i = 0; i < 113; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const src = historicalSources[i % historicalSources.length];
    const evt = historicalEvents[i % historicalEvents.length];
    const stageIdx = Math.floor(Math.random() * historicalStages.length);
    const stageKey = historicalStages[stageIdx];
    const phone = `+9198111${String(200 + i).padStart(5, '0')}`;

    const existing = await prisma.lead.findFirst({ where: { primaryPhone: phone } });
    if (!existing) {
      await prisma.lead.create({
        data: {
          name: `Enquiry Lead ${i + 1}`,
          primaryPhone: phone,
          source: src,
          eventType: evt,
          guestCount: 100 + Math.floor(Math.random() * 500),
          eventDate: new Date(Date.now() + (60 + Math.floor(Math.random() * 180)) * 24 * 60 * 60 * 1000),
          stageId: stages[stageKey].id,
          status: stages[stageKey].isWon ? 'WON' : stages[stageKey].isLost ? 'LOST' : 'OPEN',
          scoreBand: 'UNSCORED',
          lastContactAt: createdAt,
          createdAt,
        },
      });
    }
  }

  console.log('✅ Historical leads seeded (113 additional for analytics)');

  // ── Messages (WhatsApp sent) ─────────────────────────────────────────────
  const welcomeTemplate = tplMap['Instant Welcome'];
  for (const [name, lead] of Object.entries(createdLeads)) {
    if (lead) {
      await prisma.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          status: 'READ',
          body: `Namaste 🙏 Thank you for your interest in Nahata Lawns! We'd love to host your special day.`,
          templateId: welcomeTemplate.id,
          trigger: 'LEAD_CREATED',
          sentAt: new Date(lead.createdAt.getTime() + 30 * 1000),
          deliveredAt: new Date(lead.createdAt.getTime() + 90 * 1000),
          readAt: new Date(lead.createdAt.getTime() + 300 * 1000),
          createdAt: new Date(lead.createdAt.getTime() + 30 * 1000),
        },
      });
    }
  }

  // Add more messages to hit the ~540 count for analytics
  const allLeads = await prisma.lead.findMany({ take: 100 });
  for (let i = 0; i < 525; i++) {
    const lead = allLeads[i % allLeads.length];
    await prisma.message.create({
      data: {
        leadId: lead.id,
        direction: 'OUTBOUND',
        channel: 'WHATSAPP',
        status: ['SENT', 'DELIVERED', 'READ'][i % 3] as any,
        body: 'Follow-up message from Nahata Lawns team.',
        trigger: 'NO_REPLY',
        sentAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('✅ Messages seeded');

  // ── Rich Call + AI Summary example (for Priya & Aman, score 86 HOT) ────
  const priyaAman = createdLeads['Priya & Aman'];
  if (priyaAman) {
    const existingCall = await prisma.call.findFirst({ where: { leadId: priyaAman.id } });
    if (!existingCall) {
      const call = await prisma.call.create({
        data: {
          leadId: priyaAman.id,
          userId: agent1.id,
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          fromNumber: '+914044444444',
          toNumber: priyaAman.primaryPhone,
          providerCallId: 'EX_DEMO_001',
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          answeredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10000),
          endedAt:   new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
          durationSec: 590,
          consentPlayed: true,
          transcript: 'Agent: Good morning, am I speaking with Priya? Priya: Yes, speaking. Agent: This is Sanjay from Nahata Lawns. You enquired about our venue for a wedding reception. Priya: Yes! We are looking for a December wedding, around week 2. We expect about 300 guests. Agent: Perfect. We have beautiful banquet spaces and lawns available. What is your budget range? Priya: We are looking at premium décor and catering. Budget is around 15 to 20 lakhs. Agent: That fits very well. We have a lovely package for you. Would you like to come for a site visit this weekend? Priya: Yes definitely! We are comparing with one more venue but Nahata Lawns is our top choice right now. Agent: Wonderful! I will send you the site visit confirmation. Can I share some décor photos as well? Priya: Please do, that would be great!',
        },
      });

      await prisma.callSummary.create({
        data: {
          callId: call.id,
          leadId: priyaAman.id,
          summary: 'Couple enquired about a December wedding reception for ~300 guests. Asked about premium décor and catering options. Sounded very interested and requested a site visit this weekend. Currently comparing with one other venue.',
          event: 'Wedding reception',
          guests: 300,
          eventDate: 'Dec · week 2',
          sentiment: 'Very interested',
          objections: 'Comparing with one other venue',
          nextAction: 'Schedule a site visit this weekend & share décor photos',
          rawModelOutput: {},
          model: 'mock-scorer-v1',
          promptVersion: 'v1',
        },
      });

      await prisma.leadScoreEvent.create({
        data: {
          leadId: priyaAman.id,
          callId: call.id,
          score: 86,
          band: 'HOT',
          factors: { buyingIntent: 90, budgetSignals: 85, eventDateClose: 80, engagement: 92, sentiment: 88, objections: 70, callLength: 90 },
          rationale: 'High buying intent with clear budget (15-20L), specific date (Dec week 2), and 300 guest count. Very engaged on call, only mild objection is comparing with one other venue. Long call duration indicates serious interest.',
          suggestedAction: 'Schedule a site visit this weekend & share décor photos',
          source: 'CALL',
          model: 'mock-scorer-v1',
        },
      });

      await prisma.activity.create({
        data: {
          leadId: priyaAman.id,
          userId: agent1.id,
          type: 'CALL_LOGGED',
          title: 'Outbound call completed',
          description: '9m 50s · Score updated to 86 (🔥 Hot)',
          meta: { durationSec: 590, score: 86 },
        },
      });

      await prisma.activity.create({
        data: {
          leadId: priyaAman.id,
          userId: agent1.id,
          type: 'SCORE_UPDATED',
          title: 'Lead scored 🔥 86 / 100 – HOT',
          description: 'AI scored after call. Suggested: Schedule a site visit this weekend & share décor photos',
          meta: { score: 86, band: 'HOT' },
        },
      });
    }
  }

  console.log('✅ Call intelligence example seeded');

  console.log('\n🎉 Seeding complete! Nahata Lawns CRM is ready.');
  console.log(`\n📧 Login: ${process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com'}`);
  console.log(`🔑 Password: ${process.env.SEED_OWNER_PASSWORD || 'NahataOwner2024!'}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
