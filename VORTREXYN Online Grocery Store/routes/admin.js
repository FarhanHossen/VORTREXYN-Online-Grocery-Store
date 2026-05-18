const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const OpenAI   = require('openai');

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

function downloadImage(url, dest, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 6) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = protocol.get(url, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadImage(res.headers.location, dest, redirectCount + 1)
          .then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error('HTTP ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
      file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
    });
    req.on('error', (e) => { try { file.close(); } catch(_){} fs.unlink(dest, () => {}); reject(e); });
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.admin = { email };
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid email or password.' });
});

router.post('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/login');
});

router.get('/', requireAdmin, (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM products', (e1, r1) => {
    db.query('SELECT COUNT(*) AS low FROM products WHERE in_stock > 0 AND in_stock <= 5', (e2, r2) => {
      db.query('SELECT COUNT(*) AS out FROM products WHERE in_stock = 0', (e3, r3) => {
        db.query('SELECT * FROM products ORDER BY product_name ASC', (e4, products) => {
          res.render('admin/dashboard', {
            totalProducts: r1[0].total,
            lowStock:      r2[0].low,
            outOfStock:    r3[0].out,
            products:      products || [],
            saved:      req.query.saved     === '1',
            deleted:    req.query.deleted   === '1',
            generating: req.query.generating === '1',
          });
        });
      });
    });
  });
});

router.post('/product/add', requireAdmin, async (req, res) => {
  const { product_name, unit_price, unit_quantity, in_stock } = req.body;
  try {
    const slug = product_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const imageFilename = `admin-${slug}-${Date.now()}.png`;
    const imagePath = path.join(__dirname, '../assets/images/', imageFilename);

    let savedImageFilename = null;
    try {
      const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt  = `High quality food product photo: ${product_name.trim()}. Pure white background, professional studio lighting, sharp focus. No text, no labels, no watermarks.`;
      let   imgData = null;

      const models = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];
      for (const model of models) {
        try {
          const opts = { model, prompt, n: 1, size: '1024x1024' };
          if (model === 'dall-e-3') opts.quality = 'standard';
          if (model === 'dall-e-2') opts.size = '512x512';
          const resp = await openai.images.generate(opts);
          imgData = resp.data[0].b64_json || null;
          if (!imgData && resp.data[0].url) {
            await downloadImage(resp.data[0].url, imagePath);
            savedImageFilename = imageFilename;
          } else if (imgData) {
            fs.writeFileSync(imagePath, Buffer.from(imgData, 'base64'));
            savedImageFilename = imageFilename;
          }
          console.log(`AI image ready (${model}) for:`, product_name.trim());
          break;
        } catch (modelErr) {
          console.error(`Model ${model} failed:`, modelErr.message);
        }
      }
    } catch (imgErr) {
      console.error('Image gen failed:', imgErr.message);
    }

    await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO products (product_name, unit_price, unit_quantity, in_stock, image_filename) VALUES (?,?,?,?,?)',
        [product_name.trim(), parseFloat(unit_price), unit_quantity.trim(), parseInt(in_stock), savedImageFilename],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.redirect('/admin?saved=1');
  } catch (err) {
    console.error('Add product error:', err);
    res.redirect('/admin');
  }
});

router.post('/product/edit', requireAdmin, (req, res) => {
  const { product_id, product_name, unit_price, unit_quantity, in_stock } = req.body;
  db.query(
    'UPDATE products SET product_name=?, unit_price=?, unit_quantity=?, in_stock=? WHERE product_id=?',
    [product_name.trim(), parseFloat(unit_price), unit_quantity.trim(), parseInt(in_stock), parseInt(product_id)],
    (err) => {
      if (err) console.error('Edit error:', err);
      res.redirect('/admin?saved=1');
    }
  );
});

router.post('/product/delete', requireAdmin, (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.redirect('/admin');
  db.query('DELETE FROM products WHERE product_id=?', [parseInt(product_id)],
    (err) => {
      if (err) console.error('Delete error:', err);
      res.redirect('/admin?deleted=1');
    }
  );
});

module.exports = router;
