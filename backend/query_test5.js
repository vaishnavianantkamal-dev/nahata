const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:anantkamal2002@localhost:5432/nahata'
});

async function runQueries() {
  try {
    await client.connect();
    console.log('\n=== TEST 5: Idempotency Check ===');

    // Count total leads with this phone
    const leadCountResult = await client.query(
      'SELECT COUNT(*) as count FROM "Lead" WHERE "primaryPhone" = $1',
      ['+919876543210']
    );
    const leadCount = parseInt(leadCountResult.rows[0].count);
    console.log(`Total Leads with +919876543210: ${leadCount}`);
    if (leadCount === 1) {
      console.log('✅ Only ONE lead (no duplicate created)');
    } else {
      console.log(`❌ Expected 1 lead, found ${leadCount}`);
    }

    // Count messages with the specific providerMessageId
    const msgCountResult = await client.query(
      'SELECT COUNT(*) as count FROM "Message" WHERE "providerMessageId" = $1',
      ['wamid.test.msg_001']
    );
    const msgCount = parseInt(msgCountResult.rows[0].count);
    console.log(`\nMessages with providerMessageId 'wamid.test.msg_001': ${msgCount}`);
    if (msgCount === 1) {
      console.log('✅ Only ONE message (idempotency working - duplicate skipped)');
    } else {
      console.log(`❌ Expected 1 message, found ${msgCount}`);
    }

    // Show the message record
    const msgResult = await client.query(
      'SELECT id, "leadId", direction, body, "providerMessageId", "createdAt" FROM "Message" WHERE "providerMessageId" = $1',
      ['wamid.test.msg_001']
    );
    if (msgResult.rows.length > 0) {
      const msg = msgResult.rows[0];
      console.log('\nMessage Details:');
      console.log(`   ID: ${msg.id}`);
      console.log(`   LeadId: ${msg.leadId}`);
      console.log(`   Body: ${msg.body}`);
      console.log(`   Created: ${msg.createdAt}`);
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runQueries();
