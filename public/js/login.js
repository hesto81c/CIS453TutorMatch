// ── Login form — calls the real backend API ──────────────────────────

const form     = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
const roleBtns = document.querySelectorAll('.role-btn');

let selectedRole = 'student';

roleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    roleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.classList.add('hidden');

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email.endsWith('.edu')) {
    errorMsg.textContent = '⚠️ Only university (.edu) emails are accepted.';
    errorMsg.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      errorMsg.textContent = '⚠️ ' + data.error;
      errorMsg.classList.remove('hidden');
      return;
    }

    // Redirect to dashboard on success
    window.location.href = '/dashboard';

  } catch (err) {
    errorMsg.textContent = '⚠️ Connection error. Please try again.';
    errorMsg.classList.remove('hidden');
  }
});