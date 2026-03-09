// ── Register form logic ──────────────────────────────────────────────

const form       = document.getElementById('registerForm');
const errorMsg   = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');
const roleBtns   = document.querySelectorAll('.role-btn');
const roleInput  = document.getElementById('roleInput');

// Role selector
roleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    roleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    roleInput.value = btn.dataset.role;
  });
});

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorMsg.classList.add('hidden');
  successMsg.classList.add('hidden');

  const full_name        = document.getElementById('full_name').value.trim();
  const email            = document.getElementById('email').value.trim();
  const password         = document.getElementById('password').value;
  const confirm_password = document.getElementById('confirm_password').value;
  const role             = roleInput.value;

  // Client-side validation
  if (!full_name) {
    return showError('Please enter your full name.');
  }
  if (!email.endsWith('.edu')) {
    return showError('Only university (.edu) emails are accepted.');
  }
  if (password.length < 6) {
    return showError('Password must be at least 6 characters.');
  }
  if (password !== confirm_password) {
    return showError('Passwords do not match.');
  }

  // Send to server
  try {
    const response = await fetch('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name, email, password, role })
    });

    const data = await response.json();

    if (!response.ok) {
      return showError(data.error);
    }

    // Success — redirect to dashboard
    successMsg.textContent = '✅ Account created! Redirecting...';
    successMsg.classList.remove('hidden');
    setTimeout(() => window.location.href = '/dashboard', 1200);

  } catch (err) {
    showError('Connection error. Please try again.');
  }
});

// Also update login.js to use the API instead of direct redirect
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}