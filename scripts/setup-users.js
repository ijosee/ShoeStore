const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no definida.');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/setup-users.js');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STORE_MON = 'a1b2c3d4-1111-4111-a111-000000000001';
const STORE_MOR = 'a1b2c3d4-1111-4111-a111-000000000002';

async function main() {
  // Create Jose (admin)
  const { data: jose, error: e1 } = await sb.auth.admin.createUser({
    email: 'jose@shoestore.com',
    password: 'Admin123!',
    email_confirm: true,
  });
  if (e1) { console.error('Jose error:', e1.message); return; }
  console.log('Jose created:', jose.user.id);

  // Create Rocio (seller)
  const { data: rocio, error: e2 } = await sb.auth.admin.createUser({
    email: 'rocio@shoestore.com',
    password: 'Vendedor1!',
    email_confirm: true,
  });
  if (e2) { console.error('Rocio error:', e2.message); return; }
  console.log('Rocio created:', rocio.user.id);

  // Insert into public.users
  const { error: e3 } = await sb.from('users').insert([
    { id: jose.user.id, email: 'jose@shoestore.com', full_name: 'Jose', role: 'admin' },
    { id: rocio.user.id, email: 'rocio@shoestore.com', full_name: 'Rocio', role: 'seller' },
  ]);
  if (e3) console.error('Users insert error:', e3.message);
  else console.log('Public users created');

  // Assign stores
  const { error: e4 } = await sb.from('user_stores').insert([
    { user_id: jose.user.id, store_id: STORE_MON },
    { user_id: jose.user.id, store_id: STORE_MOR },
    { user_id: rocio.user.id, store_id: STORE_MON },
    { user_id: rocio.user.id, store_id: STORE_MOR },
  ]);
  if (e4) console.error('Store assign error:', e4.message);
  else console.log('Stores assigned');

  // Re-insert products with Jose as created_by
  console.log('Jose ID for products:', jose.user.id);
  console.log('Done! Login with jose@shoestore.com / Admin123!');
}

main().catch(console.error);
