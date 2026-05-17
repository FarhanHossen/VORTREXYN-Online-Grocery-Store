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
const logoConcepts = {
  a: {
    name: 'Fresh Basket',
    desc: 'V formed by basket handles — produce peeking out top',
    icon: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="ga" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#14532d"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#ga)"/>
      <path d="M 18 15 Q 10 38 28 51" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 62 15 Q 70 38 52 51" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round"/>
      <rect x="26" y="50" width="28" height="17" rx="3" fill="none" stroke="white" stroke-width="2.5"/>
      <line x1="26" y1="57" x2="54" y2="57" stroke="white" stroke-width="1.2" opacity="0.55"/>
      <line x1="26" y1="63" x2="54" y2="63" stroke="white" stroke-width="1.2" opacity="0.55"/>
      <line x1="35" y1="50" x2="35" y2="67" stroke="white" stroke-width="1.2" opacity="0.55"/>
      <line x1="45" y1="50" x2="45" y2="67" stroke="white" stroke-width="1.2" opacity="0.55"/>
      <circle cx="32" cy="49" r="5" fill="#ef4444"/>
      <circle cx="40" cy="46" r="5" fill="#f97316"/>
      <circle cx="48" cy="49" r="5" fill="#86efac"/>
      <line x1="32" y1="44" x2="33.5" y2="41" stroke="#15803d" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    text_color: 'white',
    sub_color: 'rgba(255,255,255,0.6)'
  },
  b: {
    name: 'Garden Leaf V',
    desc: 'V arms are organic leaf shapes — botanical, fresh',
    icon: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#052e16"/></linearGradient></defs>
      <polygon points="40,3 73,21.5 73,58.5 40,77 7,58.5 7,21.5" fill="url(#gb)"/>
      <path d="M 21,13 C 5,17 3,34 21,48 C 26,36 28,22 40,16 C 33,12 25,11 21,13 Z" fill="white" opacity="0.93"/>
      <path d="M 21,13 Q 26,30 30,48" fill="none" stroke="#16a34a" stroke-width="1.4"/>
      <path d="M 59,13 C 75,17 77,34 59,48 C 54,36 52,22 40,16 C 47,12 55,11 59,13 Z" fill="white" opacity="0.93"/>
      <path d="M 59,13 Q 54,30 50,48" fill="none" stroke="#16a34a" stroke-width="1.4"/>
      <circle cx="40" cy="49" r="5" fill="#4ade80"/>
      <circle cx="40" cy="49" r="2.5" fill="#15803d"/>
    </svg>`,
    text_color: 'white',
    sub_color: 'rgba(255,255,255,0.6)'
  },
  c: {
    name: 'Market Shield',
    desc: 'Bold V on a shield badge — premium, modern, professional',
    icon: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f4c2a"/><stop offset="100%" stop-color="#1e7a40"/></linearGradient></defs>
      <rect x="4" y="4" width="72" height="72" rx="18" fill="url(#gc)"/>
      <rect x="4" y="4" width="72" height="72" rx="18" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <polyline points="15,18 40,50 65,18" fill="none" stroke="white" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="32.5" y="55" width="15" height="10" rx="2.5" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.2"/>
      <path d="M 34,55 Q 40,49 46,55" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="36" cy="66.5" r="2" fill="rgba(255,255,255,0.85)"/>
      <circle cx="44" cy="66.5" r="2" fill="rgba(255,255,255,0.85)"/>
    </svg>`,
    text_color: 'white',
    sub_color: 'rgba(255,255,255,0.55)'
  }
};

app.get('/logo-concept/:id', (req, res) => {
  const c = logoConcepts[req.params.id];
  if (!c) return res.status(404).send('Not found');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Inter,sans-serif;background:#f8faf8;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;gap:32px}
  .label{font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;text-align:center}
  .title{font-size:22px;font-weight:800;color:#111827;text-align:center;margin-top:4px}
  .desc{font-size:13px;color:#6b7280;text-align:center;margin-top:4px;max-width:280px}
  .preview-box{border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}
  .nav-bar{background:#1a2e1a;padding:14px 24px;display:flex;align-items:center;gap:14px}
  .nav-bar svg{height:52px;width:auto}
  .nav-text{display:flex;flex-direction:column}
  .nav-name{font-size:17px;font-weight:800;color:${c.text_color};letter-spacing:2px}
  .nav-sub{font-size:9.5px;font-weight:500;color:${c.sub_color};letter-spacing:1px;margin-top:2px}
  .auth-box{background:white;padding:32px;display:flex;flex-direction:column;align-items:center;gap:12px}
  .auth-box svg{height:80px;width:auto}
  .auth-h1{font-size:22px;font-weight:800;color:#111827}
  .auth-p{font-size:13px;color:#6b7280}
  .icon-box{display:flex;justify-content:center}
  .icon-box svg{height:160px;width:160px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.18))}
</style></head><body>
<div class="label">Concept ${req.params.id.toUpperCase()}</div>
<div class="title">${c.name}</div>
<div class="desc">${c.desc}</div>
<div class="icon-box">${c.icon}</div>
<div style="font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:.04em">IN NAVBAR</div>
<div class="preview-box">
  <div class="nav-bar">
    ${c.icon.replace('viewBox="0 0 80 80"','viewBox="0 0 80 80" style="height:52px"')}
    <div class="nav-text">
      <span class="nav-name">VORTREXYN</span>
      <span class="nav-sub">Online Grocery Store</span>
    </div>
  </div>
</div>
<div style="font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:.04em">ON AUTH CARD</div>
<div class="preview-box">
  <div class="auth-box">
    ${c.icon.replace('viewBox="0 0 80 80"','viewBox="0 0 80 80" style="height:80px"')}
    <div class="auth-h1">Welcome back</div>
    <div class="auth-p">Sign in to your account</div>
  </div>
</div>
</body></html>`);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://localhost:' + PORT);
});
