/**
 * Production setup — runs after first deploy on Render.
 * Seeds the owner user and default data if DB is empty.
 * Safe to run multiple times (uses upsert).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new PrismaClient();

async function main() {
  console.log('🌿 Running production setup...');

  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@nahatalawns.com';
  const ownerPass  = process.env.SEED_OWNER_PASSWORD || 'NahataOwner2024!';

  const existing = await db.user.findUnique({ where: { email: ownerEmail } });
  if (!existing) {
    const hash = await bcrypt.hash(ownerPass, 12);
    await db.user.create({
      data: { name: 'Nahata Lawns Owner', email: ownerEmail, passwordHash: hash, role: 'OWNER', isActive: true },
    });
    console.log(`✅ Owner created: ${ownerEmail}`);
  } else {
    console.log(`✅ Owner already exists: ${ownerEmail}`);
  }

  // Ensure default stages exist
  const stageCount = await db.stage.count();
  if (stageCount === 0) {
    console.log('📋 Running full seed for fresh DB...');
    // Import and run the seed script
    require('../../prisma/seed');
  }

  console.log('✅ Production setup complete.');
}

main().then(() => db.$disconnect()).catch(e => { console.error(e); process.exit(1); });
