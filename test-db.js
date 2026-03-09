const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.izabcheevqretdbnbamp:Copperstone@l1202@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
});

async function check() {
  await client.connect();
  // Clean up any old PENDING runs to avoid blocking
  const updateRes = await client.query("UPDATE exec_runs SET status = 'FAILED', payload = jsonb_set(payload, '{error}', '\"Worker never picked up the run\"'::jsonb) WHERE status = 'PENDING' RETURNING run_id");
  console.log("Cleared stuck pending runs:", updateRes.rows);
  await client.end();
}
check().catch(console.error);
