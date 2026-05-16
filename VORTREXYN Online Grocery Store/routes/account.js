const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// Create table once on startup
db.query(`
  CREATE TABLE IF NOT EXISTS user_saved_addresses (
    uid        TEXT PRIMARY KEY,
    name       TEXT,
    mobile     TEXT,
    street     TEXT,
    city       TEXT,
    state      TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`, (err) => {
  if (err) console.error('Address table error:', err.message);
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// GET /account
router.get('/', requireLogin, (req, res) => {
  const saved    = req.session.user.savedAddress || null;
  const didReset = req.query.reset === '1';
  const didSave  = req.query.saved === '1';
  res.render('account', { saved, firestoreUpdate: null, didReset, didSave });
});

// POST /account — save delivery address to DB + session, then redirect
router.post('/', requireLogin, (req, res) => {
  const { name, mobile, street, city, state } = req.body;
  const uid = req.session.user.uid;
  const savedAddress = { name, mobile, street, city, state };

  db.query(
    `INSERT INTO user_saved_addresses (uid, name, mobile, street, city, state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON CONFLICT (uid) DO UPDATE SET
       name=EXCLUDED.name, mobile=EXCLUDED.mobile,
       street=EXCLUDED.street, city=EXCLUDED.city,
       state=EXCLUDED.state, updated_at=NOW()`,
    [uid, name, mobile, street, city, state],
    (err) => {
      if (err) console.error('Address save error:', err.message);
    }
  );

  req.session.user.savedAddress = savedAddress;
  req.session.save(() => res.redirect('/account?saved=1'));
});

// POST /account/reset — wipe points, earned total & orders back to zero
router.post('/reset', requireLogin, (req, res) => {
  req.session.user.rewardPoints      = 0;
  req.session.user.totalPointsEarned = 0;
  req.session.user.totalOrders       = 0;
  req.session.save(() => res.redirect('/account?reset=1'));
});

module.exports = router;
