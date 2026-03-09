// ── Tutor Profile Page ───────────────────────────────────────────────

const tutorId = window.location.pathname.split('/').pop();
let selectedSessionType = 'one_on_one';
let currentUser = null;

// Load current user
fetch('/api/me')
  .then(r => r.json())
  .then(user => {
    currentUser = user;
    document.getElementById('navUserName').textContent = user.full_name;
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }
  })
  .catch(() => window.location.href = '/');

// Load tutor profile
fetch(`/api/tutors/${tutorId}`)
  .then(r => r.json())
  .then(tutor => {
    renderTutor(tutor);
    loadReviews();
  })
  .catch(() => {
    document.getElementById('tutorContent').innerHTML =
      '<p style="text-align:center;padding:40px;color:#e74c3c;">Tutor not found.</p>';
  });

// ── Render tutor profile ─────────────────────────────────────────────
function renderTutor(tutor) {
  const avgRating = parseFloat(tutor.avg_rating || 0);
  const stars     = avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : '';

  document.getElementById('tutorContent').innerHTML = `
    <div class="tutor-profile-header">
      <div class="tutor-profile-avatar">${tutor.full_name.charAt(0)}</div>
      <div class="tutor-profile-info">
        <h1>${tutor.full_name}</h1>
        <div class="tutor-profile-meta">
          ${tutor.is_verified ? '<span class="verified-badge">✅ Verified Tutor</span>' : ''}
          ${avgRating > 0
            ? `<span class="rating-badge">⭐ ${avgRating.toFixed(1)} (${tutor.review_count || 0} reviews)</span>`
            : '<span style="font-size:0.85rem;color:#aaa;">No reviews yet</span>'}
        </div>
        <div class="tutor-rate-big">$${parseFloat(tutor.hourly_rate || 0).toFixed(2)}<span>/hr</span></div>
      </div>
      <button class="btn-book-session" id="openBooking">📅 Book a Session</button>
    </div>

    ${tutor.bio ? `
      <div class="tutor-bio-section">
        <h2>About</h2>
        <p>${tutor.bio}</p>
      </div>
    ` : ''}

    <div class="tutor-courses-section">
      <h2>Courses I Tutor</h2>
      <div class="courses-grid">
        ${(tutor.courses || []).map(c => `
          <div class="course-card">
            <div class="course-card-code">${c.course_code}</div>
            <div class="course-card-name">${c.course_name}</div>
            ${c.professor ? `<div class="course-card-prof">👨‍🏫 ${c.professor}</div>` : ''}
            ${c.grade ? `<div class="course-card-grade">Grade earned: <strong>${c.grade}</strong></div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Store courses for modal
  window._tutorCourses = tutor.courses || [];
  window._tutorData    = tutor;

  // Book button
  document.getElementById('openBooking').addEventListener('click', openModal);
}

// ── Load reviews ─────────────────────────────────────────────────────
function loadReviews() {
  fetch(`/api/tutors/${tutorId}/reviews`)
    .then(r => r.json())
    .then(data => {
      const section = document.getElementById('reviewsSection');
      section.classList.remove('hidden');

      const avgEl  = document.getElementById('reviewsAvg');
      const listEl = document.getElementById('reviewsList');

      if (data.total > 0) {
        const fullStars  = Math.round(parseFloat(data.avg_rating));
        const starsHtml  = '⭐'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        avgEl.innerHTML  = `
          <div class="reviews-avg">
            <div class="big-rating">${data.avg_rating}</div>
            <div>
              <div class="stars">${starsHtml}</div>
              <div class="total">${data.total} review${data.total !== 1 ? 's' : ''}</div>
            </div>
          </div>
        `;

        listEl.innerHTML = data.reviews.map(r => {
          const stars   = '⭐'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          const date    = new Date(r.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          });
          return `
            <div class="review-card">
              <div class="review-card-header">
                <span class="review-student">🎓 ${r.student_name}</span>
                <span class="review-stars">${stars}</span>
              </div>
              ${r.comment ? `<div class="review-comment">"${r.comment}"</div>` : ''}
              <div class="review-date">${date}</div>
            </div>
          `;
        }).join('');
      } else {
        avgEl.innerHTML  = '';
        listEl.innerHTML = '<div class="no-reviews">No reviews yet. Be the first to review this tutor!</div>';
      }
    });
}

// ── Booking Modal ─────────────────────────────────────────────────────
function openModal() {
  const tutor = window._tutorData;

  document.getElementById('modalAvatar').textContent    = tutor.full_name.charAt(0);
  document.getElementById('modalTutorName').textContent = tutor.full_name;
  document.getElementById('modalTutorRate').textContent = `$${parseFloat(tutor.hourly_rate).toFixed(2)}/hr`;

  const courseSelect = document.getElementById('modalCourse');
  courseSelect.innerHTML = (window._tutorCourses || []).map(c =>
    `<option value="${c.course_code}">${c.course_code} — ${c.course_name}</option>`
  ).join('');

  document.getElementById('bookingModal').classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click',  () => document.getElementById('bookingModal').classList.add('hidden'));
document.getElementById('cancelModal').addEventListener('click', () => document.getElementById('bookingModal').classList.add('hidden'));

// Session type buttons
document.querySelectorAll('.session-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSessionType = btn.dataset.type;

    const isResources = selectedSessionType === 'resources';
    document.getElementById('resourcesNote').classList.toggle('hidden', !isResources);
    document.getElementById('dateGroup').classList.toggle('hidden', isResources);
  });
});

// Confirm booking
document.getElementById('confirmBooking').addEventListener('click', async () => {
  const course  = document.getElementById('modalCourse').value;
  const date    = document.getElementById('modalDate').value;
  const message = document.getElementById('modalMessage').value;
  const feedback = document.getElementById('bookingFeedback');

  if (!course) {
    showFeedback('Please select a course.', 'error');
    return;
  }
  if (selectedSessionType !== 'resources' && !date) {
    showFeedback('Please pick a date and time.', 'error');
    return;
  }

  const btn = document.getElementById('confirmBooking');
  btn.textContent = 'Booking...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor_id:     tutorId,
        course_code:  course,
        scheduled_at: selectedSessionType === 'resources' ? new Date().toISOString() : date,
        message,
        session_type: selectedSessionType
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showFeedback(data.error || 'Could not book session.', 'error');
    } else {
      showFeedback('✅ Booking confirmed! Redirecting...', 'success');
      setTimeout(() => window.location.href = '/bookings', 1500);
    }
  } catch {
    showFeedback('Network error. Please try again.', 'error');
  }

  btn.textContent = 'Confirm Booking';
  btn.disabled = false;
});

function showFeedback(msg, type) {
  const el = document.getElementById('bookingFeedback');
  el.textContent   = msg;
  el.style.display = 'block';
  el.style.background = type === 'error' ? '#fdecea' : '#eafaf1';
  el.style.color      = type === 'error' ? '#e74c3c' : '#27ae60';
  el.style.borderLeft = `3px solid ${type === 'error' ? '#e74c3c' : '#27ae60'}`;
}