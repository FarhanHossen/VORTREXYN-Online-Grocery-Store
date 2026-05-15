const auth = firebase.auth();

function togglePw(id, btn) {
  const input = document.getElementById(id);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function setLoading(form, loading) {
  const btnText = form.querySelector('.btn-text');
  const btnLoad = form.querySelector('.btn-loading');
  const btn = form.querySelector('.auth-submit');
  if (loading) { btnText.style.display='none'; btnLoad.style.display=''; btn.disabled=true; }
  else { btnText.style.display=''; btnLoad.style.display='none'; btn.disabled=false; }
}

function showError(msg) {
  let el = document.querySelector('.auth-alert.error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'auth-alert error';
    document.querySelector('.auth-form').insertAdjacentElement('beforebegin', el);
  }
  el.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + msg;
  el.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function createSession(user) {
  const token = await user.getIdToken();
  const resp = await fetch('/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token, uid: user.uid, email: user.email, displayName: user.displayName || user.email.split('@')[0] })
  });
  if (!resp.ok) throw new Error('Session error');
  window.location.href = '/';
}

// ── Login ──
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(loginForm, true);
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    try {
      const persistence = remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);
      const cred = await auth.signInWithEmailAndPassword(email, password);
      await createSession(cred.user);
    } catch (err) {
      setLoading(loginForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Signup ──
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    if (pass !== confirm) { showError('Passwords do not match.'); return; }
    setLoading(signupForm, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await cred.user.updateProfile({ displayName: name });
      await createSession(cred.user);
    } catch (err) {
      setLoading(signupForm, false);
      showError(friendlyError(err.code));
    }
  });
}

// ── Forgot Password ──
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

// ── Google Sign In ──
const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await auth.signInWithPopup(provider);
      await createSession(result.user);
    } catch (err) {
      showError(friendlyError(err.code));
    }
  });
}

function friendlyError(code) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'Email already registered. Try logging in.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
