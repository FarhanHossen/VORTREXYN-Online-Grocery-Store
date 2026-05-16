const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', (req, res) => {
  db.query('SELECT * FROM products ORDER BY product_id', (err, results) => {
    if (err) return res.status(500).send('DB Error');
    res.render('categories', { products: results, title: 'All Products' });
  });
});

router.get('/category/:name', (req, res) => {
  const category = req.params.name;
  const categoryMap = {
    'Frozen':    [1000, 1001, 1002, 1003, 1004, 1005],
    'Health':    [2000, 2001, 2002, 2006],
    'Home':      [2003, 2004, 2005],
    'Dairy':     [3000, 3001],
    'Meat':      [3002],
    'Fruits':    [3003, 3004, 3005, 3006, 3007],
    'Beverages': [4000, 4001, 4002, 4003, 4004],
    'Snacks':    [4005],
    'Pet-food':  [5000, 5001, 5002, 5003, 5004]
  };
  const ids = categoryMap[category] || [];
  if (ids.length === 0) return res.render('categories', { products: [], title: category });
  const placeholders = ids.map(() => '?').join(',');
  db.query(`SELECT * FROM products WHERE product_id IN (${placeholders}) ORDER BY product_id`, ids, (err, results) => {
    if (err) return res.status(500).send('DB Error');
    res.render('categories', { products: results, title: category });
  });
});

router.get('/search', (req, res) => {
  const keyword = req.query.q || '';
  const likeQuery = `${keyword}%`;
  db.query('SELECT * FROM products WHERE product_name ILIKE ? OR unit_quantity ILIKE ? ORDER BY product_id', [likeQuery, likeQuery], (err, results) => {
    if (err) return res.status(500).send('Search error');
    res.render('categories', { products: results, title: `Search: "${keyword}"` });
  });
});

module.exports = router;
