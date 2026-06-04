/**
 * simulate-leads.ts — Posts test lead payloads to each webhook source
 * Usage: npx ts-node scripts/simulate-leads.ts
 *
 * Useful for demoing the intake pipeline without a real provider.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

const samples = [
  {
    source: 'wedmegood',
    payload: {
      bridgeName: 'Kavya',
      groomName: 'Arjun Reddy',
      mobile: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`,
      email: 'kavya.arjun@example.com',
      functionType: 'wedding',
      guests: '350',
      eventDate: '2025-02-14',
      listing: 'Delhi Premium Lawns',
      enquiryId: `WMG_${Date.now()}`,
    },
  },
  {
    source: 'justdial',
    payload: {
      name: 'Sunita Kapoor',
      mobile: `+9199${Math.floor(10000000 + Math.random() * 89999999)}`,
      email: 'sunita.kapoor@example.com',
      category: 'Wedding Lawns',
      uniqueid: `JD_${Date.now()}`,
    },
  },
  {
    source: 'google_maps',
    payload: {
      name: 'Rahul & Pooja',
      phone: `+9197${Math.floor(10000000 + Math.random() * 89999999)}`,
      email: 'rahulpooja@example.com',
      message: 'Interested in booking for a December wedding, approximately 400 guests',
      conversationId: `GM_${Date.now()}`,
    },
  },
  {
    source: 'website',
    payload: {
      brideName: 'Meera',
      groomName: 'Vikram Nair',
      phone: `+9196${Math.floor(10000000 + Math.random() * 89999999)}`,
      email: 'meera.vikram@example.com',
      eventType: 'reception',
      guestCount: '250',
      eventDate: '2025-03-01',
      message: 'Looking for an elegant venue with outdoor spaces for an evening reception.',
    },
  },
];

async function simulateLeads() {
  console.log(`\n🌿 Simulating lead intake for Nahata Lawns CRM\n`);
  console.log(`   API: ${BASE_URL}\n`);

  for (const { source, payload } of samples) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/webhooks/leads/${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as any;
      console.log(`✅ ${source.padEnd(12)} → ${data.status === 'created' ? `Lead created: ${data.leadId}` : `Duplicate: ${data.leadId}`}`);
    } catch (err: any) {
      console.error(`❌ ${source.padEnd(12)} → Error: ${err.message}`);
    }
  }

  console.log(`\n✨ Done! Check the Leads inbox at http://localhost:5173/leads\n`);
}

simulateLeads();
