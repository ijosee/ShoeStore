const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
if (!SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no definida.');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/set-passwords.js');
  process.exit(1);
}

async function updatePassword(userId, password) {
  const res = await fetch(`${BASE}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  return { status: res.status, ok: !!data.id, error: data.msg };
}

async function main() {
  const jose = await updatePassword('a1a1a1a1-1111-4111-a111-000000000001', 'Admin123!');
  console.log('Jose:', jose);

  const rocio = await updatePassword('a1a1a1a1-1111-4111-a111-000000000002', 'Vendedor1!');
  console.log('Rocio:', rocio);
}

main().catch(console.error);
