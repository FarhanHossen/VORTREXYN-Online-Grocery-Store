require('dotenv').config();
require('ejs');
const express    = require('express');
const path       = require('path');
const bodyParser = require('body-parser');
const session    = require('express-session');
const PgSession  = require('connect-pg-simple')(session);
const db         = require('./config/db');

const app = express();

app.use(session({
  store: new PgSession({
    pool:                 db.pool,
    tableName:            'session',
    createTableIfMissing: true,
  }),
  secret:            process.env.SESSION_SECRET || 'groceries2025',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'assets')));

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

app.use('/',         require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart',     require('./routes/cart'));
app.use('/auth',     require('./routes/auth'));
app.use('/account',  require('./routes/account'));
app.use('/admin',    require('./routes/admin'));

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
