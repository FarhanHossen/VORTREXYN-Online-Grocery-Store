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
    title: 'Draw & Bounce',
    desc: 'V strokes draw themselves, leaf tips spring out, shopping cart bounces up and bobs forever',
    css: `
.ca-bg{transform-box:fill-box;transform-origin:center;animation:ca-pop .5s cubic-bezier(.34,1.56,.64,1) both}
.ca-vl{stroke-dasharray:45;stroke-dashoffset:45;animation:ca-draw .55s ease-in-out .35s both}
.ca-vr{stroke-dasharray:45;stroke-dashoffset:45;animation:ca-draw .55s ease-in-out .6s both}
.ca-ll{transform-box:fill-box;transform-origin:center;animation:ca-pop .38s cubic-bezier(.34,1.56,.64,1) .92s both}
.ca-lr{transform-box:fill-box;transform-origin:center;animation:ca-pop .38s cubic-bezier(.34,1.56,.64,1) 1.07s both}
.ca-cart{transform-box:fill-box;transform-origin:center;animation:ca-cart-in .45s cubic-bezier(.34,1.56,.64,1) 1.22s both,ca-bob 2s ease-in-out 2.2s infinite}
@keyframes ca-pop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes ca-draw{to{stroke-dashoffset:0}}
@keyframes ca-cart-in{0%{opacity:0;transform:translateY(10px) scale(.7)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ca-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="cag" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#14532d"/></radialGradient></defs>
  <circle class="ca-bg" cx="40" cy="40" r="38" fill="url(#cag)"/>
  <line class="ca-vl" x1="18" y1="16" x2="40" y2="52" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <line class="ca-vr" x1="62" y1="16" x2="40" y2="52" stroke="white" stroke-width="5.5" stroke-linecap="round"/>
  <g class="ca-ll"><ellipse cx="15" cy="11" rx="7" ry="3.2" fill="white" opacity=".92" transform="rotate(-42 15 11)"/></g>
  <g class="ca-lr"><ellipse cx="65" cy="11" rx="7" ry="3.2" fill="white" opacity=".92" transform="rotate(42 65 11)"/></g>
  <g class="ca-cart">
    <rect x="33" y="54" width="14" height="9" rx="2" fill="none" stroke="white" stroke-width="2.2"/>
    <path d="M 34.5,54 Q 40,48.5 45.5,54" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="36" cy="64.5" r="2" fill="white"/><circle cx="44" cy="64.5" r="2" fill="white"/>
  </g>
</svg>`
  },
  b: {
    title: 'Basket Build',
    desc: 'Basket body rises up, curved handles arc in forming the V, produce falls and bounces in with a continuous sway',
    css: `
.cb-bg{transform-box:fill-box;transform-origin:center;animation:cb-pop .48s cubic-bezier(.34,1.56,.64,1) both}
.cb-body{animation:cb-rise .4s ease-out .35s both}
.cb-grid{animation:cb-fade .3s ease .6s both}
.cb-hl{stroke-dasharray:55;stroke-dashoffset:55;animation:cb-draw .52s ease-in-out .6s both}
.cb-hr{stroke-dasharray:55;stroke-dashoffset:55;animation:cb-draw .52s ease-in-out .78s both}
.cb-p1{transform-box:fill-box;transform-origin:center;animation:cb-fall .38s cubic-bezier(.34,1.56,.64,1) 1.1s both,cb-sway 1.8s ease-in-out 2s infinite}
.cb-p2{transform-box:fill-box;transform-origin:center;animation:cb-fall .38s cubic-bezier(.34,1.56,.64,1) 1.28s both,cb-sway 1.8s ease-in-out 2.2s infinite}
.cb-p3{transform-box:fill-box;transform-origin:center;animation:cb-fall .38s cubic-bezier(.34,1.56,.64,1) 1.46s both,cb-sway 1.8s ease-in-out 2.4s infinite}
@keyframes cb-pop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
@keyframes cb-rise{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
@keyframes cb-fade{0%{opacity:0}100%{opacity:.55}}
@keyframes cb-draw{to{stroke-dashoffset:0}}
@keyframes cb-fall{0%{opacity:0;transform:translateY(-22px) scale(.6)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes cb-sway{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(3deg)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="cbg" cx="40%" cy="25%" r="75%"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#14532d"/></radialGradient></defs>
  <circle class="cb-bg" cx="40" cy="40" r="38" fill="url(#cbg)"/>
  <g class="cb-body">
    <rect x="26" y="50" width="28" height="17" rx="3" fill="none" stroke="white" stroke-width="2.5"/>
  </g>
  <g class="cb-grid">
    <line x1="26" y1="57" x2="54" y2="57" stroke="white" stroke-width="1.1"/><line x1="26" y1="63" x2="54" y2="63" stroke="white" stroke-width="1.1"/>
    <line x1="35" y1="50" x2="35" y2="67" stroke="white" stroke-width="1.1"/><line x1="45" y1="50" x2="45" y2="67" stroke="white" stroke-width="1.1"/>
  </g>
  <path class="cb-hl" d="M 18,15 Q 10,37 28,51" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <path class="cb-hr" d="M 62,15 Q 70,37 52,51" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <g class="cb-p1"><circle cx="32" cy="46" r="5.5" fill="#ef4444"/><line x1="32" y1="40.5" x2="33.5" y2="37.5" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/></g>
  <g class="cb-p2"><circle cx="40" cy="43" r="5.5" fill="#f97316"/></g>
  <g class="cb-p3"><circle cx="48" cy="46" r="5.5" fill="#86efac"/></g>
</svg>`
  },
  c: {
    title: 'V Grow & Breathe',
    desc: 'V arms grow outward from the tip like a sprouting plant, leaves unfurl and breathe continuously',
    css: `
.cc-bg{transform-box:fill-box;transform-origin:center;animation:cc-pop .45s cubic-bezier(.34,1.56,.64,1) both}
.cc-seed{transform-box:fill-box;transform-origin:center;animation:cc-seed-in .35s cubic-bezier(.34,1.56,.64,1) .3s both}
.cc-vl{stroke-dasharray:46;stroke-dashoffset:46;animation:cc-draw .55s ease-in-out .52s both}
.cc-vr{stroke-dasharray:46;stroke-dashoffset:46;animation:cc-draw .55s ease-in-out .72s both}
.cc-ll{transform-box:fill-box;transform-origin:center;animation:cc-leaf .4s cubic-bezier(.34,1.56,.64,1) 1.0s both,cc-breathe 2.4s ease-in-out 2s infinite}
.cc-lr{transform-box:fill-box;transform-origin:center;animation:cc-leaf .4s cubic-bezier(.34,1.56,.64,1) 1.15s both,cc-breathe 2.4s ease-in-out 2.2s infinite}
.cc-cart{transform-box:fill-box;transform-origin:center;animation:cc-fade-in .4s ease 1.3s both}
@keyframes cc-pop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
@keyframes cc-seed-in{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
@keyframes cc-draw{to{stroke-dashoffset:0}}
@keyframes cc-leaf{0%{opacity:0;transform:scale(0) rotate(-30deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}
@keyframes cc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes cc-fade-in{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}`,
    svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="ccg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f4c2a"/><stop offset="100%" stop-color="#1e7a40"/></linearGradient></defs>
  <rect class="cc-bg" x="4" y="4" width="72" height="72" rx="18" fill="url(#ccg)"/>
  <rect x="4" y="4" width="72" height="72" rx="18" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="2"/>
  <circle class="cc-seed" cx="40" cy="52" r="3.5" fill="#4ade80"/>
  <line class="cc-vl" x1="40" y1="52" x2="18" y2="18" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line class="cc-vr" x1="40" y1="52" x2="62" y2="18" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <g class="cc-ll"><ellipse cx="16" cy="15" rx="7.5" ry="3.2" fill="white" opacity=".9" transform="rotate(-42 16 15)"/></g>
  <g class="cc-lr"><ellipse cx="64" cy="15" rx="7.5" ry="3.2" fill="white" opacity=".9" transform="rotate(42 64 15)"/></g>
  <g class="cc-cart">
    <rect x="33" y="56" width="14" height="9" rx="2" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2"/>
    <path d="M 34.5,56 Q 40,50.5 45.5,56" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="36" cy="66.5" r="1.8" fill="rgba(255,255,255,.8)"/><circle cx="44" cy="66.5" r="1.8" fill="rgba(255,255,255,.8)"/>
  </g>
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
