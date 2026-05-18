// ============================================================
// assets/js/auth.js — Client-side Firebase authentication
//
// This script runs in the browser on the login, signup, and
// forgot-password pages. It talks directly to Firebase Authentication
// (via the Firebase JS SDK loaded in the <head>) and then calls the
// server's /auth/session endpoint to create a server-side session cookie.
//
// Files that must be loaded before this one:
//   1. Firebase App SDK     (firebase-app.js  — compat version)
//   2. Firebase Auth SDK    (firebase-auth.js — compat version)
//   3. Firebase Firestore   (firebase-firestore.js — compat version)
//   4. assets/js/firebase-init.js  (initialises the Firebase app)
//
// Flow summary:
//   User submits form → Firebase Auth API call → on success:
//     saveUserProfile() → createSession() → POST /auth/session → redirect to /
//
// Firestore user document shape:
//   {
//     uid, email, displayName, photoURL, provider,
//     rewardPoints, totalOrders, totalPointsEarned,
//     tier (1–7), createdAt, lastLogin, savedAddress?
//   }
// ============================================================

const auth = firebase.auth();       // Firebase Auth instance
const db   = firebase.firestore();  // Firestore instance (note: 'db' here is Firestore, not PostgreSQL)

// ── UI Helpers ────────────────────────────────────────────────────────────────

/**
 * togglePw(id, btn) — toggle a password input between 'password' and 'text'.
 * Updates the eye icon class to match the current state.
 * Called from onclick attributes in the EJS templates.
 * @param {string} id  - The <input> element ID
 * @param {Element} btn - The toggle button element (contains an <i> icon)
 */
function togglePw(id, btn) {
  const input    = document.getElementById(id);
  const icon     = btn.querySelector('i');
  input.type     = input.type === 'password' ? 'text' : 'password';
  icon.className = input.type === 'text' ? 'fas fa-eye-slash' : 'fas fa-eye';
}

/**
 * setFieldError(id, msg) — mark a form field as invalid and show an error message.
 * Adds the 'input-invalid' CSS class to the input and inserts a
 * .field-error <span> below the input wrap (created if it doesn't exist yet).
 * @param {string} id  - The <input> element ID
 * @param {string} msg - The error message to display
 */
function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('input-invalid');
  let err = el.closest('.form-group').querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    el.closest('.input-wrap').insertAdjacentElement('afterend', err);
  }
  err.textContent = msg;
  err.style.display = 'block';
}

/**
 * clearFieldError(id) — remove the invalid state and hide the error message.
 * Called on input events once the user starts correcting a field.
 * @param {string} id - The <input> element ID
 */
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('input-invalid');
  const err = el.closest('.form-group')?.querySelector('.field-error');
  if (err) err.style.display = 'none';
}

// ── Validation functions ──────────────────────────────────────────────────────
// Each returns an error message string, or '' (empty) if valid.
// Used for both real-time (blur/input) and submit-time validation.

/** Validate full name: required, >3 chars, no digits, letters/spaces/hyphens only */
function validateName(val) {
  if (!val)                          return 'Name is required.';
  if (val.length <= 3)               return 'Name must be more than 3 characters.';
  if (/\d/.test(val))                return 'Name cannot contain numbers.';
  if (!/^[a-zA-Z\s'-]+$/.test(val)) return 'Name can only contain letters.';
  return '';
}

/** Validate email: required, basic format check (user@domain.tld) */
function validateEmail(val) {
  if (!val)                                      return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))  return 'Enter a valid email address.';
  return '';
}

