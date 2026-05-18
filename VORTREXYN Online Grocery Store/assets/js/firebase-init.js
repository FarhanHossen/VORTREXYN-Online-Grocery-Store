// ============================================================
// assets/js/firebase-init.js — Firebase client SDK initialisation
//
// This file must be loaded BEFORE auth.js and any other script
// that uses firebase.auth() or firebase.firestore().
//
// How the config reaches the browser:
//   1. server.js injects res.locals.firebaseConfig on every request
//      (populated from FIREBASE_* environment variables).
//   2. The EJS header partial (views/partials/header.ejs) writes:
//        <script>window.__firebaseConfig = <%- JSON.stringify(firebaseConfig) %></script>
//      directly into the HTML <head>, making it available globally.
//   3. This file reads window.__firebaseConfig and initialises the Firebase app.
//
// The guard `!firebase.apps.length` prevents "Firebase App named '[DEFAULT]'
// already exists" errors if this script is ever evaluated more than once
// (e.g., during HMR or if included twice by accident).
//
// NOTE: These are PUBLIC Firebase config values (API key, project ID, etc.).
// They are safe to expose in client-side code — Firebase's security rules
// (Firestore Rules + Firebase Auth) control what authenticated users
// can actually read or write.
// ============================================================

// Read the config injected by the server into the page.
// Falls back to an empty object — Firebase will fail to initialise
// gracefully if the env vars are missing, rather than throwing.
const firebaseConfig = window.__firebaseConfig || {};

// Initialise the Firebase app once.
// firebase.apps is an array of all initialised Firebase app instances;
// checking its length ensures we only call initializeApp() once per page load.
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
