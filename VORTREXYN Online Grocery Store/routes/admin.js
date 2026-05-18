// ============================================================
// routes/admin.js — Admin dashboard (password-protected)
//
// Access: yoursite.com/admin  (not linked from the public store)
// Auth: Simple email+password checked against ADMIN_EMAIL / ADMIN_PASSWORD
//       env vars. Session flag req.session.admin is set on success.
//       This is separate from customer auth (req.session.user).
//
// Features:
//   - Dashboard with 4 stat cards (products, low stock, out of stock, users)
//   - Full product list with inline edit and delete
//   - Add product with AI-generated image (OpenAI gpt-image-1)
//   - Registered users list with tier badges
//   - Delete user (removes Firestore doc + Firebase Auth account)
//
// AI image generation:
//   Uses the OpenAI images.generate() API. Models are tried in order:
//   gpt-image-1 → dall-e-3 → dall-e-2 (fallback chain).
//   gpt-image-1 and dall-e-3 return base64 (b64_json); dall-e-2 returns a URL.
//   Images are saved to assets/images/ with filename: admin-{slug}-{timestamp}.png
//
// Tier system (stored as integer in Firestore):
//   1=Iron  2=Bronze  3=Silver  4=Gold  5=Diamond  6=Titanium  7=Radiant
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const OpenAI  = require('openai');
const admin   = require('../config/firebase-admin'); // Firebase Admin SDK

// Human-readable names for each loyalty tier integer (1–7)
const TIER_NAMES = { 1:'Iron', 2:'Bronze', 3:'Silver', 4:'Gold', 5:'Diamond', 6:'Titanium', 7:'Radiant' };

// ── Auth guard ────────────────────────────────────────────────────────────────
// Applied to every admin route that shouldn't be publicly accessible.
// Checks for req.session.admin (set on successful login below).
// Redirects unauthenticated requests to the admin login page.
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

// ── downloadImage(url, dest, redirectCount) ───────────────────────────────────
// Downloads a remote image (from a URL) to a local file path.
// Handles HTTP redirects (301, 302, 307, 308) recursively up to 6 hops.
// Used when an AI model returns a URL instead of base64 data (dall-e-2).
//
// @param {string} url          - Remote image URL
// @param {string} dest         - Absolute local path to save the image to
// @param {number} redirectCount - Internal counter to prevent infinite loops
// @returns {Promise<string>}   - Resolves with the destination path on success
function downloadImage(url, dest, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 6) return Promise.reject(new Error('Too many redirects'));

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file     = fs.createWriteStream(dest);

    const req = protocol.get(url, (res) => {
      // Follow HTTP redirects transparently
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {}); // Clean up incomplete file
        return downloadImage(res.headers.location, dest, redirectCount + 1)
          .then(resolve).catch(reject);
      }

      // Fail on non-200 responses
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error('HTTP ' + res.statusCode));
      }

      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
      file.on('error',  (e) => { fs.unlink(dest, () => {}); reject(e); });
    });

    req.on('error', (e) => { try { file.close(); } catch(_){} fs.unlink(dest, () => {}); reject(e); });
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Timeout')); }); // 45s timeout
  });
}

// ── GET /admin/login — show login form ───────────────────────────────────────
// If already authenticated, skip the login page and go straight to dashboard.
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

// ── POST /admin/login — authenticate admin ────────────────────────────────────
// Compares submitted email+password against ADMIN_EMAIL / ADMIN_PASSWORD env vars.
// On success: sets req.session.admin and redirects to dashboard.
// On failure: re-renders login with an error message.
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.admin = { email }; // Mark session as authenticated admin
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid email or password.' });
});

// ── POST /admin/logout — clear admin session ──────────────────────────────────
// Nulls out the admin session flag (doesn't destroy the whole session,
// so any customer session on the same browser is unaffected).
router.post('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/login');
});

