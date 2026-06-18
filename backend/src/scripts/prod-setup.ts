import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🌿 Running production setup...');

  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com';
  const ownerPass = process.env.SEED_OWNER_PASSWORD || 'NahataOwner2024!';

  const existing = await pool.query('SELECT * FROM "User" WHERE email = $1', [ownerEmail]);

  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(ownerPass, 12);
    const now = new Date();
    await pool.query(
      'INSERT INTO "User" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), 'Nahata Lawns Owner', ownerEmail, hash, 'OWNER', true, now, now]
    );
    console.log(`✅ Owner created: ${ownerEmail}`);
  } else {
    console.log(`✅ Owner already exists: ${ownerEmail}`);
  }

  // Ensure default stages exist
  const stageCount = await pool.query('SELECT COUNT(*) FROM "Stage"');
  if (stageCount.rows[0].count === 0) {
    console.log('📋 Running full seed for fresh DB...');
    await seedDatabase();
  }

  console.log('✅ Production setup complete.');
  await pool.end();
}

async function seedDatabase() {
  // Users
  const ownerHash = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || 'NahataOwner2024!', 12);
  const managerHash = await bcrypt.hash('Manager2024!', 12);
  const agent1Hash = await bcrypt.hash('Agent2024!', 12);
  const agent2Hash = await bcrypt.hash('Agent2024!', 12);
  const now = new Date();

  const owner = { id: uuidv4(), name: 'Nahata Lawns Owner', email: process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com', phone: '+919876543210', passwordHash: ownerHash, role: 'OWNER' };
  const manager = { id: uuidv4(), name: 'Vikram Sharma', email: 'manager@nahatalawns.com', phone: '+919876543211', passwordHash: managerHash, role: 'MANAGER' };
  const agent1 = { id: uuidv4(), name: 'S. Iyer', email: 'siyer@nahatalawns.com', phone: '+919876543212', passwordHash: agent1Hash, role: 'AGENT' };
  const agent2 = { id: uuidv4(), name: 'M. Joshi', email: 'mjoshi@nahatalawns.com', phone: '+919876543213', passwordHash: agent2Hash, role: 'AGENT' };

  for (const u of [owner, manager, agent1, agent2]) {
    await pool.query(
      'INSERT INTO "User" (id, name, email, phone, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (email) DO NOTHING',
      [u.id, u.name, u.email, u.phone, u.passwordHash, u.role, true, now, now]
    );
  }
  console.log('✅ Users seeded');

  // Stages
  const stagesData = [
    { name: 'New Lead', key: 'new', order: 1, color: '#64748b', isDefault: true },
    { name: 'Contacted', key: 'contacted', order: 2, color: '#0ea5e9' },
    { name: 'Site Visit', key: 'site_visit', order: 3, color: '#8b5cf6' },
    { name: 'Quotation', key: 'quotation', order: 4, color: '#f59e0b' },
    { name: 'Negotiation', key: 'negotiation', order: 5, color: '#ec4899' },
    { name: 'Confirmed', key: 'confirmed', order: 6, color: '#16a34a', isWon: true },
    { name: 'Lost / Not Interested', key: 'lost', order: 7, color: '#94a3b8', isLost: true },
  ];

  const stages: Record<string, string> = {};
  for (const s of stagesData) {
    const id = uuidv4();
    stages[s.key] = id;
    await pool.query(
      `INSERT INTO "Stage" (id, name, key, "order", color, "isWon", "isLost", "isDefault", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (key) DO UPDATE SET name = $2, "order" = $4, color = $5`,
      [id, s.name, s.key, s.order, s.color, (s as any).isWon || false, (s as any).isLost || false, (s as any).isDefault || false, now, now]
    );
  }
  console.log('✅ Stages seeded');

  // Template Groups & Templates
  const tgData = [
    { name: 'Welcome & Enquiry', icon: '👋', color: '#0ea5e9', order: 1 },
    { name: 'Follow-up Reminders', icon: '🔔', color: '#f59e0b', order: 2 },
    { name: 'Site Visit', icon: '🌿', color: '#8b5cf6', order: 3 },
    { name: 'Quotation & Pricing', icon: '📋', color: '#ec4899', order: 4 },
    { name: 'Booking Confirmed', icon: '🎉', color: '#16a34a', order: 5 },
  ];

  const tgMap: Record<string, string> = {};
  for (const tgd of tgData) {
    const id = uuidv4();
    tgMap[tgd.name] = id;
    await pool.query(
      `INSERT INTO "TemplateGroup" (id, name, icon, color, "order", "isSystem", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [id, tgd.name, tgd.icon, tgd.color, tgd.order, true, now, now]
    );
  }

  // Add templates
  const templates = [
    { group: 'Welcome & Enquiry', name: 'Instant Welcome', body: 'Namaste {Name} 🙏 Thank you for your interest in Nahata Lawns! We\'d love to host your special day. May we know your event date & guest count?', order: 1 },
    { group: 'Follow-up Reminders', name: 'Gentle Reminder – Day 2', body: 'Hi {Name}, just checking in about your event at Nahata Lawns. We\'d love to answer any questions and help you plan your perfect day. Shall we schedule a quick call? 😊', order: 1 },
    { group: 'Site Visit', name: 'Site Visit Confirmation', body: 'Hi {Name}, your site visit is confirmed for {Date} 🌿 Our team will welcome you at the gate. Looking forward to showing you the lawns! Please carry a photo ID. See you soon!', order: 1 },
    { group: 'Booking Confirmed', name: 'Booking Confirmation', body: 'Congratulations {Name}! 🎉 Your booking is confirmed at Nahata Lawns. We are thrilled to host your {EventType}! Here are your next steps and our contact for any help. Welcome to the Nahata family! 🌿', order: 1 },
  ];

  const tplMap: Record<string, string> = {};
  for (const t of templates) {
    const id = uuidv4();
    tplMap[t.name] = id;
    await pool.query(
      `INSERT INTO "Template" (id, "groupId", name, channel, body, language, "order", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [id, tgMap[t.group], t.name, 'WHATSAPP', t.body, 'en', t.order, true, now, now]
    );
  }
  console.log('✅ Templates seeded');

  // Stage bindings
  const bindings = [
    { stageKey: 'new', templateName: 'Instant Welcome' },
    { stageKey: 'site_visit', templateName: 'Site Visit Confirmation' },
    { stageKey: 'confirmed', templateName: 'Booking Confirmation' },
  ];

  for (const b of bindings) {
    if (stages[b.stageKey] && tplMap[b.templateName]) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO "StageMessageBinding" (id, "stageId", "templateId", channel, enabled, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("stageId") DO UPDATE SET "templateId" = $3, enabled = $5`,
        [id, stages[b.stageKey], tplMap[b.templateName], 'WHATSAPP', true, now, now]
      );
    }
  }
  console.log('✅ Stage bindings seeded');

  // Settings
  const settings = [
    { key: 'venueName', value: 'Nahata Lawns' },
    { key: 'timezone', value: 'Asia/Kolkata' },
    { key: 'currency', value: 'INR' },
    { key: 'defaultCountryCode', value: '+91' },
    { key: 'consentText', value: 'This call may be recorded for quality and training purposes.' },
  ];

  for (const s of settings) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO "Setting" (id, key, value, "updatedAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = $3`,
      [id, s.key, JSON.stringify(s.value), now]
    );
  }
  console.log('✅ Settings seeded');
}

main().catch(e => { console.error(e); process.exit(1); });
