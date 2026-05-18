const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

// GET /admin/login
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

// POST /admin/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const validEmail    = process.env.ADMIN_EMAIL;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (email === validEmail && password === validPassword) {
    req.session.admin = { email };
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid email or password.' });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/login');
});

// GET /admin — dashboard
router.get('/', requireAdmin, (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM products', (err1, r1) => {
    db.query('SELECT COUNT(*) AS low FROM products WHERE in_stock > 0 AND in_stock <= 5', (err2, r2) => {
      db.query('SELECT COUNT(*) AS out FROM products WHERE in_stock = 0', (err3, r3) => {
        db.query('SELECT * FROM products ORDER BY product_name ASC', (err4, products) => {
          res.render('admin/dashboard', {
            totalProducts: r1[0].total,
            lowStock:      r2[0].low,
            outOfStock:    r3[0].out,
            products:      products || [],
            saved:         req.query.saved === '1',
            deleted:       req.query.deleted === '1',
          });
        });
      });
    });
  });
});

// POST /admin/product/add
router.post('/product/add', requireAdmin, (req, res) => {
  const { product_name, unit_price, unit_quantity, in_stock } = req.body;
  db.query(
    'INSERT INTO products (product_name, unit_price, unit_quantity, in_stock) VALUES ($1,$2,$3,$4)',
    [product_name.trim(), parseFloat(unit_price), unit_quantity.trim(), parseInt(in_stock)],
    () => res.redirect('/admin?saved=1')
  );
});

// POST /admin/product/edit
router.post('/product/edit', requireAdmin, (req, res) => {
  const { product_id, product_name, unit_price, unit_quantity, in_stock } = req.body;
  db.query(
    'UPDATE products SET product_name=$1, unit_price=$2, unit_quantity=$3, in_stock=$4 WHERE product_id=$5',
    [product_name.trim(), parseFloat(unit_price), unit_quantity.trim(), parseInt(in_stock), parseInt(product_id)],
    () => res.redirect('/admin?saved=1')
  );
});

// POST /admin/product/delete
router.post('/product/delete', requireAdmin, (req, res) => {
  const { product_id } = req.body;
  db.query('DELETE FROM products WHERE product_id=$1', [parseInt(product_id)],
    () => res.redirect('/admin?deleted=1')
  );
});

module.exports = router;
