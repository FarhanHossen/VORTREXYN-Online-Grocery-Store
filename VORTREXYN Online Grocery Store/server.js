// ============================================================
// server.js — Main entry point for the VORTREXYN application
//
// Stack: Node.js + Express + EJS templating
// Database: PostgreSQL (via config/db.js)
// Auth: Firebase Authentication + Firestore (client-side SDK)
//       Firebase Admin SDK (server-side, in config/firebase-admin.js)
// Sessions: express-session (in-memory; resets on server restart)
//
// Start command: node server.js
// Default port: 5000 (overridden by PORT env var)
// ============================================================

require('dotenv').config(); // Load .env file into process.env
const express    = require('express');
const path       = require('path');
const bodyParser = require('body-parser');
const session    = require('express-session');

const app = express();

// ── Session configuration ────────────────────────────────────────────────────
// Sessions are stored in memory — they are lost when the server restarts.
// To persist sessions across restarts, replace with connect-pg-simple or
// a Redis-backed session store.
// cookie.maxAge = 7 days (in milliseconds)
app.use(session({
  secret:            'groceries2025',           // Change this to a strong random string in production
  resave:            false,                     // Don't re-save session if nothing changed
  saveUninitialized: true,                      // Save new sessions even before data is stored
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7-day session lifetime
}));

// ── Request body parsing ─────────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true })); // Parse HTML form POST bodies
app.use(express.json());                            // Parse JSON request bodies (used by /auth/session)

// ── View engine ──────────────────────────────────────────────────────────────
// EJS templates live in the /views directory.
// Partials: views/partials/header.ejs, footer.ejs (included in each page).
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static assets ────────────────────────────────────────────────────────────
// Everything in /assets is served publicly:
//   /css/styles.css      → main stylesheet
//   /js/auth.js          → Firebase client-side auth logic
//   /js/firebase-init.js → Firebase SDK initialiser
//   /images/             → product photos + logo.svg
app.use(express.static(path.join(__dirname, 'assets')));

// ── Global template locals ───────────────────────────────────────────────────
// Runs on EVERY request before the route handler.
// Injects two values into all EJS templates so they don't need to be
// passed manually in every res.render() call:
//   res.locals.user          → logged-in customer (or null)
//   res.locals.firebaseConfig → public Firebase config for the client SDK
// NOTE: Only PUBLIC Firebase keys go here — never the Admin private key.
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.firebaseConfig = {
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID
  };
  next();
});

// ── Route modules ─────────────────────────────────────────────────────────────
// Each route file handles a specific section of the site.
// All routes under a prefix are defined in the corresponding file.
app.use('/',        require('./routes/index'));    // Home page (/)
app.use('/products',require('./routes/products')); // Browse & search products
app.use('/cart',    require('./routes/cart'));      // Cart, checkout, payment, order confirmation
app.use('/auth',    require('./routes/auth'));      // Login, signup, forgot password, session
app.use('/account', require('./routes/account'));   // Customer account & address management
app.use('/admin',   require('./routes/admin'));     // Admin dashboard (password-protected)

// ── Logo concept preview pages ────────────────────────────────────────────────
// These are internal design-comparison pages used during brand development.
// Accessible at /logo-concept/a, /logo-concept/b, /logo-concept/c
// They render three animated SVG logo concepts side-by-side for review.
// These routes are NOT linked from the public site — dev/design use only.

/**
 * buildConceptPage(id, title, desc, animCSS, svgBody)
 * Returns a self-contained HTML string that previews a single logo concept
 * in three contexts: large standalone, in a nav bar, and on an auth card.
 *
 * @param {string} id       - Concept letter: 'a', 'b', or 'c'
 * @param {string} title    - Human-readable concept name
 * @param {string} desc     - Short description of the design rationale
 * @param {string} animCSS  - CSS animation keyframes specific to this concept
 * @param {string} svgBody  - The SVG markup for the logo
 * @returns {string} Full HTML page as a string
 */
