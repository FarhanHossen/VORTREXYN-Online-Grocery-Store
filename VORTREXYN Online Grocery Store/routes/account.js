// ============================================================
// routes/account.js — Customer account management
//
// All routes require the user to be logged in (requireLogin middleware).
// Account data lives in two places:
//   - req.session.user  → the in-memory session (fast, authoritative)
//   - Firestore users/{uid} → the persistent cloud store
//
// The Firestore sync happens CLIENT-SIDE (not here) via account.ejs:
// the server queues what needs syncing via `req.session.pendingFirestore*`
// flags, and account.ejs reads those flags on the subsequent GET and
// calls the Firestore SDK directly from the browser.
//
// This approach avoids giving the server Firestore write access for
// user profile updates — the Admin SDK is only used in admin.js.
// ============================================================

const express = require('express');
const router  = express.Router();

// ── Auth guard ────────────────────────────────────────────────────────────────
// Redirect unauthenticated visitors to the login page.
// Applied to all routes in this file.
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// ── GET /account — account dashboard ─────────────────────────────────────────
// Shows the customer's profile: reward points, tier, saved address, order count.
//
// pendingFirestore* flags are written by POST /account and POST /account/reset,
// then consumed here on the redirect-after-POST. account.ejs reads them and
// triggers the matching Firestore update via the browser's Firebase SDK.
// They are cleared immediately after reading so they only fire once.
router.get('/', requireLogin, (req, res) => {
  const saved    = req.session.user.savedAddress || null;
  const didReset = req.query.reset === '1'; // Flag: show "stats reset" banner
  const didSave  = req.query.saved === '1'; // Flag: show "address saved" banner

  // Pull pending Firestore sync payloads set by POST handlers below
  const firestoreUpdate = req.session.pendingFirestoreAddress || null;
  const firestoreReset  = req.session.pendingFirestoreReset  || false;

  // Consume the flags — clear them so they don't re-fire on next page load
  req.session.pendingFirestoreAddress = null;
  req.session.pendingFirestoreReset   = false;

  res.render('account', { saved, firestoreUpdate, firestoreReset, didReset, didSave });
});

// ── POST /account — save delivery address ────────────────────────────────────
// Writes the new address to the session immediately, then queues a
// Firestore sync for the next GET (so account.ejs can update the cloud).
// Redirects back to GET /account with ?saved=1 banner.
router.post('/', requireLogin, (req, res) => {
  const { name, mobile, street, city, state } = req.body;
  const savedAddress = { name, mobile, street, city, state };

  // Update in-memory session instantly (no page wait)
  req.session.user.savedAddress = savedAddress;

  // Queue the address for Firestore sync on the next GET /account
  req.session.pendingFirestoreAddress = savedAddress;

  // req.session.save() ensures session is written before redirect
  req.session.save(() => res.redirect('/account?saved=1'));
});

// ── POST /account/reset — reset reward stats ──────────────────────────────────
// Zeros out reward points, lifetime earned points, order count, and tier.
// Used as a developer/testing tool — not exposed to customers in the UI
// unless you add a button for it.
// Also queues a Firestore reset via the pendingFirestoreReset flag.
router.post('/reset', requireLogin, (req, res) => {
  req.session.user.rewardPoints      = 0;
  req.session.user.totalPointsEarned = 0;
  req.session.user.totalOrders       = 0;
  req.session.user.tier              = 1; // Reset to Tier 1 (Iron)

  // Queue Firestore reset for account.ejs to execute client-side
  req.session.pendingFirestoreReset = true;

  req.session.save(() => res.redirect('/account?reset=1'));
});

// ── POST /account/delete — delete customer account ────────────────────────────
// Called by account.ejs AFTER the client-side Firebase Auth deletion succeeds.
// At this point the Firebase account is already gone; we just need to
// kill the server-side session so the user is fully logged out.
// Returns JSON { ok: true } — account.ejs then redirects the user to home.
router.post('/delete', requireLogin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
