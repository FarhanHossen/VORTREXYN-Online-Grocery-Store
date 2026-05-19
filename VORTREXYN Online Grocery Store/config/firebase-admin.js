// ============================================================
// config/firebase-admin.js — Firebase Admin SDK initialisation
//
// Gives the server privileged access to Firebase services:
//   - admin.firestore()  → read/write any Firestore document
//   - admin.auth()       → verify ID tokens, delete user accounts
//   - admin.storage()    → upload product images to Firebase Storage
//
// Credentials are loaded entirely from environment variables —
// no secrets are hardcoded in this file.
//
// Required environment variables:
//   FIREBASE_PRIVATE_KEY   — the PEM private key from the service account JSON
//                            (in Netlify, paste the key with literal \n characters)
//   FIREBASE_CLIENT_EMAIL  — the service account email address
//
// The guard `if (!admin.apps.length)` prevents double-initialisation when
// this module is required from multiple files.
// ============================================================

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type:                        'service_account',
      project_id:                  'vortrexyn-online-grocery-store',
      private_key_id:              '935dd1c90a9712f16fdb07c3966ca87408cf4004',
      private_key:                 (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      client_email:                process.env.FIREBASE_CLIENT_EMAIL,
      client_id:                   '112782026558242818527',
      auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
      token_uri:                   'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:        `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL || '')}`,
      universe_domain:             'googleapis.com'
    }),
    projectId:     'vortrexyn-online-grocery-store',
    storageBucket: 'vortrexyn-online-grocery-store.firebasestorage.app'
  });
}

module.exports = admin;
