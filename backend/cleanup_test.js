const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:anantkamal2002@localhost:5432/nahata'
});

async function cleanup() {
  try {
    await client.connect();
    console.log('Cleaning up test data...');

    // Get the lead ID first
    const leadResult = await client.query(
      'SELECT id FROM "Lead" WHERE "primaryPhone" = $1',
      ['+919876543210']
    );

    if (leadResult.rows.length > 0) {
      const leadId = leadResult.rows[0].id;

      // Delete messages for this lead
      await client.query('DELETE FROM "Message" WHERE "leadId" = $1', [leadId]);
      console.log('✅ Deleted messages');

      // Delete the lead
      await client.query('DELETE FROM "Lead" WHERE id = $1', [leadId]);
      console.log('✅ Deleted lead');
    } else {
      console.log('No test data found');
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

cleanup();
