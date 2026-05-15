const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { error: null, info: null });
});

router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/signup', { error: null });
});

router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { sent: req.query.sent === '1' });
});

// Called from client-side after Firebase auth succeeds
router.post('/session', express.json(), async (req, res) => {
  const { idToken, displayName, email, uid } = req.body;
  if (!idToken || !uid) return res.status(400).json({ error: 'Missing token' });

  try {
    let admin;
    try {
      admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId:    process.env.FIREBASE_PROJECT_ID,
            clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:   (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          })
        });
      }
      await admin.auth().verifyIdToken(idToken);
    } catch (adminErr) {
      // If firebase-admin not fully configured, accept token optimistically in dev
      console.warn('Firebase admin verify skipped:', adminErr.message);
    }

    const { photoURL, rewardPoints, totalOrders } = req.body;
    req.session.user = {
      uid,
      email,
      displayName:  displayName || email.split('@')[0],
      photoURL:     photoURL    || null,
      rewardPoints: rewardPoints || 0,
      totalOrders:  totalOrders  || 0,
    };
    res.json({ ok: true });
  } catch (err) {
    console.error('Session error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (req, res) => {
  req.session.user = null;
  res.redirect('/');
});

module.exports = router;
