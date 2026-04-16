const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no definida.');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-users.js');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Update Jose's password via Admin API
  const { error: e1 } = await sb.auth.admin.updateUserById(
    'a1a1a1a1-1111-4111-a111-000000000001',
    { password: 'Admin123!' }
  );
  console.log('Jose password:', e1 ? e1.message : 'OK');

  // Update Rocio's password via Admin API
  const { error: e2 } = await sb.auth.admin.updateUserById(
    'a1a1a1a1-1111-4111-a111-000000000002',
    { password: 'Vendedor1!' }
  );
  console.log('Rocio password:', e2 ? e2.message : 'OK');
}

main();
