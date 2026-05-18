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
    const rows = await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO products (product_name, unit_price, unit_quantity, in_stock) VALUES (?,?,?,?) RETURNING product_id',
        [product_name.trim(), parseFloat(unit_price), unit_quantity.trim(), parseInt(in_stock)],
        (err, rows) => err ? reject(err) : resolve(rows)
      );
    });

    const productId = rows[0].product_id;
    const slug = product_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const imageFilename = `${slug}.png`;
    const imagePath = path.join(__dirname, '../assets/images/', imageFilename);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    (async () => {
      try {
        const response = await openai.images.generate({
          model:   'dall-e-3',
          prompt:  `A professional grocery store product photo of ${product_name.trim()}. Clean white background, studio lighting, sharp focus, high quality food photography, no text, no labels.`,
          n:       1,
          size:    '1024x1024',
          quality: 'standard',
        });
        const generatedUrl = response.data[0].url;
        await downloadImage(generatedUrl, imagePath);
        db.query('UPDATE products SET image_filename=? WHERE product_id=?',
          [imageFilename, productId], () => {});
        console.log('AI image generated for:', product_name.trim());
      } catch (err) {
        console.error('OpenAI image gen failed:', err.message);
      }
    })();

    res.redirect('/admin?saved=1&generating=1');
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
