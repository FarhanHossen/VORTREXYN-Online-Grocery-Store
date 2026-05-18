require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();

app.use(session({
  secret: 'groceries2025',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'assets')));

// Make user + Firebase config available in all templates
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

app.use('/', require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));

// ── Logo concept previews (temporary design exploration) ──────────────────
function buildConceptPage(id, title, desc, animCSS, svgBody) {
  const base = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,sans-serif;background:#fffbf5;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:36px 24px;gap:28px}
.badge{font-size:11px;font-weight:700;color:#d97706;background:#fef3c7;border-radius:20px;padding:4px 12px;letter-spacing:.08em;text-transform:uppercase}
.ttl{font-size:24px;font-weight:800;color:#2d1f0f}
.dsc{font-size:13px;color:#6b5744;text-align:center;max-width:300px;line-height:1.5}
.big-logo svg{height:160px;width:160px;filter:drop-shadow(0 10px 28px rgba(28,15,0,.28))}
.sec-lbl{font-size:11px;font-weight:600;color:#a38c6e;letter-spacing:.07em;text-transform:uppercase}
.nav-wrap{border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(28,15,0,.18)}
.nav-bar{background:#1c0f00;padding:12px 22px;display:flex;align-items:center;gap:14px}
.nav-bar svg{height:50px;width:auto}
.nav-txt-wrap{display:flex;flex-direction:column}
.nav-name{font-size:17px;font-weight:800;color:white;letter-spacing:2px}
.nav-sub{font-size:9px;font-weight:500;color:rgba(255,255,255,.5);letter-spacing:1px;margin-top:2px}
.auth-wrap{border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(28,15,0,.10);background:white;padding:28px 36px;display:flex;flex-direction:column;align-items:center;gap:10px}
.auth-wrap svg{height:76px;width:auto}
.auth-h{font-size:20px;font-weight:800;color:#2d1f0f}
.auth-p{font-size:12px;color:#6b5744}
.replay{margin-top:4px;padding:8px 20px;border:2px solid #d97706;border-radius:20px;color:#d97706;font-weight:700;font-size:13px;background:none;cursor:pointer;transition:.2s}
.replay:hover{background:#d97706;color:white}
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

const conceptDefs = {
  a: {
    title: 'Ember Charge',
    desc: 'Near-black warm badge, a bold amber V charges upward from the base like a bolt of energy — glow pulses at the tip',
    css: `
.ea-bg{transform-box:fill-box;transform-origin:center;animation:ea-pop .42s cubic-bezier(.34,1.56,.64,1) both}
.ea-vl{stroke-dasharray:46;stroke-dashoffset:46;animation:ea-charge .62s ease-in .3s both}
.ea-vr{stroke-dasharray:46;stroke-dashoffset:46;animation:ea-charge .62s ease-in .5s both}
.ea-dot{transform-box:fill-box;transform-origin:center;animation:ea-pop .3s cubic-bezier(.34,1.56,.64,1) .9s both,ea-pulse 2s ease-in-out 1.4s infinite}
.ea-wheat{transform-box:fill-box;transform-origin:center;animation:ea-pop .35s cubic-bezier(.34,1.56,.64,1) 1.05s both}
.ea-basket{transform-box:fill-box;transform-origin:center;animation:ea-pop .35s cubic-bezier(.34,1.56,.64,1) 1.2s both}
.ea-glow{animation:ea-glow-in .65s ease .35s both}
.ea-ring{stroke-dasharray:240;stroke-dashoffset:240;animation:ea-ring .8s ease-out .1s both}
@keyframes ea-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes ea-charge{0%{stroke-dashoffset:46;opacity:.25}55%{opacity:1}100%{stroke-dashoffset:0;opacity:1}}
@keyframes ea-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
@keyframes ea-glow-in{0%{opacity:0}100%{opacity:1}}
@keyframes ea-ring{to{stroke-dashoffset:0}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eag" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#0d0700"/><stop offset="100%" stop-color="#2d1400"/></linearGradient>
    <filter id="eaf" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="eaglow" cx="50%" cy="75%" r="45%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".35"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect class="ea-bg" x="2" y="2" width="76" height="76" rx="18" fill="url(#eag)"/>
  <rect class="ea-ring" x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity=".5"/>
  <rect x="2" y="2" width="76" height="76" rx="18" fill="url(#eaglow)"/>
  <g class="ea-glow" filter="url(#eaf)" opacity=".6">
    <line x1="18" y1="20" x2="40" y2="58" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/>
    <line x1="62" y1="20" x2="40" y2="58" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/>
  </g>
  <line class="ea-vl" x1="18" y1="20" x2="40" y2="58" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
  <line class="ea-vr" x1="62" y1="20" x2="40" y2="58" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
  <circle class="ea-dot" cx="40" cy="58" r="3.5" fill="#fcd34d"/>
  <g class="ea-wheat">
    <ellipse cx="14" cy="16" rx="5.5" ry="2.5" fill="#fbbf24" opacity=".9" transform="rotate(-38 14 16)"/>
    <line x1="16.5" y1="18.5" x2="19" y2="22" stroke="#d97706" stroke-width="1.4" stroke-linecap="round"/>
  </g>
  <g class="ea-basket">
    <rect x="56" y="13" width="11" height="7.5" rx="1.5" fill="none" stroke="#fbbf24" stroke-width="1.8"/>
    <line x1="56" y1="16.5" x2="67" y2="16.5" stroke="#fbbf24" stroke-width=".9" opacity=".6"/>
    <line x1="61.5" y1="13" x2="61.5" y2="20.5" stroke="#fbbf24" stroke-width=".9" opacity=".6"/>
    <path d="M 57,13 Q 61.5,9 66,13" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="58.5" cy="22.5" r="1.5" fill="#fbbf24"/><circle cx="64.5" cy="22.5" r="1.5" fill="#fbbf24"/>
  </g>
</svg>`
  },
  b: {
    title: 'Golden Basket',
    desc: 'Warm dark-brown circle, amber V handles arc in from the top, golden basket body rises from below with fresh produce',
    css: `
.gb-bg{transform-box:fill-box;transform-origin:center;animation:gb-pop .48s cubic-bezier(.34,1.56,.64,1) both}
.gb-body{animation:gb-rise .42s ease-out .32s both}
.gb-grid{animation:gb-fade .32s ease .62s both}
.gb-hl{stroke-dasharray:44;stroke-dashoffset:44;animation:gb-draw .54s ease-in-out .58s both}
.gb-hr{stroke-dasharray:44;stroke-dashoffset:44;animation:gb-draw .54s ease-in-out .76s both}
.gb-p1{transform-box:fill-box;transform-origin:center;animation:gb-fall .4s cubic-bezier(.34,1.56,.64,1) 1.08s both,gb-sway 1.9s ease-in-out 2s infinite}
.gb-p2{transform-box:fill-box;transform-origin:center;animation:gb-fall .4s cubic-bezier(.34,1.56,.64,1) 1.26s both,gb-sway 1.9s ease-in-out 2.15s infinite}
.gb-p3{transform-box:fill-box;transform-origin:center;animation:gb-fall .4s cubic-bezier(.34,1.56,.64,1) 1.44s both,gb-sway 1.9s ease-in-out 2.3s infinite}
.gb-rim{stroke-dasharray:252;stroke-dashoffset:252;animation:gb-ring .7s ease-out .05s both}
@keyframes gb-pop{0%{opacity:0;transform:scale(.25)}100%{opacity:1;transform:scale(1)}}
@keyframes gb-rise{0%{opacity:0;transform:translateY(9px)}100%{opacity:1;transform:translateY(0)}}
@keyframes gb-fade{0%{opacity:0}100%{opacity:.52}}
@keyframes gb-draw{to{stroke-dashoffset:0}}
@keyframes gb-fall{0%{opacity:0;transform:translateY(-13px) scale(.55)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes gb-sway{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(4deg)}}
@keyframes gb-ring{to{stroke-dashoffset:0}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gbg" cx="38%" cy="28%" r="74%">
      <stop offset="0%" stop-color="#4a2800"/>
      <stop offset="100%" stop-color="#1c0f00"/>
    </radialGradient>
    <radialGradient id="gbglow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="40" cy="40" r="40" fill="url(#gbglow)"/>
  <circle class="gb-bg" cx="40" cy="40" r="38" fill="url(#gbg)"/>
  <circle class="gb-rim" cx="40" cy="40" r="38" fill="none" stroke="#f59e0b" stroke-width="1.4" stroke-opacity=".5"/>
  <g class="gb-body">
    <rect x="26" y="50" width="28" height="17" rx="3" fill="none" stroke="#fcd34d" stroke-width="2.5"/>
  </g>
  <g class="gb-grid">
    <line x1="26" y1="57" x2="54" y2="57" stroke="#fcd34d" stroke-width="1.1"/>
    <line x1="26" y1="63" x2="54" y2="63" stroke="#fcd34d" stroke-width="1.1"/>
    <line x1="35" y1="50" x2="35" y2="67" stroke="#fcd34d" stroke-width="1.1"/>
    <line x1="45" y1="50" x2="45" y2="67" stroke="#fcd34d" stroke-width="1.1"/>
  </g>
  <path class="gb-hl" d="M 18,13 Q 10,35 28,51" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
  <path class="gb-hr" d="M 62,13 Q 70,35 52,51" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
  <g class="gb-p1"><circle cx="32" cy="46" r="5.5" fill="#ef4444"/><line x1="32" y1="40.5" x2="33.5" y2="37.5" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round"/></g>
  <g class="gb-p2"><circle cx="40" cy="43" r="5.5" fill="#f59e0b"/></g>
  <g class="gb-p3"><circle cx="48" cy="46" r="5.5" fill="#fcd34d"/></g>
</svg>`
  },
  c: {
    title: 'Harvest Sun',
    desc: 'Seven golden rays fan out from a warm center like a harvest sunrise, basket arc below — bold, iconic, organic market',
    css: `
.hs-bg{transform-box:fill-box;transform-origin:center;animation:hs-pop .42s cubic-bezier(.34,1.56,.64,1) both}
.hs-bowl{stroke-dasharray:32;stroke-dashoffset:32;animation:hs-draw .42s ease-out .28s both}
.hs-r4{stroke-dasharray:24;stroke-dashoffset:24;animation:hs-ray .38s ease-out .36s both}
.hs-r3,.hs-r5{stroke-dasharray:24;stroke-dashoffset:24;animation:hs-ray .38s ease-out .5s both}
.hs-r2,.hs-r6{stroke-dasharray:24;stroke-dashoffset:24;animation:hs-ray .38s ease-out .64s both}
.hs-r1,.hs-r7{stroke-dasharray:24;stroke-dashoffset:24;animation:hs-ray .38s ease-out .78s both}
.hs-core{transform-box:fill-box;transform-origin:center;animation:hs-pop .3s cubic-bezier(.34,1.56,.64,1) .95s both,hs-breathe 2.8s ease-in-out 1.8s infinite}
.hs-txt{animation:hs-fade .55s ease 1.12s both}
.hs-ring{stroke-dasharray:240;stroke-dashoffset:240;animation:hs-ring .75s ease-out .08s both}
@keyframes hs-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes hs-ray{to{stroke-dashoffset:0}}
@keyframes hs-draw{to{stroke-dashoffset:0}}
@keyframes hs-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.18)}}
@keyframes hs-fade{0%{opacity:0}100%{opacity:.82}}
@keyframes hs-ring{to{stroke-dashoffset:0}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hsg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2d1400"/>
      <stop offset="100%" stop-color="#1c0f00"/>
    </linearGradient>
    <radialGradient id="hscore" cx="50%" cy="72%" r="38%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity=".4"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect class="hs-bg" x="2" y="2" width="76" height="76" rx="18" fill="url(#hsg)"/>
  <rect x="2" y="2" width="76" height="76" rx="18" fill="url(#hscore)"/>
  <rect class="hs-ring" x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="#f59e0b" stroke-width="1.4" stroke-opacity=".45"/>
  <path class="hs-bowl" d="M 24,63 Q 40,71 56,63" fill="none" stroke="#fcd34d" stroke-width="2.8" stroke-linecap="round"/>
  <line class="hs-r4" x1="40" y1="60" x2="40" y2="37" stroke="#fbbf24" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r3" x1="40" y1="60" x2="31" y2="38" stroke="#f59e0b" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r5" x1="40" y1="60" x2="49" y2="38" stroke="#f59e0b" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r2" x1="40" y1="60" x2="24" y2="43" stroke="#d97706" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r6" x1="40" y1="60" x2="56" y2="43" stroke="#d97706" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r1" x1="40" y1="60" x2="19" y2="50" stroke="#b45309" stroke-width="5.5" stroke-linecap="round"/>
  <line class="hs-r7" x1="40" y1="60" x2="61" y2="50" stroke="#b45309" stroke-width="5.5" stroke-linecap="round"/>
  <circle class="hs-core" cx="40" cy="60" r="5.5" fill="#fef3c7"/>
  <text class="hs-txt" x="40" y="24" font-family="Inter,sans-serif" font-size="7" font-weight="800" fill="#fbbf24" text-anchor="middle" letter-spacing="1.8">FRESH MARKET</text>
</svg>`
  }
};

app.get('/logo-concept/:id', (req, res) => {
  const c = conceptDefs[req.params.id];
  if (!c) return res.status(404).send('Not found');
  res.send(buildConceptPage(req.params.id, c.title, c.desc, c.css, c.svg));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://localhost:' + PORT);
});