/** Validate password: required, at least 6 characters (Firebase minimum) */
function validatePassword(val) {
  if (!val)            return 'Password is required.';
  if (val.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

/** Validate confirm password: required, must match the password field */
function validateConfirm(val, pass) {
  if (!val)         return 'Please confirm your password.';
  if (val !== pass) return 'Passwords do not match.';
  return '';
}

/**
 * setLoading(form, loading) — toggle the submit button between normal and loading state.
 * Shows a spinner and disables the button while the async Firebase call is in flight.
 * @param {Element} form    - The form element
 * @param {boolean} loading - true = show spinner, false = show normal text
 */
function setLoading(form, loading) {
  form.querySelector('.btn-text').style.display    = loading ? 'none' : '';
  form.querySelector('.btn-loading').style.display = loading ? '' : 'none';
  form.querySelector('.auth-submit').disabled      = loading;
}

/**
 * showError(msg) — display a top-level error banner above the auth form.
 * Reuses an existing .auth-alert.error element if one exists, or creates one.
 * Scrolls the banner into view smoothly.
 * @param {string} msg - The error message to display
 */
function showError(msg) {
  let el = document.querySelector('.auth-alert.error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'auth-alert error';
    const form = document.querySelector('.auth-form') || document.querySelector('.auth-card');
    form.insertAdjacentElement('beforebegin', el);
  }
  el.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + msg;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Firestore profile management ──────────────────────────────────────────────

/**
 * saveUserProfile(user, isNewUser) — create or update the Firestore user document.
 *
 * For new users (isNewUser = true):
 *   Creates a full profile document with all default values.
 *   rewardPoints, totalOrders, totalPointsEarned all start at 0.
 *   tier starts at 1 (Iron).
 *
 * For returning users (isNewUser = false):
 *   Uses merge: true to only update lastLogin, email, displayName, photoURL.
 *   Preserves all other fields (points, tier, address, etc.) unchanged.
 *   Also creates the document if it somehow doesn't exist yet (safety net).
 *
 * Always fetches the latest snapshot and returns it so createSession()
 * can pass the up-to-date profile to the server session.
 *
 * @param {firebase.User} user       - Firebase Auth user object
 * @param {boolean}       isNewUser  - true if this is the first sign-up
 * @returns {Promise<Object>}        - The Firestore user document data
 */
async function saveUserProfile(user, isNewUser) {
  const ref = db.collection('users').doc(user.uid);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  if (isNewUser) {
    // New sign-up → create full profile with all default fields
    await ref.set({
      uid:               user.uid,
      email:             user.email,
      displayName:       user.displayName || user.email.split('@')[0],
      photoURL:          user.photoURL    || null,
      provider:          user.providerData[0]?.providerId || 'password', // 'password' or 'google.com'
      rewardPoints:      0,
      totalOrders:       0,
      totalPointsEarned: 0,
      tier:              1,  // Start at Tier 1 (Iron)
      createdAt:         now,
      lastLogin:         now,
    });
  } else {
    // Returning user → update only login metadata; preserve everything else
    await ref.set({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL:    user.photoURL    || null,
      lastLogin:   now,
    }, { merge: true }); // merge: true = only update specified fields
  }

  // Fetch and return the latest snapshot (contains points, tier, address, etc.)
  const snap = await ref.get();
  return snap.data();
}

/**
 * createSession(user, isNewUser) — create the server-side session after Firebase auth.
 *
 * Steps:
 *   1. Save/update the Firestore profile and get the latest data.
 *   2. Get a fresh Firebase ID token from the user object.
 *   3. POST the token + full profile to /auth/session (the server verifies
 *      the token and stores the data in an Express session cookie).
 *   4. Redirect to the home page on success.
 *
 * If Firestore fails (network issue), we still proceed with an empty profile
 * (points/tier/address will default to 0/1/null on the server).
 *
 * @param {firebase.User} user      - Firebase Auth user object
 * @param {boolean}       isNewUser - Passed through to saveUserProfile
 */
async function createSession(user, isNewUser = false) {
  let profile = {};
  try {
    profile = await saveUserProfile(user, isNewUser);
  } catch (err) {
    // Don't block login if Firestore is temporarily unavailable
    console.warn('Firestore save skipped:', err.message);
  }

  // Get a short-lived ID token (expires in 1 hour) to prove identity to the server
  const token = await user.getIdToken();

  const resp = await fetch('/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      idToken:           token,
      uid:               user.uid,
      email:             user.email,
      displayName:       user.displayName || user.email.split('@')[0],
      photoURL:          user.photoURL    || null,
      // Firestore profile fields forwarded to the server session
      rewardPoints:      profile.rewardPoints      || 0,
      totalOrders:       profile.totalOrders       || 0,
      savedAddress:      profile.savedAddress      || null,
      totalPointsEarned: profile.totalPointsEarned || 0,
      tier:              profile.tier              || 1,
    })
  });

  if (!resp.ok) throw new Error('Session error');
  window.location.href = '/'; // Full page redirect to home after session is set
}