// ── GET /admin — main dashboard ───────────────────────────────────────────────
// Fetches all data needed for the dashboard in parallel using Promise.all:
//   - Total product count
//   - Low stock count (in_stock > 0 AND in_stock <= 5)
//   - Out of stock count (in_stock = 0)
//   - Full product list (for the products table)
//   - All registered users from Firestore (for the users section)
//
// Query string flags (set by redirect after operations):
//   ?saved=1       → show "Product saved" toast
//   ?deleted=1     → show "Product deleted" toast
//   ?userDeleted=1 → show "User deleted" toast
//   ?generating=1  → show "Generating image..." toast (not yet used)
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Run all DB queries and the Firestore read in parallel for speed
    const [r1, r2, r3, products, usersSnap] = await Promise.all([

      // Total number of products in the store
      new Promise((resolve, reject) =>
        db.query('SELECT COUNT(*) AS total FROM products', (e, r) => e ? reject(e) : resolve(r))
      ),

      // Products with low stock (1–5 units remaining) — flagged in dashboard
      new Promise((resolve, reject) =>
        db.query('SELECT COUNT(*) AS low FROM products WHERE in_stock > 0 AND in_stock <= 5', (e, r) => e ? reject(e) : resolve(r))
      ),

      // Products completely out of stock
      new Promise((resolve, reject) =>
        db.query('SELECT COUNT(*) AS out FROM products WHERE in_stock = 0', (e, r) => e ? reject(e) : resolve(r))
      ),

      // Full product list for the admin table (alphabetical)
      new Promise((resolve, reject) =>
        db.query('SELECT * FROM products ORDER BY product_name ASC', (e, r) => e ? reject(e) : resolve(r))
      ),

      // All registered users from Firestore, newest first
      // .catch(() => ({ docs: [] })) — gracefully handle Firestore errors
      // so the dashboard still loads even if Firestore is unreachable
      admin.firestore().collection('users').orderBy('createdAt', 'desc').get()
        .catch(() => ({ docs: [] }))
    ]);

    // Transform Firestore documents into plain objects for the template
    const users = usersSnap.docs.map(doc => {
      const d      = doc.data();
      const tierNum = parseInt(d.tier) || 1; // Default to Iron if tier missing

      return {
        uid:      doc.id,                      // Firebase UID (used for delete)
        name:     d.displayName || '—',
        email:    d.email       || '—',
        contact:  (d.savedAddress && d.savedAddress.mobile) ? d.savedAddress.mobile : '—',
        tier:     tierNum,
        tierName: TIER_NAMES[tierNum] || 'Iron',
        // Format Firestore Timestamp → "12 May 2025"
        joined:   d.createdAt
          ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric'
            })
          : '—'
      };
    });

    res.render('admin/dashboard', {
      totalProducts: r1[0].total,
      lowStock:      r2[0].low,
      outOfStock:    r3[0].out,
      products:      products || [],
      users,
      totalUsers:    users.length,
      saved:         req.query.saved       === '1',
      deleted:       req.query.deleted     === '1',
      userDeleted:   req.query.userDeleted === '1',
      generating:    req.query.generating  === '1',
    });

  } catch (err) {
    // If any query fails, render the dashboard with zeroed stats rather
    // than showing a 500 error to the admin.
    console.error('Dashboard error:', err);
    res.render('admin/dashboard', {
      totalProducts: 0, lowStock: 0, outOfStock: 0,
      products: [], users: [], totalUsers: 0,
      saved: false, deleted: false, userDeleted: false, generating: false
    });
  }
});

