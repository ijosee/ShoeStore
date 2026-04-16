const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no definida.');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-products.js');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STORE_MON = 'a1b2c3d4-1111-4111-a111-000000000001';
const STORE_MOR = 'a1b2c3d4-1111-4111-a111-000000000002';

// Brand/Category/Size/Color IDs from seed
const B = { nike:'e1b2c3d4-1111-4111-a111-000000000001', adidas:'e1b2c3d4-1111-4111-a111-000000000002', clarks:'e1b2c3d4-1111-4111-a111-000000000003', geox:'e1b2c3d4-1111-4111-a111-000000000004', skechers:'e1b2c3d4-1111-4111-a111-000000000005', pablosky:'e1b2c3d4-1111-4111-a111-000000000006' };
const C = { formal:'d1b2c3d4-1111-4111-a111-000000000001', deportivo:'d1b2c3d4-1111-4111-a111-000000000002', casual:'d1b2c3d4-1111-4111-a111-000000000003', sandalia:'d1b2c3d4-1111-4111-a111-000000000004', bota:'d1b2c3d4-1111-4111-a111-000000000005', infantil:'d1b2c3d4-1111-4111-a111-000000000006' };
const S = { 35:'b1b2c3d4-1111-4111-a111-000000000001', 36:'b1b2c3d4-1111-4111-a111-000000000002', 37:'b1b2c3d4-1111-4111-a111-000000000003', 38:'b1b2c3d4-1111-4111-a111-000000000004', 39:'b1b2c3d4-1111-4111-a111-000000000005', 40:'b1b2c3d4-1111-4111-a111-000000000006', 41:'b1b2c3d4-1111-4111-a111-000000000007', 42:'b1b2c3d4-1111-4111-a111-000000000008', 43:'b1b2c3d4-1111-4111-a111-000000000009', 44:'b1b2c3d4-1111-4111-a111-000000000010' };
const CO = { negro:'c1b2c3d4-1111-4111-a111-000000000001', marron:'c1b2c3d4-1111-4111-a111-000000000002', blanco:'c1b2c3d4-1111-4111-a111-000000000003', rojo:'c1b2c3d4-1111-4111-a111-000000000004', azul:'c1b2c3d4-1111-4111-a111-000000000005', gris:'c1b2c3d4-1111-4111-a111-000000000006', beige:'c1b2c3d4-1111-4111-a111-000000000007', verde:'c1b2c3d4-1111-4111-a111-000000000008' };

