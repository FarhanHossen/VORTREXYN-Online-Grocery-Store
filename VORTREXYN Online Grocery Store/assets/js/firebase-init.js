// Firebase config is injected by the server via window.__firebaseConfig
// Fallback values are empty strings — auth won't work without real config
const firebaseConfig = window.__firebaseConfig || {};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