// ── POST /admin/product/add — add a new product with AI image ─────────────────
// Steps:
//   1. Slugify the product name to build a clean filename.
//   2. Try to generate a product image using the OpenAI images API.
//      Attempts models in order: gpt-image-1 → dall-e-3 → dall-e-2
//      gpt-image-1/dall-e-3 → returns b64_json → write buffer to file
//      dall-e-2              → returns URL      → downloadImage() to file
//   3. Insert the product row into PostgreSQL.
//      image_filename is null if image generation failed (no image shown).
//   4. Redirect to dashboard with ?saved=1 toast.
router.post('/product/add', requireAdmin, async (req, res) => {
  const { product_name, unit_price, unit_quantity, in_stock } = req.body;

  try {
    // Build a URL-safe filename slug from the product name
    // e.g. "Organic Oat Milk (1L)" → "organic-oat-milk-1l"
    const slug          = product_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const imageFilename = `admin-${slug}-${Date.now()}.png`; // Timestamp avoids collisions
    const imagePath     = path.join(__dirname, '../assets/images/', imageFilename);

    let savedImageFilename = null; // Will remain null if image generation fails

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Prompt is kept simple: product name + studio lighting + white bg.
      // Avoid product labels/text since the model can hallucinate them.
      const prompt = `High quality food product photo: ${product_name.trim()}. Pure white background, professional studio lighting, sharp focus. No text, no labels, no watermarks.`;

      let imgData = null;

      // Try each model in order — break as soon as one succeeds
      const models = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];
      for (const model of models) {
        try {
          const opts = { model, prompt, n: 1, size: '1024x1024' };
          if (model === 'dall-e-3') opts.quality = 'standard'; // Required for dall-e-3
          if (model === 'dall-e-2') opts.size    = '512x512';  // dall-e-2 max is 1024, 512 is faster

          const resp = await openai.images.generate(opts);

          // gpt-image-1 always returns b64_json (base64-encoded PNG)
          imgData = resp.data[0].b64_json || null;

          if (!imgData && resp.data[0].url) {
            // dall-e-2 returns a temporary signed URL — download it
            await downloadImage(resp.data[0].url, imagePath);
            savedImageFilename = imageFilename;
          } else if (imgData) {
            // Write base64 data directly to disk as a PNG file
            fs.writeFileSync(imagePath, Buffer.from(imgData, 'base64'));
            savedImageFilename = imageFilename;
          }

          console.log(`AI image ready (${model}) for:`, product_name.trim());
          break; // Success — stop trying other models

        } catch (modelErr) {
          // This model failed (quota, access, etc.) — try the next one
          console.error(`Model ${model} failed:`, modelErr.message);
        }
      }
    } catch (imgErr) {
      // Outer catch — OpenAI client itself failed to initialise
      console.error('Image gen failed:', imgErr.message);
    }

    // Insert the new product into PostgreSQL regardless of image success
    await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO products (product_name, unit_price, unit_quantity, in_stock, image_filename) VALUES (?,?,?,?,?)',
        [
          product_name.trim(),
          parseFloat(unit_price),
          unit_quantity.trim(),
          parseInt(in_stock),
          savedImageFilename  // null if image generation failed
        ],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.redirect('/admin?saved=1');

  } catch (err) {
    console.error('Add product error:', err);
    res.redirect('/admin');
  }
});

// ── POST /admin/product/edit — update an existing product ────────────────────
// Updates name, price, quantity description, and stock level.
// Does NOT regenerate the image — image is set at creation time only.
// Redirects to dashboard with ?saved=1 toast on success.
router.post('/product/edit', requireAdmin, (req, res) => {
  const { product_id, product_name, unit_price, unit_quantity, in_stock } = req.body;
  db.query(
    'UPDATE products SET product_name=?, unit_price=?, unit_quantity=?, in_stock=? WHERE product_id=?',
    [
      product_name.trim(),
      parseFloat(unit_price),
      unit_quantity.trim(),
      parseInt(in_stock),
      parseInt(product_id)
    ],
    (err) => {
      if (err) console.error('Edit error:', err);
      res.redirect('/admin?saved=1');
    }
  );
});

// ── POST /admin/product/delete — delete a product from the store ──────────────
// Permanently removes the product row from PostgreSQL.
// NOTE: This does NOT restore in_stock if the product is in someone's cart.
// The image file is NOT deleted from assets/images/ (safe to leave it).
// Redirects to dashboard with ?deleted=1 toast.
router.post('/product/delete', requireAdmin, (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.redirect('/admin');

  db.query(
    'DELETE FROM products WHERE product_id=?',
    [parseInt(product_id)],
    (err) => {
      if (err) console.error('Delete error:', err);
      res.redirect('/admin?deleted=1');
    }
  );
});

// ── POST /admin/user/delete — permanently delete a customer account ───────────
// Performs two deletions in parallel:
//   1. Firestore: deletes the user document from the 'users' collection.
//      This removes all profile data (points, address, tier, etc.)
//   2. Firebase Auth: disables and removes the login account so the
//      user can no longer sign in or reset their password.
//      .catch(() => {}) on Auth deletion silences errors if the account
//      was already deleted (e.g. user self-deleted client-side first).
//
// After deletion the user is permanently locked out. Their orders are
// not stored in Firestore so no additional cleanup is needed.
router.post('/user/delete', requireAdmin, async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.redirect('/admin');

  try {
    await Promise.all([
      admin.firestore().collection('users').doc(uid).delete(),
      admin.auth().deleteUser(uid).catch(() => {}) // Silent if Auth record already gone
    ]);
  } catch (err) {
    console.error('Delete user error:', err);
  }

  res.redirect('/admin?userDeleted=1');
});

module.exports = router;
