// ============================================================
// routes/products.js — Product browsing and search
//
// All routes render views/categories.ejs with a list of products.
// Products are stored in the PostgreSQL 'products' table.
//
// Product ID ranges map to store departments:
//   1000–1999 → Frozen
//   2000–2999 → Health & Home (household goods, personal care)
//   3000–3999 → Dairy, Meat, Fruits
//   4000–4999 → Beverages & Snacks
//   5000–5999 → Pet Food
//   6000–6999 → Bakery
//   7000–7999 → Vegetables
//   8000–8999 → Pantry (dry goods, canned, oils)
//   9000–9999 → Deli
//  10000+     → Admin-added products (generated via AI image)
//
// Image lookup in categories.ejs:
//   Pre-seeded products (ID < 10000) → hard-coded imgMap by product_id
//   Admin-added products             → image_filename column in DB
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// ── Sort helper ───────────────────────────────────────────────────────────────
// Returns the SQL ORDER BY clause for a given sort key.
// Used by all three route handlers below.
// To add new sort options, extend the switch and add the option to the UI.
const sortClause = (sort) => {
  switch (sort) {
    case 'name_asc':   return 'ORDER BY product_name ASC';
    case 'name_desc':  return 'ORDER BY product_name DESC';
    case 'price_asc':  return 'ORDER BY unit_price ASC';
    case 'price_desc': return 'ORDER BY unit_price DESC';
    default:           return 'ORDER BY product_id'; // Default: insertion/ID order
  }
};

// ── GET /products — show all products ────────────────────────────────────────
// Optional ?sort= query param controls ordering.
router.get('/', (req, res) => {
  const sort = req.query.sort || '';
  db.query(`SELECT * FROM products ${sortClause(sort)}`, (err, results) => {
    if (err) return res.status(500).send('DB Error');
    res.render('categories', { products: results, title: 'All Products', sort });
  });
});

// ── GET /products/category/:name — filter by department ───────────────────────
// :name must exactly match a key in categoryMap (case-sensitive).
// categoryMap links category names to the product_id ranges defined above.
// If the category name is unknown, returns an empty product list gracefully.
router.get('/category/:name', (req, res) => {
  const category = req.params.name;
  const sort = req.query.sort || '';

  // Map of category name → array of product_id values belonging to it.
  // To add a new category: add a key here and add products to the DB
  // with IDs in a new range (e.g. 10000+ for admin-added products).
  const categoryMap = {
    'Frozen':     [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008],
    'Health':     [2000, 2001, 2002, 2006, 2007, 2008, 2009],
    'Home':       [2003, 2004, 2005, 2010, 2011, 2012],
    'Dairy':      [3000, 3001, 3008, 3009, 3010, 3011],
    'Meat':       [3002, 3012, 3013],
    'Fruits':     [3003, 3004, 3005, 3006, 3007, 3014, 3015, 3016, 3017],
    'Beverages':  [4000, 4001, 4002, 4003, 4004, 4006, 4007, 4008, 4009],
    'Snacks':     [4005, 4010, 4011, 4012, 4013],
    'Pet-food':   [5000, 5001, 5002, 5003, 5004, 5005, 5006],
    'Bakery':     [6000, 6001, 6002, 6003, 6004, 6005],
    'Vegetables': [7000, 7001, 7002, 7003, 7004, 7005, 7006, 7007],
    'Pantry':     [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007],
    'Deli':       [9000, 9001, 9002, 9003]
  };

  const ids = categoryMap[category] || [];

  // Unknown or empty category — render page with no results
  if (ids.length === 0) return res.render('categories', { products: [], title: category, sort });

  // Build '?,?,?,...' placeholder list for the IN clause
  const placeholders = ids.map(() => '?').join(',');
  db.query(
    `SELECT * FROM products WHERE product_id IN (${placeholders}) ${sortClause(sort)}`,
    ids,
    (err, results) => {
      if (err) return res.status(500).send('DB Error');
      res.render('categories', { products: results, title: category, sort });
    }
  );
});

// ── GET /products/search — keyword search ────────────────────────────────────
// Searches product_name and unit_quantity using a prefix ILIKE match.
// e.g. ?q=apple matches "Apple Juice", "Apple Cider Vinegar", etc.
// ILIKE is PostgreSQL's case-insensitive LIKE.
// The query is deliberately a prefix match (keyword%) not a full substring
// match (%keyword%) to keep results focused. Change to %keyword% if needed.
router.get('/search', (req, res) => {
  const keyword   = req.query.q || '';
  const sort      = req.query.sort || '';
  const likeQuery = `${keyword}%`; // Prefix match: "app%" matches "apple juice"
  db.query(
    `SELECT * FROM products WHERE product_name ILIKE ? OR unit_quantity ILIKE ? ${sortClause(sort)}`,
    [likeQuery, likeQuery],
    (err, results) => {
      if (err) return res.status(500).send('Search error');
      res.render('categories', { products: results, title: `Search: "${keyword}"`, sort });
    }
  );
});

module.exports = router;
