const express = require('express');
const router  = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// GET /account
router.get('/', requireLogin, (req, res) => {
  const saved    = req.session.user.savedAddress || null;
  const didReset = req.query.reset === '1';
  const didSave  = req.query.saved === '1';
  // Consume pending Firestore payloads (set by POST, used once per redirect)
  const firestoreUpdate = req.session.pendingFirestoreAddress || null;
  const firestoreReset  = req.session.pendingFirestoreReset  || false;
  req.session.pendingFirestoreAddress = null;
  req.session.pendingFirestoreReset   = false;
  res.render('account', { saved, firestoreUpdate, firestoreReset, didReset, didSave });
});

// POST /account — save address to session, queue Firestore sync, redirect
router.post('/', requireLogin, (req, res) => {
  const { name, mobile, street, city, state } = req.body;
  const savedAddress = { name, mobile, street, city, state };
  req.session.user.savedAddress           = savedAddress;
  req.session.pendingFirestoreAddress     = savedAddress; // picked up by GET
  req.session.save(() => res.redirect('/account?saved=1'));
});

// POST /account/reset — wipe points, earned total & orders back to zero
router.post('/reset', requireLogin, (req, res) => {
  req.session.user.rewardPoints      = 0;
  req.session.user.totalPointsEarned = 0;
  req.session.user.totalOrders       = 0;
  req.session.pendingFirestoreReset   = true;
  req.session.save(() => res.redirect('/account?reset=1'));
});

module.exports = router;
