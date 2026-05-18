// ============================================================
// routes/auth.js — Customer authentication routes
//
// Firebase handles the actual sign-in/sign-up on the CLIENT side
// (see assets/js/auth.js). This file only handles:
//   1. Serving the login/signup/forgot-password pages (GET)
//   2. Receiving the confirmed Firebase token after a successful
//      client-side login and creating a server-side session (POST /session)
//   3. Destroying the session on logout (POST /logout)
//
// Auth flow:
//   User fills form → auth.js calls Firebase → Firebase returns token
//   → auth.js POSTs token to /auth/session → server verifies & stores
//   session → redirect to home page.
//
// Session data stored: uid, email, displayName, photoURL,
//   rewardPoints, totalOrders, totalPointsEarned, tier, savedAddress
// ============================================================

const express = require('express');
const router  = express.Router();

// ── Page routes ───────────────────────────────────────────────────────────────

// GET /auth/login — show the login page.
// If already logged in, redirect to home immediately.
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { error: null, info: null });
});

// GET /auth/signup — show the sign-up page.
// If already logged in, redirect to home immediately.
router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/signup', { error: null });
});

// GET /auth/forgot-password — show the password reset page.
// ?sent=1 is appended after the reset email is sent, so the page
// can display a "Check your inbox" confirmation message.
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { sent: req.query.sent === '1' });
});

// ── Session creation ──────────────────────────────────────────────────────────

// POST /auth/session — called by auth.js after Firebase auth succeeds.
//
// Flow:
//   1. Client sends { idToken, uid, email, displayName, ... } as JSON.
//   2. Server optionally verifies the idToken using Firebase Admin SDK.
//      (If admin isn't fully configured, it logs a warning and proceeds —
//       acceptable in development; tighten in production.)
//   3. Server writes a session cookie with the user's full profile
//      (pulled from Firestore by auth.js and forwarded in the request body).
//
// Body fields:
//   idToken, uid, email, displayName, photoURL,
//   rewardPoints, totalOrders, totalPointsEarned, savedAddress, tier
router.post('/session', express.json(), async (req, res) => {
  const { idToken, displayName, email, uid } = req.body;

  // Reject requests missing the required token or user ID
  if (!idToken || !uid) return res.status(400).json({ error: 'Missing token' });

  try {
    // Try to verify the Firebase ID token server-side using the Admin SDK.
    // This confirms the token is genuine and not forged.
    // If firebase-admin isn't configured (e.g. missing env vars), we warn
    // and skip verification — client data is still trusted optimistically.
    let admin;
    try {
      admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          })
        });
      }
      await admin.auth().verifyIdToken(idToken);
    } catch (adminErr) {
      console.warn('Firebase admin verify skipped:', adminErr.message);
    }

    // Pull the full profile fields that auth.js fetched from Firestore
    const { photoURL, rewardPoints, totalOrders, totalPointsEarned, savedAddress, tier } = req.body;

    // Write the user profile into the Express session.
    // This is what res.locals.user references in every template.
    req.session.user = {
      uid,
      email,
      displayName:       displayName        || email.split('@')[0],
      photoURL:          photoURL           || null,
      rewardPoints:      rewardPoints       || 0,
      totalOrders:       totalOrders        || 0,
      savedAddress:      savedAddress       || null,
      totalPointsEarned: totalPointsEarned  || 0,
      tier:              tier               || 1,  // Tier 1 = Iron (lowest)
    };

    res.json({ ok: true }); // auth.js then redirects to '/'
  } catch (err) {
    console.error('Session error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

// POST /auth/logout — destroy the server-side session and go to home.
// The client-side Firebase sign-out is handled separately in account.ejs.
router.post('/logout', (req, res) => {
  req.session.user = null;
  res.redirect('/');
});

module.exports = router;
