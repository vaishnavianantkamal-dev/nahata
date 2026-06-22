const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:anantkamal2002@localhost:5432/nahata'
});

async function runQueries() {
  try {
    await client.connect();
    console.log('\n=== TEST 4: Lead Created ===');

    // Query leads with WhatsApp phone
    const leadResult = await client.query(
      'SELECT id, name, "primaryPhone", source, "stageId", "createdAt" FROM "Lead" WHERE "primaryPhone" = $1 ORDER BY "createdAt" DESC LIMIT 1',
      ['+919876543210']
    );

    if (leadResult.rows.length === 0) {
      console.log('❌ NO LEAD FOUND');
    } else {
      const lead = leadResult.rows[0];
      console.log('✅ Lead found:');
      console.log(`   ID: ${lead.id}`);
      console.log(`   Name: ${lead.name}`);
      console.log(`   Phone: ${lead.primaryPhone}`);
      console.log(`   Source: ${lead.source}`);
      console.log(`   Created: ${lead.createdAt}`);

      // Get stage name
      const stageResult = await client.query('SELECT name FROM "Stage" WHERE id = $1', [lead.stageId]);
      if (stageResult.rows.length > 0) {
        console.log(`   Stage: ${stageResult.rows[0].name}`);
      }

      // Query messages for this lead
      const msgResult = await client.query(
        'SELECT id, direction, channel, status, body, "providerMessageId", "createdAt" FROM "Message" WHERE "leadId" = $1 AND "providerMessageId" = $2',
        [lead.id, 'wamid.test.msg_001']
      );

      if (msgResult.rows.length === 0) {
        console.log('❌ NO MESSAGE FOUND');
      } else {
        const msg = msgResult.rows[0];
        console.log('\n✅ Message found:');
        console.log(`   Direction: ${msg.direction}`);
        console.log(`   Channel: ${msg.channel}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Body: ${msg.body}`);
        console.log(`   ProviderMessageId: ${msg.providerMessageId}`);
      }
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runQueries();
