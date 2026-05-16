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
    'Frozen':    [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008],
    'Health':    [2000, 2001, 2002, 2006, 2007, 2008, 2009],
    'Home':      [2003, 2004, 2005, 2010, 2011, 2012],
    'Dairy':     [3000, 3001, 3008, 3009, 3010, 3011],
    'Meat':      [3002, 3012, 3013],
    'Fruits':    [3003, 3004, 3005, 3006, 3007, 3014, 3015, 3016, 3017],
    'Beverages': [4000, 4001, 4002, 4003, 4004, 4006, 4007, 4008, 4009],
    'Snacks':    [4005, 4010, 4011, 4012, 4013],
    'Pet-food':  [5000, 5001, 5002, 5003, 5004, 5005, 5006]
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
