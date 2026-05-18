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
body{font-family:Inter,sans-serif;background:#f0f4f0;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:36px 24px;gap:28px}
.badge{font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;border-radius:20px;padding:4px 12px;letter-spacing:.08em;text-transform:uppercase}
.ttl{font-size:24px;font-weight:800;color:#111827}
.dsc{font-size:13px;color:#6b7280;text-align:center;max-width:300px;line-height:1.5}
.big-logo svg{height:160px;width:160px;filter:drop-shadow(0 10px 28px rgba(0,0,0,.22))}
.sec-lbl{font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase}
.nav-wrap{border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)}
.nav-bar{background:#1a2e1a;padding:12px 22px;display:flex;align-items:center;gap:14px}
.nav-bar svg{height:50px;width:auto}
.nav-txt-wrap{display:flex;flex-direction:column}
.nav-name{font-size:17px;font-weight:800;color:white;letter-spacing:2px}
.nav-sub{font-size:9px;font-weight:500;color:rgba(255,255,255,.55);letter-spacing:1px;margin-top:2px}
.auth-wrap{border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.10);background:white;padding:28px 36px;display:flex;flex-direction:column;align-items:center;gap:10px}
.auth-wrap svg{height:76px;width:auto}
.auth-h{font-size:20px;font-weight:800;color:#111827}
.auth-p{font-size:12px;color:#6b7280}
.replay{margin-top:4px;padding:8px 20px;border:2px solid #16a34a;border-radius:20px;color:#16a34a;font-weight:700;font-size:13px;background:none;cursor:pointer;transition:.2s}
.replay:hover{background:#16a34a;color:white}
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
    title: 'Neon Volt',
    desc: 'Almost-black badge, electric neon-green V charges up from the base with a glow, leaf & cart tips light up last',
    css: `
.na-bg{transform-box:fill-box;transform-origin:center;animation:na-pop .42s cubic-bezier(.34,1.56,.64,1) both}
.na-vl{stroke-dasharray:44;stroke-dashoffset:44;animation:na-charge .6s ease-in .32s both}
.na-vr{stroke-dasharray:44;stroke-dashoffset:44;animation:na-charge .6s ease-in .52s both}
.na-dot{transform-box:fill-box;transform-origin:center;animation:na-pop .3s cubic-bezier(.34,1.56,.64,1) .88s both,na-pulse 1.8s ease-in-out 1.5s infinite}
.na-leaf{transform-box:fill-box;transform-origin:center;animation:na-pop .35s cubic-bezier(.34,1.56,.64,1) 1.02s both}
.na-cart{transform-box:fill-box;transform-origin:center;animation:na-pop .35s cubic-bezier(.34,1.56,.64,1) 1.18s both}
.na-glow{animation:na-glow-in .6s ease .4s both}
@keyframes na-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes na-charge{0%{stroke-dashoffset:44;opacity:.3}60%{opacity:1}100%{stroke-dashoffset:0;opacity:1}}
@keyframes na-pulse{0%,100%{opacity:1;r:3.5}50%{opacity:.6;r:5}}
@keyframes na-glow-in{0%{opacity:0}100%{opacity:1}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="nag" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#020d04"/><stop offset="100%" stop-color="#0a2210"/></linearGradient>
    <filter id="naf" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect class="na-bg" x="2" y="2" width="76" height="76" rx="18" fill="url(#nag)"/>
  <rect x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="#1a5c2a" stroke-width="1.5"/>
  <g class="na-glow" filter="url(#naf)" opacity=".55">
    <line x1="18" y1="22" x2="40" y2="57" stroke="#4ade80" stroke-width="7" stroke-linecap="round"/>
    <line x1="62" y1="22" x2="40" y2="57" stroke="#4ade80" stroke-width="7" stroke-linecap="round"/>
  </g>
  <line class="na-vl" x1="18" y1="22" x2="40" y2="57" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>
  <line class="na-vr" x1="62" y1="22" x2="40" y2="57" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>
  <circle class="na-dot" cx="40" cy="57" r="3.5" fill="#4ade80"/>
  <g class="na-leaf"><ellipse cx="15" cy="18" rx="6.5" ry="2.8" fill="#22c55e" opacity=".95" transform="rotate(-42 15 18)"/></g>
  <g class="na-cart">
    <rect x="56" y="14" width="10" height="7" rx="1.5" fill="none" stroke="#4ade80" stroke-width="1.8"/>
    <path d="M 57,14 Q 61,10 65,14" fill="none" stroke="#4ade80" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="59" cy="22.5" r="1.5" fill="#4ade80"/><circle cx="64" cy="22.5" r="1.5" fill="#4ade80"/>
  </g>
</svg>`
  },
  b: {
    title: 'Sprout Pot',
    desc: 'A planter pot drops in, two organic stems grow upward forming the V, an apple and carrot spring out at the tips',
    css: `
.pb-bg{transform-box:fill-box;transform-origin:center;animation:pb-pop .45s cubic-bezier(.34,1.56,.64,1) both}
.pb-pot{transform-box:fill-box;transform-origin:center;animation:pb-drop .45s cubic-bezier(.34,1.56,.64,1) .28s both}
.pb-sl{stroke-dasharray:50;stroke-dashoffset:50;animation:pb-grow .55s ease-in-out .62s both}
.pb-sr{stroke-dasharray:50;stroke-dashoffset:50;animation:pb-grow .55s ease-in-out .8s both}
.pb-apple{transform-box:fill-box;transform-origin:center;animation:pb-pop .4s cubic-bezier(.34,1.56,.64,1) 1.1s both,pb-bob 2.2s ease-in-out 2s infinite}
.pb-carrot{transform-box:fill-box;transform-origin:center;animation:pb-pop .4s cubic-bezier(.34,1.56,.64,1) 1.28s both,pb-bob 2.2s ease-in-out 2.2s infinite}
.pb-leaf{transform-box:fill-box;transform-origin:center;animation:pb-pop .35s cubic-bezier(.34,1.56,.64,1) 1.46s both}
@keyframes pb-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes pb-drop{0%{opacity:0;transform:translateY(-18px) scale(.7)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes pb-grow{to{stroke-dashoffset:0}}
@keyframes pb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="pbg" cx="40%" cy="20%" r="80%"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#065f46"/></radialGradient></defs>
  <circle class="pb-bg" cx="40" cy="40" r="38" fill="url(#pbg)"/>
  <g class="pb-pot">
    <path d="M 28,70 L 25,59 L 55,59 L 52,70 Z" fill="rgba(255,255,255,.88)" stroke="rgba(255,255,255,.4)" stroke-width=".8"/>
    <rect x="23" y="56" width="34" height="5" rx="2.5" fill="rgba(255,255,255,.7)"/>
  </g>
  <path class="pb-sl" d="M 40,56 Q 27,44 15,20" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <path class="pb-sr" d="M 40,56 Q 53,44 65,20" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <g class="pb-apple">
    <circle cx="13" cy="16" r="6.5" fill="#ef4444"/>
    <path d="M 13,9.5 Q 15,6 18,7.5" fill="none" stroke="#15803d" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="11" cy="14" rx="2.5" ry="1.2" fill="rgba(255,255,255,.3)" transform="rotate(-20 11 14)"/>
  </g>
  <g class="pb-carrot">
    <ellipse cx="67" cy="17" rx="5" ry="7.5" fill="#f97316"/>
    <line x1="64" y1="10" x2="62" y2="6.5" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="67" y1="9.5" x2="67" y2="5.5" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="70" y1="10" x2="72" y2="6.5" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <ellipse class="pb-leaf" cx="40" cy="53" rx="6" ry="2.5" fill="#a7f3d0" opacity=".9"/>
</svg>`
  },
  c: {
    title: 'Sunrise Market',
    desc: 'Seven rays fan out from the center like a harvest sunrise, each lighting up from the middle outward — teal, modern, bold',
    css: `
.sm-bg{transform-box:fill-box;transform-origin:center;animation:sm-pop .42s cubic-bezier(.34,1.56,.64,1) both}
.sm-bowl{stroke-dasharray:30;stroke-dashoffset:30;animation:sm-draw .4s ease-out .3s both}
.sm-r4{stroke-dasharray:23;stroke-dashoffset:23;animation:sm-ray .38s ease-out .38s both}
.sm-r3,.sm-r5{stroke-dasharray:23;stroke-dashoffset:23;animation:sm-ray .38s ease-out .52s both}
.sm-r2,.sm-r6{stroke-dasharray:23;stroke-dashoffset:23;animation:sm-ray .38s ease-out .66s both}
.sm-r1,.sm-r7{stroke-dasharray:23;stroke-dashoffset:23;animation:sm-ray .38s ease-out .8s both}
.sm-dot{transform-box:fill-box;transform-origin:center;animation:sm-pop .3s cubic-bezier(.34,1.56,.64,1) .95s both,sm-breathe 2.6s ease-in-out 1.8s infinite}
.sm-tagline{animation:sm-fade .5s ease 1.1s both}
@keyframes sm-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes sm-ray{to{stroke-dashoffset:0}}
@keyframes sm-draw{to{stroke-dashoffset:0}}
@keyframes sm-breathe{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes sm-fade{0%{opacity:0}100%{opacity:.8}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="smg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0d9488"/><stop offset="100%" stop-color="#047857"/></linearGradient></defs>
  <rect class="sm-bg" x="2" y="2" width="76" height="76" rx="18" fill="url(#smg)"/>
  <rect x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>
  <path class="sm-bowl" d="M 26,61 Q 40,68 54,61" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5" stroke-linecap="round"/>
  <line class="sm-r4" x1="40" y1="58" x2="40" y2="36" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r3" x1="40" y1="58" x2="32" y2="37" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r5" x1="40" y1="58" x2="48" y2="37" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r2" x1="40" y1="58" x2="26" y2="41" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r6" x1="40" y1="58" x2="54" y2="41" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r1" x1="40" y1="58" x2="21" y2="47" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="sm-r7" x1="40" y1="58" x2="59" y2="47" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <circle class="sm-dot" cx="40" cy="58" r="5" fill="#99f6e4"/>
  <text class="sm-tagline" x="40" y="23" font-family="Inter,sans-serif" font-size="7.5" font-weight="700" fill="white" text-anchor="middle" letter-spacing="1.5">FRESH MARKET</text>
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
