const express = require('express');
const router  = express.Router();

// Redirect to login if not signed in
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// GET /account
router.get('/', requireLogin, (req, res) => {
  const saved = req.session.user.savedAddress || null;
  res.render('account', { saved, firestoreUpdate: null });
});

// POST /account  — save delivery address
router.post('/', requireLogin, (req, res) => {
  const { name, mobile, street, city, state } = req.body;
  const savedAddress = { name, mobile, street, city, state };

  // Persist in session immediately
  req.session.user.savedAddress = savedAddress;

  // Pass to view so client-side JS can sync to Firestore
  const saved = savedAddress;
  res.render('account', { saved, firestoreUpdate: savedAddress });
});

module.exports = router;
