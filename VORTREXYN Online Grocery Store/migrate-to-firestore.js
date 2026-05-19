// migrate-to-firestore.js
// One-time script: copies all products from PostgreSQL → Firestore.
// Run this BEFORE deleting the Replit project:
//   cd "VORTREXYN Online Grocery Store" && node migrate-to-firestore.js
require('dotenv').config();
const { Pool } = require('pg');
const admin = require('./config/firebase-admin');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db   = admin.firestore();

async function migrate() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY product_id');
  console.log(`Migrating ${rows.length} products to Firestore...`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      const ref = db.collection('products').doc(String(p.product_id));
      batch.set(ref, {
        product_id:     parseInt(p.product_id),
        product_name:   p.product_name,
        unit_price:     parseFloat(p.unit_price),
        unit_quantity:  p.unit_quantity,
        in_stock:       parseInt(p.in_stock),
        image_filename: p.image_filename || null
      });
    }
    await batch.commit();
    console.log(`  Committed ${i + chunk.length} / ${rows.length}`);
  }

  console.log('Migration complete!');
  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