// ── Login form ────────────────────────────────────────────────────────────────
// Handles the email+password login on views/auth/login.ejs.
// Firebase Auth is used directly — the server never sees the plain password.
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(loginForm, true);

    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;

    try {
      // Set persistence based on "Remember me" checkbox:
      //   LOCAL   → survives browser close (stored in IndexedDB)
      //   SESSION → clears when browser tab is closed
      const persistence = remember
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);

      const cred = await auth.signInWithEmailAndPassword(email, password);
      await createSession(cred.user, false); // false = returning user
    } catch (err) {
      setLoading(loginForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Signup form ───────────────────────────────────────────────────────────────
// Handles the registration form on views/auth/signup.ejs.
// Real-time validation fires on blur (when field loses focus) and on input
// (while the user is actively correcting an error).
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  const nameEl    = document.getElementById('signupName');
  const emailEl   = document.getElementById('signupEmail');
  const passEl    = document.getElementById('signupPassword');
  const confirmEl = document.getElementById('signupConfirm');

  // ── Real-time validation: Name ──
  // Validate on blur (when user leaves the field)
  nameEl.addEventListener('blur', () => {
    const e = validateName(nameEl.value.trim());
    e ? setFieldError('signupName', e) : clearFieldError('signupName');
  });
  // Re-validate on every keystroke if the field is already marked invalid
  nameEl.addEventListener('input', () => {
    if (nameEl.classList.contains('input-invalid')) {
      const e = validateName(nameEl.value.trim());
      e ? setFieldError('signupName', e) : clearFieldError('signupName');
    }
  });

  // ── Real-time validation: Email ──
  emailEl.addEventListener('blur', () => {
    const e = validateEmail(emailEl.value.trim());
    e ? setFieldError('signupEmail', e) : clearFieldError('signupEmail');
  });
  emailEl.addEventListener('input', () => {
    if (emailEl.classList.contains('input-invalid')) {
      const e = validateEmail(emailEl.value.trim());
      e ? setFieldError('signupEmail', e) : clearFieldError('signupEmail');
    }
  });

  // ── Real-time validation: Password ──
  // Also re-validates the confirm field when password changes
  passEl.addEventListener('blur', () => {
    const e = validatePassword(passEl.value);
    e ? setFieldError('signupPassword', e) : clearFieldError('signupPassword');
    // If confirm already has a value, check it matches the new password
    if (confirmEl.value) {
      const ce = validateConfirm(confirmEl.value, passEl.value);
      ce ? setFieldError('signupConfirm', ce) : clearFieldError('signupConfirm');
    }
  });
  passEl.addEventListener('input', () => {
    if (passEl.classList.contains('input-invalid')) {
      const e = validatePassword(passEl.value);
      e ? setFieldError('signupPassword', e) : clearFieldError('signupPassword');
    }
  });

  // ── Real-time validation: Confirm Password ──
  confirmEl.addEventListener('blur', () => {
    const e = validateConfirm(confirmEl.value, passEl.value);
    e ? setFieldError('signupConfirm', e) : clearFieldError('signupConfirm');
  });
  // Live check on every keystroke (helpful for confirm fields)
  confirmEl.addEventListener('input', () => {
    const e = validateConfirm(confirmEl.value, passEl.value);
    e ? setFieldError('signupConfirm', e) : clearFieldError('signupConfirm');
  });

  // ── Submit: full validation + Firebase account creation ──
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = nameEl.value.trim();
    const email   = emailEl.value.trim();
    const pass    = passEl.value;
    const confirm = confirmEl.value;

    // Validate all fields and show any errors before submitting
    const ne = validateName(name);
    const ee = validateEmail(email);
    const pe = validatePassword(pass);
    const ce = validateConfirm(confirm, pass);

    ne ? setFieldError('signupName',     ne) : clearFieldError('signupName');
    ee ? setFieldError('signupEmail',    ee) : clearFieldError('signupEmail');
    pe ? setFieldError('signupPassword', pe) : clearFieldError('signupPassword');
    ce ? setFieldError('signupConfirm',  ce) : clearFieldError('signupConfirm');

    if (ne || ee || pe || ce) return; // Stop if any field is invalid

    setLoading(signupForm, true);
    try {
      // Create the Firebase Auth account
      const cred = await auth.createUserWithEmailAndPassword(email, pass);

      // Set the display name on the Firebase user profile
      await cred.user.updateProfile({ displayName: name });

      // reload() refreshes the user object so displayName is available
      await cred.user.reload();
      const freshUser = auth.currentUser;

      // Create Firestore profile + server session
      await createSession(freshUser, true); // true = new user
    } catch (err) {
      setLoading(signupForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Forgot Password form ──────────────────────────────────────────────────────
// Handles the password reset request on views/auth/forgot-password.ejs.
// Firebase sends a reset email directly to the user from Firebase's servers.
// On success: redirects to /auth/forgot-password?sent=1 which shows
// a "Check your inbox" confirmation banner.
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(forgotForm, true);
    const email = document.getElementById('forgotEmail').value;
    try {
      await auth.sendPasswordResetEmail(email);
      window.location.href = '/auth/forgot-password?sent=1';
    } catch (err) {
      setLoading(forgotForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Google Sign-In button ─────────────────────────────────────────────────────
// Uses Firebase's OAuth popup flow. If it's the user's first time signing
// in with Google, result.additionalUserInfo.isNewUser will be true,
// triggering a full Firestore profile creation.
const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await auth.signInWithPopup(provider);
      const isNew  = result.additionalUserInfo?.isNewUser ?? false;
      await createSession(result.user, isNew);
    } catch (err) {
      showError(friendlyError(err.code));
    }
  });
}

// ── Firebase error code → user-friendly message ───────────────────────────────
// Maps Firebase Auth error codes to plain-English messages.
// Firebase error codes are like 'auth/wrong-password' — not suitable to
// show directly to users. Add new entries here as needed.
// Falls back to a generic message for any unmapped code.
function friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Invalid email address.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Email or password is incorrect.',
    'auth/email-already-in-use':   'Email already registered. Try logging in.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user':   'Sign-in cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