const products = [
  { name:'Nike Air Max 90', brand:B.nike, cat:C.deportivo, desc:'Zapatilla deportiva icónica con cámara de aire visible.', price:149.95, cost:75, variants:[{size:S[40],color:CO.negro,sku:'DEP-NIK-40-NEG',mon:8,mor:5},{size:S[41],color:CO.blanco,sku:'DEP-NIK-41-BLA',mon:6,mor:4}] },
  { name:'Adidas Ultraboost 22', brand:B.adidas, cat:C.deportivo, desc:'Zapatilla de running con tecnología Boost.', price:179.95, cost:90, variants:[{size:S[42],color:CO.negro,sku:'DEP-ADI-42-NEG',mon:4,mor:3},{size:S[40],color:CO.azul,sku:'DEP-ADI-40-AZU',mon:5,mor:7}] },
  { name:'Clarks Oxford Premium', brand:B.clarks, cat:C.formal, desc:'Zapato Oxford de piel genuina para ocasiones formales.', price:129.95, cost:65, variants:[{size:S[41],color:CO.negro,sku:'FOR-CLA-41-NEG',mon:5,mor:3},{size:S[42],color:CO.marron,sku:'FOR-CLA-42-MAR',mon:3,mor:4}] },
  { name:'Geox Nebula', brand:B.geox, cat:C.casual, desc:'Zapato casual transpirable con tecnología Geox.', price:109.95, cost:55, variants:[{size:S[40],color:CO.gris,sku:'CAS-GEO-40-GRI',mon:10,mor:6}] },
  { name:'Skechers Go Walk 6', brand:B.skechers, cat:C.casual, desc:'Zapatilla ultraligera para caminar con plantilla Goga Mat.', price:79.95, cost:40, variants:[{size:S[39],color:CO.negro,sku:'CAS-SKE-39-NEG',mon:12,mor:8},{size:S[38],color:CO.beige,sku:'CAS-SKE-38-BEI',mon:7,mor:5}] },
  { name:'Nike Sunray Adjust', brand:B.nike, cat:C.sandalia, desc:'Sandalia deportiva con cierre de velcro.', price:39.95, cost:20, variants:[{size:S[37],color:CO.azul,sku:'SAN-NIK-37-AZU',mon:15,mor:10}] },
  { name:'Clarks Desert Boot', brand:B.clarks, cat:C.bota, desc:'Botín clásico de ante con suela de crepé.', price:139.95, cost:70, variants:[{size:S[42],color:CO.marron,sku:'BOT-CLA-42-MAR',mon:3,mor:2},{size:S[43],color:CO.negro,sku:'BOT-CLA-43-NEG',mon:4,mor:5}] },
  { name:'Pablosky Colegial', brand:B.pablosky, cat:C.infantil, desc:'Zapato escolar de piel con puntera reforzada.', price:54.95, cost:28, variants:[{size:S[35],color:CO.negro,sku:'INF-PAB-35-NEG',mon:20,mor:18},{size:S[36],color:CO.marron,sku:'INF-PAB-36-MAR',mon:15,mor:12}] },
  { name:'Adidas Stan Smith', brand:B.adidas, cat:C.casual, desc:'Zapatilla clásica de piel con suela de goma.', price:99.95, cost:50, variants:[{size:S[40],color:CO.blanco,sku:'CAS-ADI-40-BLA',mon:9,mor:7},{size:S[41],color:CO.verde,sku:'CAS-ADI-41-VER',mon:6,mor:5}] },
  { name:'Geox Mocasín Symbol', brand:B.geox, cat:C.formal, desc:'Mocasín de piel transpirable para uso diario y formal.', price:119.95, cost:60, variants:[{size:S[43],color:CO.negro,sku:'FOR-GEO-43-NEG',mon:6,mor:4}] },
];

async function main() {
  // Get Jose's ID
  const { data: jose } = await sb.from('users').select('id').eq('email','jose@shoestore.com').single();
  if (!jose) { console.error('Jose not found'); return; }
  console.log('Jose ID:', jose.id);

  for (const p of products) {
    // Insert product
    const { data: prod, error: pe } = await sb.from('products').insert({
      name: p.name, brand_id: p.brand, category_id: p.cat,
      description: p.desc, base_price: p.price, cost: p.cost,
      tax_rate: 0.21, is_active: true, created_by: jose.id
    }).select('id').single();

    if (pe) { console.error(`Product ${p.name}:`, pe.message); continue; }
    console.log(`✓ ${p.name} (${prod.id})`);

    for (const v of p.variants) {
      const { data: variant, error: ve } = await sb.from('product_variants').insert({
        product_id: prod.id, size_id: v.size, color_id: v.color,
        sku: v.sku, is_active: true
      }).select('id').single();

      if (ve) { console.error(`  Variant ${v.sku}:`, ve.message); continue; }

      // Stock in Montellano
      if (v.mon > 0) await sb.from('stock_levels').insert({ variant_id: variant.id, store_id: STORE_MON, quantity: v.mon, low_stock_threshold: 3 });
      // Stock in Morón
      if (v.mor > 0) await sb.from('stock_levels').insert({ variant_id: variant.id, store_id: STORE_MOR, quantity: v.mor, low_stock_threshold: 3 });
    }
  }
  console.log('\nDone! 10 products with stock created.');
}

main().catch(console.error);
