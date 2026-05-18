// ============================================================
// routes/index.js — Home page route
//
// Handles: GET /
// Renders the main landing/splash page (views/index.ejs).
// The header partial includes the animated splash screen that
// plays on first visit or hard refresh.
// ============================================================

const express = require('express');
const router  = express.Router();

// GET / — render the home page.
// res.locals.user and res.locals.firebaseConfig are injected
// automatically by the global middleware in server.js.
router.get('/', (req, res) => {
  res.render('index');
});

module.exports = router;