function buildConceptPage(id, title, desc, animCSS, svgBody) {
  const base = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:#070503;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:36px 24px 48px;gap:26px}
.badge{font-size:10px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:2px;padding:4px 14px;letter-spacing:.16em;text-transform:uppercase}
.ttl{font-size:22px;font-weight:800;color:#f0e6d3;font-family:'Playfair Display',serif}
.dsc{font-size:12px;color:#7a6250;text-align:center;max-width:300px;line-height:1.65}
.big-logo svg{height:160px;width:160px;filter:drop-shadow(0 12px 40px rgba(245,158,11,.35))}
.sec-lbl{font-size:10px;font-weight:700;color:#7a6250;letter-spacing:.14em;text-transform:uppercase;margin-top:4px}
.nav-wrap{border-radius:10px;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,.7);border:1px solid rgba(245,158,11,.1);width:100%;max-width:360px}
.nav-bar{background:rgba(7,5,3,.96);backdrop-filter:blur(8px);padding:13px 22px;display:flex;align-items:center;gap:14px}
.nav-bar svg{height:50px;width:auto;flex-shrink:0}
.nav-txt-wrap{display:flex;flex-direction:column}
.nav-name{font-size:15px;font-weight:800;color:#f0e6d3;letter-spacing:3px}
.nav-sub{font-size:8.5px;font-weight:500;color:#7a6250;letter-spacing:1.2px;margin-top:3px;text-transform:uppercase}
.auth-wrap{border-radius:12px;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,.6);background:#131009;border:1px solid rgba(245,158,11,.18);padding:26px 36px;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:260px}
.auth-wrap svg{height:72px;width:auto}
.auth-h{font-size:17px;font-weight:800;color:#f0e6d3;font-family:'Playfair Display',serif}
.auth-p{font-size:11.5px;color:#7a6250}
.replay{margin-top:4px;padding:8px 22px;border:1px solid rgba(245,158,11,.28);border-radius:2px;color:#f59e0b;font-weight:700;font-size:11px;background:none;cursor:pointer;transition:.2s;letter-spacing:.1em;text-transform:uppercase;font-family:Inter,sans-serif}
.replay:hover{background:rgba(245,158,11,.1);border-color:#f59e0b}
${animCSS}
</style></head><body>
<div class="badge">Concept ${id.toUpperCase()}</div>
<div class="ttl">${title}</div>
<div class="dsc">${desc}</div>
<div class="big-logo">${svgBody}</div>
<div class="sec-lbl">In Navbar</div>
<div class="nav-wrap"><div class="nav-bar">
  ${svgBody}
  <div class="nav-txt-wrap"><span class="nav-name">VORTREXYN</span><span class="nav-sub">Online Grocery Store</span></div>
</div></div>
<div class="sec-lbl">On Auth Card</div>
<div class="auth-wrap">
  ${svgBody}
  <div class="auth-h">Welcome back</div>
  <div class="auth-p">Sign in to your account</div>
</div>
<button class="replay" onclick="location.reload()">↺ Replay</button>
</body></html>`;
  return base;
}

// conceptDefs — the three logo concepts to compare.
// Each entry has: title, desc, css (animations), svg (the logo markup).
// To add a new concept: add a new key (e.g. 'd') with the same shape.
const conceptDefs = {
  // ── A: Sovereign V ──────────────────────────────────────────────────────
  // Bold rounded-square badge with two thick V arms. Clean luxury look.
  a: {
    title: 'Sovereign V',
    desc: 'Two bold amber arms form a precision V on pure black — a luxury-house monogram that reads instantly at any size',
    css: `
.sv-bg{transform-box:fill-box;transform-origin:center;animation:sv-pop .4s cubic-bezier(.34,1.56,.64,1) both}
.sv-ring{stroke-dasharray:290;stroke-dashoffset:290;animation:sv-draw .65s ease-out .14s both}
.sv-glow{animation:sv-fadein .5s ease .22s both}
.sv-vl{stroke-dasharray:50;stroke-dashoffset:50;animation:sv-stroke .52s ease .32s both}
.sv-vr{stroke-dasharray:50;stroke-dashoffset:50;animation:sv-stroke .52s ease .5s both}
.sv-apex{transform-box:fill-box;transform-origin:center;animation:sv-pop .3s cubic-bezier(.34,1.56,.64,1) .9s both,sv-pulse 2.4s ease-in-out 1.5s infinite}
.sv-cl{transform-box:fill-box;transform-origin:center;animation:sv-pop .28s cubic-bezier(.34,1.56,.64,1) .72s both}
.sv-cr{transform-box:fill-box;transform-origin:center;animation:sv-pop .28s cubic-bezier(.34,1.56,.64,1) .82s both}
.sv-rule{stroke-dasharray:36;stroke-dashoffset:36;animation:sv-draw .36s ease 1.06s both}
@keyframes sv-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes sv-draw{to{stroke-dashoffset:0}}
@keyframes sv-stroke{0%{stroke-dashoffset:50;opacity:0}100%{stroke-dashoffset:0;opacity:1}}
@keyframes sv-fadein{0%{opacity:0}100%{opacity:.45}}
@keyframes sv-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.7)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sv-bg-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c1208"/>
      <stop offset="100%" stop-color="#0d0800"/>
    </linearGradient>
    <radialGradient id="sv-glow-g" cx="50%" cy="78%" r="52%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <filter id="sv-blur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect class="sv-bg" x="2" y="2" width="76" height="76" rx="14" fill="url(#sv-bg-g)"/>
  <rect x="2" y="2" width="76" height="76" rx="14" fill="url(#sv-glow-g)"/>
  <rect class="sv-ring" x="2" y="2" width="76" height="76" rx="14" fill="none" stroke="#f59e0b" stroke-width="1.3" stroke-opacity=".42"/>
  <g class="sv-glow" filter="url(#sv-blur)">
    <line x1="20" y1="18" x2="40" y2="57" stroke="#f59e0b" stroke-width="7" stroke-linecap="round"/>
    <line x1="60" y1="18" x2="40" y2="57" stroke="#f59e0b" stroke-width="7" stroke-linecap="round"/>
  </g>
  <line class="sv-vl" x1="20" y1="18" x2="40" y2="57" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round"/>
  <line class="sv-vr" x1="60" y1="18" x2="40" y2="57" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round"/>
  <circle class="sv-apex" cx="40" cy="57" r="3.2" fill="#fcd34d"/>
  <circle class="sv-cl" cx="20" cy="18" r="2.4" fill="#d97706"/>
  <circle class="sv-cr" cx="60" cy="18" r="2.4" fill="#d97706"/>
  <line class="sv-rule" x1="24" y1="65" x2="56" y2="65" stroke="#f59e0b" stroke-width="1.1" stroke-opacity=".5"/>
</svg>`
  },

  // ── B: Night Gate ────────────────────────────────────────────────────────
  // Night market arch motif inside a dark circle. Market/bazaar feel.
  b: {
    title: 'Night Gate',
    desc: 'Dark circle, a bold market archway rises with three lit stall peaks inside — the entrance to a premium night market',
    css: `
.ng-bg{transform-box:fill-box;transform-origin:center;animation:ng-pop .44s cubic-bezier(.34,1.56,.64,1) both}
.ng-ring{stroke-dasharray:240;stroke-dashoffset:240;animation:ng-draw .7s ease-out .08s both}
.ng-arch{stroke-dasharray:76;stroke-dashoffset:76;animation:ng-draw .55s ease .68s both}
.ng-pl{transform-box:fill-box;transform-origin:50% 100%;animation:ng-rise .4s ease-out .48s both}
.ng-pr{transform-box:fill-box;transform-origin:50% 100%;animation:ng-rise .4s ease-out .6s both}
.ng-t1{transform-box:fill-box;transform-origin:50% 100%;animation:ng-tent .34s cubic-bezier(.34,1.56,.64,1) 1.06s both}
.ng-t2{transform-box:fill-box;transform-origin:50% 100%;animation:ng-tent .34s cubic-bezier(.34,1.56,.64,1) 1.18s both}
.ng-t3{transform-box:fill-box;transform-origin:50% 100%;animation:ng-tent .34s cubic-bezier(.34,1.56,.64,1) 1.3s both}
.ng-glow{animation:ng-fadein .6s ease .5s both}
@keyframes ng-pop{0%{opacity:0;transform:scale(.25)}100%{opacity:1;transform:scale(1)}}
@keyframes ng-draw{to{stroke-dashoffset:0}}
@keyframes ng-rise{0%{transform:scaleY(0);opacity:0}100%{transform:scaleY(1);opacity:1}}
@keyframes ng-tent{0%{opacity:0;transform:scaleY(0)}100%{opacity:1;transform:scaleY(1)}}
@keyframes ng-fadein{0%{opacity:0}100%{opacity:1}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="ng-bg-g" cx="40%" cy="30%" r="72%">
      <stop offset="0%" stop-color="#1e1208"/>
      <stop offset="100%" stop-color="#080502"/>
    </radialGradient>
    <radialGradient id="ng-glow-g" cx="50%" cy="58%" r="42%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle class="ng-bg" cx="40" cy="40" r="38" fill="url(#ng-bg-g)"/>
  <circle class="ng-ring" cx="40" cy="40" r="38" fill="none" stroke="#f59e0b" stroke-width="1.3" stroke-opacity=".45"/>
  <circle cx="40" cy="40" r="38" fill="url(#ng-glow-g)" class="ng-glow"/>
  <rect class="ng-pl" x="17" y="43" width="7" height="23" rx="1.5" fill="#fbbf24" opacity=".88"/>
  <rect class="ng-pr" x="56" y="43" width="7" height="23" rx="1.5" fill="#fbbf24" opacity=".88"/>
  <path class="ng-arch" d="M 17,43 A 23,23 0 0 1 63,43" fill="none" stroke="#fbbf24" stroke-width="3.2" stroke-linecap="round"/>
  <polygon class="ng-t1" points="25,64 30.5,50 36,64" fill="#d97706" opacity=".75"/>
  <polygon class="ng-t2" points="35,64 40,48 45,64" fill="#fbbf24" opacity=".9"/>
  <polygon class="ng-t3" points="44,64 49.5,50 55,64" fill="#d97706" opacity=".75"/>
</svg>`
  },

  // ── C: Hex V ─────────────────────────────────────────────────────────────
  // The CHOSEN logo — currently in use on the live site.
  // Hexagonal badge with 6 spokes that draw in sequence, then a V emerges.
  // The apex dot pulses continuously. Used in header, splash screen, admin panel.
  c: {
    title: 'Hex V',
    desc: 'Six amber spokes build the aperture, then a bold V emerges from the center — geometry meets monogram inside a hexagonal badge',
    css: `
.ha-bg{animation:ha-pop .45s cubic-bezier(.34,1.56,.64,1) both}
.ha-ring{stroke-dasharray:216;stroke-dashoffset:216;animation:ha-draw .68s ease-out .12s both}
.ha-inner{stroke-dasharray:180;stroke-dashoffset:180;animation:ha-draw .5s ease-out .4s both}
.ha-s1{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease .52s both}
.ha-s2{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease .63s both}
.ha-s3{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease .74s both}
.ha-s4{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease .85s both}
.ha-s5{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease .96s both}
.ha-s6{stroke-dasharray:31;stroke-dashoffset:31;animation:ha-spoke .34s ease 1.07s both}
.ha-vl{stroke-dasharray:33;stroke-dashoffset:33;animation:ha-vdraw .5s ease 1.28s both}
.ha-vr{stroke-dasharray:33;stroke-dashoffset:33;animation:ha-vdraw .5s ease 1.46s both}
.ha-vcl{transform-box:fill-box;transform-origin:center;animation:ha-pop .26s cubic-bezier(.34,1.56,.64,1) 1.62s both}
.ha-vcr{transform-box:fill-box;transform-origin:center;animation:ha-pop .26s cubic-bezier(.34,1.56,.64,1) 1.72s both}
.ha-vapex{transform-box:fill-box;transform-origin:center;animation:ha-pop .3s cubic-bezier(.34,1.56,.64,1) 1.82s both,ha-pulse 2.2s ease-in-out 2.3s infinite}
@keyframes ha-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes ha-draw{to{stroke-dashoffset:0}}
@keyframes ha-spoke{0%{stroke-dashoffset:31;opacity:0}100%{stroke-dashoffset:0;opacity:1}}
@keyframes ha-vdraw{0%{stroke-dashoffset:33;opacity:0}100%{stroke-dashoffset:0;opacity:1}}
@keyframes ha-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.7)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ha-bg-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1008"/>
      <stop offset="100%" stop-color="#080503"/>
    </linearGradient>
    <radialGradient id="ha-glow-g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ha-vglow-g" cx="50%" cy="72%" r="52%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".28"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <filter id="ha-vf" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="2.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Hex badge -->
  <polygon class="ha-bg" points="40,3 74,21.5 74,58.5 40,77 6,58.5 6,21.5" fill="url(#ha-bg-g)"/>
  <polygon points="40,3 74,21.5 74,58.5 40,77 6,58.5 6,21.5" fill="url(#ha-glow-g)"/>
  <!-- Outer ring -->
  <polygon class="ha-ring" points="40,3 74,21.5 74,58.5 40,77 6,58.5 6,21.5" fill="none" stroke="#f59e0b" stroke-width="1.3" stroke-opacity=".45" stroke-linejoin="round"/>
  <!-- Inner hex ring -->
  <polygon class="ha-inner" points="40,14 63,27 63,53 40,66 17,53 17,27" fill="none" stroke="#f59e0b" stroke-width=".85" stroke-opacity=".2" stroke-linejoin="round"/>
  <!-- Six spokes (amber, subdued) -->
  <line class="ha-s1" x1="40" y1="40" x2="67" y2="24" stroke="#b45309" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
  <line class="ha-s2" x1="40" y1="40" x2="40" y2="9"  stroke="#b45309" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
  <line class="ha-s3" x1="40" y1="40" x2="13" y2="24" stroke="#b45309" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
  <line class="ha-s4" x1="40" y1="40" x2="13" y2="56" stroke="#92400e" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
  <line class="ha-s5" x1="40" y1="40" x2="40" y2="71" stroke="#92400e" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
  <line class="ha-s6" x1="40" y1="40" x2="67" y2="56" stroke="#92400e" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
  <!-- V glow behind (blooms on top of spokes) -->
  <polygon points="40,3 74,21.5 74,58.5 40,77 6,58.5 6,21.5" fill="url(#ha-vglow-g)" class="ha-vl" style="animation:ha-vdraw .5s ease 1.28s both;stroke:none"/>
  <g filter="url(#ha-vf)" opacity=".55" class="ha-vl">
    <line x1="27" y1="21" x2="40" y2="53" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
    <line x1="53" y1="21" x2="40" y2="53" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
  </g>
  <!-- V arms (bright, drawn on top) -->
  <line class="ha-vl" x1="27" y1="21" x2="40" y2="53" stroke="#fcd34d" stroke-width="3.8" stroke-linecap="round"/>
  <line class="ha-vr" x1="53" y1="21" x2="40" y2="53" stroke="#fcd34d" stroke-width="3.8" stroke-linecap="round"/>
  <!-- V end caps -->
  <circle class="ha-vcl" cx="27" cy="21" r="2.2" fill="#d97706"/>
  <circle class="ha-vcr" cx="53" cy="21" r="2.2" fill="#d97706"/>
  <!-- V apex glow-dot (pulses forever after drawing in) -->
  <circle class="ha-vapex" cx="40" cy="53" r="3" fill="#fef3c7"/>
</svg>`
  }
};

// GET /logo-concept/:id — renders a logo concept preview page.
// :id is one of 'a', 'b', or 'c'. Returns 404 for any unknown id.
app.get('/logo-concept/:id', (req, res) => {
  const c = conceptDefs[req.params.id];
  if (!c) return res.status(404).send('Not found');
  res.send(buildConceptPage(req.params.id, c.title, c.desc, c.css, c.svg));
});

// ── Start server ──────────────────────────────────────────────────────────────
// Listens on all interfaces (0.0.0.0) so the reverse proxy can reach it.
// PORT env var can be set in the environment; defaults to 5000 locally.
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://localhost:' + PORT);
});
