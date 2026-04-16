const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no definida.');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-images.js');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Unsplash images for each product (free to use)
const productImages = [
  { name: 'Nike Air Max 90', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop' },
  { name: 'Adidas Ultraboost 22', url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=800&fit=crop' },
  { name: 'Clarks Oxford Premium', url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&h=800&fit=crop' },
  { name: 'Geox Nebula', url: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&h=800&fit=crop' },
  { name: 'Skechers Go Walk 6', url: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&h=800&fit=crop' },
  { name: 'Nike Sunray Adjust', url: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=800&h=800&fit=crop' },
  { name: 'Clarks Desert Boot', url: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=800&h=800&fit=crop' },
  { name: 'Pablosky Colegial', url: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&h=800&fit=crop' },
  { name: 'Adidas Stan Smith', url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=800&fit=crop' },
  { name: 'Geox Mocasín Symbol', url: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&h=800&fit=crop' },
];

async function main() {
  // Get all products
  const { data: products, error } = await sb.from('products').select('id, name').order('name');
  if (error) { console.error(error.message); return; }

  for (const product of products) {
    const imageInfo = productImages.find(p => p.name === product.name);
    if (!imageInfo) {
      console.log(`⚠ No image for: ${product.name}`);
      continue;
    }

    // Check if product already has images
    const { count } = await sb.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', product.id);
    if (count && count > 0) {
      console.log(`⏭ ${product.name} already has images`);
      continue;
    }

    // Insert image record (using external URL directly, no upload needed)
    const { error: imgError } = await sb.from('product_images').insert({
      product_id: product.id,
      image_url: imageInfo.url,
      thumbnail_url: imageInfo.url.replace('w=800&h=800', 'w=200&h=200'),
      sort_order: 0,
      is_primary: true,
    });

    if (imgError) {
      console.error(`✗ ${product.name}: ${imgError.message}`);
    } else {
      console.log(`✓ ${product.name}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
