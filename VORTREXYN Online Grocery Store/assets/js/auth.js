const auth = firebase.auth();
const db   = firebase.firestore();

// ── Helpers ──────────────────────────────────────────────────────────────
function togglePw(id, btn) {
  const input = document.getElementById(id);
  const icon  = btn.querySelector('i');
  input.type  = input.type === 'password' ? 'text' : 'password';
  icon.className = input.type === 'text' ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function setLoading(form, loading) {
  form.querySelector('.btn-text').style.display    = loading ? 'none' : '';
  form.querySelector('.btn-loading').style.display = loading ? '' : 'none';
  form.querySelector('.auth-submit').disabled      = loading;
}

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

// ── Firestore: save or update user profile ────────────────────────────────
async function saveUserProfile(user, isNewUser) {
  const ref = db.collection('users').doc(user.uid);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  if (isNewUser) {
    // Create full profile on first sign-up
    await ref.set({
      uid:               user.uid,
      email:             user.email,
      displayName:       user.displayName || user.email.split('@')[0],
      photoURL:          user.photoURL || null,
      provider:          user.providerData[0]?.providerId || 'password',
      rewardPoints:      0,
      totalOrders:       0,
      totalPointsEarned: 0,
      tier:              1,
      createdAt:         now,
      lastLogin:         now,
    });
  } else {
    // Upsert: update lastLogin; create profile if somehow missing
    await ref.set({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL:    user.photoURL || null,
      lastLogin:   now,
    }, { merge: true });
  }

  // Return the latest profile data to pass to server session
  const snap = await ref.get();
  return snap.data();
}

// ── Create server-side session ────────────────────────────────────────────
async function createSession(user, isNewUser = false) {
  // Save to Firestore and fetch full profile (points, address, etc.)
  let profile = {};
  try {
    profile = await saveUserProfile(user, isNewUser);
  } catch (err) {
    console.warn('Firestore save skipped:', err.message);
  }

  const token = await user.getIdToken();
  const resp  = await fetch('/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken:      token,
      uid:          user.uid,
      email:        user.email,
      displayName:  user.displayName || user.email.split('@')[0],
      photoURL:     user.photoURL    || null,
      rewardPoints:      profile.rewardPoints      || 0,
      totalOrders:       profile.totalOrders       || 0,
      savedAddress:      profile.savedAddress      || null,
      totalPointsEarned: profile.totalPointsEarned || 0,
      tier:              profile.tier              || 1,
    })
  });
  if (!resp.ok) throw new Error('Session error');
  window.location.href = '/';
}

// ── Login ─────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(loginForm, true);
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    try {
      const persistence = remember
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);
      const cred = await auth.signInWithEmailAndPassword(email, password);
      await createSession(cred.user, false);
    } catch (err) {
      setLoading(loginForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Signup ────────────────────────────────────────────────────────────────
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('signupName').value.trim();
    const email   = document.getElementById('signupEmail').value;
    const pass    = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    if (pass !== confirm) { showError('Passwords do not match.'); return; }
    setLoading(signupForm, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await cred.user.updateProfile({ displayName: name });
      // Reload so displayName is available on the user object
      await cred.user.reload();
      const freshUser = auth.currentUser;
      await createSession(freshUser, true);
    } catch (err) {
      setLoading(signupForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Forgot Password ───────────────────────────────────────────────────────
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

// ── Google Sign In ────────────────────────────────────────────────────────
const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result  = await auth.signInWithPopup(provider);
      const isNew   = result.additionalUserInfo?.isNewUser ?? false;
      await createSession(result.user, isNew);
    } catch (err) {
      showError(friendlyError(err.code));
    }
  });
}

// ── Error messages ────────────────────────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/invalid-email':        'Invalid email address.',
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/invalid-credential':   'Email or password is incorrect.',
    'auth/email-already-in-use': 'Email already registered. Try logging in.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
