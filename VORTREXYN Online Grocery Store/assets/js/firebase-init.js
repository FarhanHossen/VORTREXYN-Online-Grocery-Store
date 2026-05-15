// Firebase configuration — replace with your project values
// Get these from: Firebase Console → Project Settings → Your Apps → SDK setup
const firebaseConfig = {
  apiKey:            window.__FIREBASE_API_KEY__            || "YOUR_API_KEY",
  authDomain:        window.__FIREBASE_AUTH_DOMAIN__        || "YOUR_AUTH_DOMAIN",
  projectId:         window.__FIREBASE_PROJECT_ID__         || "YOUR_PROJECT_ID",
  storageBucket:     window.__FIREBASE_STORAGE_BUCKET__     || "YOUR_STORAGE_BUCKET",
  messagingSenderId: window.__FIREBASE_MESSAGING_SENDER_ID__|| "YOUR_MESSAGING_SENDER_ID",
  appId:             window.__FIREBASE_APP_ID__             || "YOUR_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
