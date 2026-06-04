/**
 * reset-leads.ts
 * Clears ALL lead-related data and inserts exactly 2 clean demo leads.
 * Usage: npx ts-node scripts/reset-leads.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all lead data...');

  // Delete in dependency order
  await db.scheduledMessage.deleteMany({});
  await db.sequenceEnrollment.deleteMany({});
  await db.leadScoreEvent.deleteMany({});
  await db.callSummary.deleteMany({});
  await db.call.deleteMany({});
  await db.message.deleteMany({});
  await db.activity.deleteMany({});
  await db.lead.deleteMany({});

  console.log('✅ All leads and related records deleted');

  // Get the default "New Lead" stage
  const newStage = await db.stage.findFirst({ where: { key: 'new' } });
  const siteVisitStage = await db.stage.findFirst({ where: { key: 'site_visit' } });
  const agent = await db.user.findFirst({ where: { role: 'AGENT' } });

  if (!newStage) throw new Error('Default stage not found — run pnpm db:seed first');

  // Create 2 clean demo leads
  const lead1 = await db.lead.create({
    data: {
      name: 'Priya & Aakash',
      primaryPhone: '+919811111101',
      email: 'priya.aakash@example.com',
      source: 'WEDMEGOOD',
      eventType: 'WEDDING',
      guestCount: 450,
      eventDate: new Date('2025-12-15'),
      budgetMin: 1500000,
      budgetMax: 2000000,
      stageId: newStage.id,
      status: 'OPEN',
      ownerId: agent?.id,
      notes: 'Looking for a December wedding. Interested in premium decor and catering. Requested a site visit.',
    },
  });

  await db.activity.create({
    data: {
      leadId: lead1.id,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      description: 'Enquiry received from WedMeGood',
    },
  });

  await db.message.create({
    data: {
      leadId: lead1.id,
      direction: 'OUTBOUND',
      channel: 'WHATSAPP',
      status: 'READ',
      body: 'Namaste Priya 🙏 Thank you for your interest in Nahata Lawns! We\'d love to host your special day. May we know your event date & guest count?',
      trigger: 'LEAD_CREATED',
      sentAt: new Date(),
      deliveredAt: new Date(Date.now() + 60000),
      readAt: new Date(Date.now() + 300000),
    },
  });

  console.log(`✅ Lead 1 created: ${lead1.name} (${lead1.id})`);

  const lead2 = await db.lead.create({
    data: {
      name: 'Kapoor Family',
      primaryPhone: '+919811111104',
      email: 'kapoor.family@example.com',
      source: 'JUSTDIAL',
      eventType: 'SANGEET',
      guestCount: 300,
      eventDate: new Date('2025-11-20'),
      budgetMin: 800000,
      budgetMax: 1200000,
      stageId: siteVisitStage?.id || newStage.id,
      status: 'OPEN',
      ownerId: agent?.id,
      notes: 'Family event for Sangeet ceremony. Prefers outdoor setting. Already visited once.',
      score: 72,
      scoreBand: 'WARM',
    },
  });

  await db.activity.create({
    data: {
      leadId: lead2.id,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      description: 'Enquiry received from JustDial',
    },
  });

  await db.activity.create({
    data: {
      leadId: lead2.id,
      type: 'STAGE_CHANGE',
      title: 'Moved to Site Visit',
      meta: { fromStageName: 'New Lead', toStageName: 'Site Visit' } as any,
    },
  });

  await db.message.create({
    data: {
      leadId: lead2.id,
      direction: 'OUTBOUND',
      channel: 'WHATSAPP',
      status: 'DELIVERED',
      body: 'Hi Kapoor ji, your site visit is confirmed. Our team will welcome you at the gate. Looking forward to showing you the lawns! 🌿',
      trigger: 'STAGE_CHANGED',
      sentAt: new Date(),
      deliveredAt: new Date(Date.now() + 60000),
    },
  });

  console.log(`✅ Lead 2 created: ${lead2.name} (${lead2.id})`);

  console.log('\n🎉 Done! Database now has exactly 2 demo leads:');
  console.log(`   1. ${lead1.name} — WedMeGood — Wedding 450 pax — New Lead`);
  console.log(`   2. ${lead2.name} — JustDial — Sangeet 300 pax — Site Visit (score 72 🤗)`);
  console.log('\n   Now test CRUD:');
  console.log('   CREATE → click "+ New Lead" in the app');
  console.log('   READ   → open the Leads page');
  console.log('   UPDATE → click a lead, change stage or add a note');
  console.log('   DELETE → PATCH /leads/:id/status with status=LOST');
}

main()
  .then(() => db.$disconnect())
  .catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
