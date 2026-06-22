const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:anantkamal2002@localhost:5432/nahata'
});

async function runQueries() {
  try {
    await client.connect();
    console.log('\n=== TEST 7: Flow Response - Lead Data Updated ===');

    // Query the lead with the specific phone
    const leadResult = await client.query(
      'SELECT id, name, "eventType", "guestCount", "budgetMin", "budgetMax", "eventDate", notes FROM "Lead" WHERE "primaryPhone" = $1',
      ['+919876543210']
    );

    if (leadResult.rows.length === 0) {
      console.log('❌ NO LEAD FOUND');
    } else {
      const lead = leadResult.rows[0];
      console.log('✅ Lead found and updated:');
      console.log(`   ID: ${lead.id}`);
      console.log(`   Name: ${lead.name}`);
      console.log(`   EventType: ${lead.eventType}`);
      console.log(`   Guest Count: ${lead.guestCount}`);
      console.log(`   Budget Min: ${lead.budgetMin}`);
      console.log(`   Budget Max: ${lead.budgetMax}`);
      console.log(`   Event Date: ${lead.eventDate}`);
      console.log(`   Notes: ${lead.notes}`);

      // Validate expected values
      console.log('\n✅ Validation:');
      if (lead.eventType === 'WEDDING') console.log('   ✓ eventType is WEDDING');
      else console.log(`   ✗ eventType is ${lead.eventType}, expected WEDDING`);

      if (lead.guestCount === 300) console.log('   ✓ guestCount is 300');
      else console.log(`   ✗ guestCount is ${lead.guestCount}, expected 300`);

      if (lead.budgetMin === 1000000) console.log('   ✓ budgetMin is 1000000');
      else console.log(`   ✗ budgetMin is ${lead.budgetMin}, expected 1000000`);

      if (lead.budgetMax === 2000000) console.log('   ✓ budgetMax is 2000000');
      else console.log(`   ✗ budgetMax is ${lead.budgetMax}, expected 2000000`);

      if (lead.eventDate && lead.eventDate.includes('2025-06-15')) console.log('   ✓ eventDate is 2025-06-15');
      else console.log(`   ✗ eventDate is ${lead.eventDate}, expected 2025-06-15`);

      if (lead.notes && lead.notes.includes('Delhi')) console.log('   ✓ location (Delhi) appended to notes');
      else console.log(`   ✗ notes doesn't contain Delhi: ${lead.notes}`);
    }

    // Check if Flow message was stored
    console.log('\n=== Flow Message Storage ===');
    const flowMsgResult = await client.query(
      'SELECT id, "providerMessageId", body, "createdAt" FROM "Message" WHERE "providerMessageId" = $1',
      ['wamid.test.flow_001']
    );

    if (flowMsgResult.rows.length === 0) {
      console.log('❌ Flow message not found');
    } else {
      const msg = flowMsgResult.rows[0];
      console.log('✅ Flow message stored:');
      console.log(`   ID: ${msg.id}`);
      console.log(`   ProviderMessageId: ${msg.providerMessageId}`);
      console.log(`   Body: ${msg.body}`);
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runQueries();
