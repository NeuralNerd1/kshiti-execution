const { Client } = require('pg');

async function main() {
    const c = new Client({
        connectionString: 'postgresql://postgres.izabcheevqretdbnbamp:Copperstone@l1202@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
    });
    await c.connect();

    const r = await c.query(
        'SELECT run_id, status, logs, payload FROM exec_runs ORDER BY start_time DESC LIMIT 4'
    );

    for (const row of r.rows) {
        const p = row.payload || {};
        const cfg = p.config || {};
        console.log('=== Run:', row.run_id);
        console.log('Status:', row.status);
        console.log('headlessDefault:', cfg.headlessDefault, '(type:', typeof cfg.headlessDefault + ')');
        console.log('defaultBrowser:', cfg.defaultBrowser);
        console.log('Logs:', JSON.stringify(row.logs));
        console.log('---');
    }

    await c.end();
}

main().catch(e => console.error('Error:', e.message));
