// ── Tutor Profile Page ────────────────────────────────────────────────────

const tutorId = window.location.pathname.split('/').pop();
let selectedSessionType = 'one_on_one';
let currentUser = null;

// Load currentUser first, then the tutor profile
// FIX #3: currentUser must be ready before renderTutor so we can check own profile
fetch('/api/me')
  .then(r => r.json())
  .then(user => {
    currentUser = user;
    document.getElementById('navUserName').textContent = user.full_name;
    if (typeof updateNavPhoto === 'function') updateNavPhoto(user);
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }

    return fetch('/api/tutors/' + tutorId);
  })
  .then(r => {
    // #14 — if the API returns 404, redirect immediately
    if (!r.ok) { window.location.href = '/404'; return null; }
    return r.json();
  })
  .then(tutor => {
    if (!tutor) return; // redirected above
    renderTutor(tutor);
    loadReviews();
    loadTutorResources();  // #10 — load resources once
  })
  .catch(() => {
    // #14 — redirect to dedicated 404 page instead of inline error
    window.location.href = '/404';
  });

// ── Render tutor profile ──────────────────────────────────────────────────

function renderTutor(tutor) {
  const avgRating = parseFloat(tutor.avg_rating || 0);

  // FIX #3: if viewer is the tutor themselves, show Edit button instead of Book
  const isOwnProfile = currentUser && parseInt(currentUser.id) === parseInt(tutor.id);

  const actionButton = isOwnProfile
    ? '<a href="/profile" class="btn-book-session" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">✏️ Edit My Profile</a>'
    : '<button class="btn-book-session" id="openBooking">📅 Book a Session</button>';

  // Avatar: photo if available, else colored initial
  const hasPhoto    = !!tutor.avatar_url;
  const avatarStyle = !hasPhoto && typeof getAvatarStyle === 'function' ? getAvatarStyle(tutor.id) : '';
  const avatarContent = typeof getAvatarHTML === 'function'
    ? getAvatarHTML(tutor)
    : tutor.full_name.charAt(0);

  const ownProfileBanner = isOwnProfile
    ? '<div style="background:linear-gradient(135deg,#fff3eb,#ffe8d6);border-left:4px solid #F76900;border-radius:12px;padding:14px 18px;margin-bottom:16px;font-size:0.9rem;color:#555;">👋 This is how students see your profile. Go to <a href="/profile" style="color:#F76900;font-weight:700;">My Profile</a> to edit your bio, rate, and courses.</div>'
    : '';

  const verifiedHTML = tutor.is_verified
    ? '<span class="verified-badge">✅ Verified Tutor</span>'
    : '';

  const ratingHTML = avgRating > 0
    ? '<span class="rating-badge">⭐ ' + avgRating.toFixed(1) + ' (' + (tutor.review_count || 0) + ' reviews)</span>'
    : '<span style="font-size:0.85rem;color:#aaa;">No reviews yet</span>';

  const bioHTML = tutor.bio
    ? '<div class="tutor-bio-section"><h2>About</h2><p>' + tutor.bio + '</p></div>'
    : '';

  const coursesHTML = (tutor.courses || []).map(function(c) {
    return '<div class="course-card">'
      + '<div class="course-card-code">' + c.course_code + '</div>'
      + '<div class="course-card-name">' + c.course_name + '</div>'
      + (c.professor ? '<div class="course-card-prof">👨‍🏫 ' + c.professor + '</div>' : '')
      + (c.grade ? '<div class="course-card-grade">Grade earned: <strong>' + c.grade + '</strong></div>' : '')
      + '</div>';
  }).join('');

  document.getElementById('tutorContent').innerHTML =
    '<div class="tutor-profile-header">'
    + '<div class="tutor-profile-avatar" style="' + (hasPhoto ? '' : avatarStyle) + '">' + avatarContent + '</div>'
    + '<div class="tutor-profile-info">'
    + '<h1>' + tutor.full_name + '</h1>'
    + '<div class="tutor-profile-meta">' + verifiedHTML + ratingHTML + '</div>'
    + '<div class="tutor-rate-big">$' + parseFloat(tutor.hourly_rate || 0).toFixed(2) + '<span>/hr</span></div>'
    + '</div>'
    + actionButton
    + '</div>'
    + ownProfileBanner
    + bioHTML
    + '<div class="tutor-courses-section">'
    + '<h2>Courses I Tutor</h2>'
    + '<div class="courses-grid">' + coursesHTML + '</div>'
    + '</div>';

  window._tutorCourses = tutor.courses || [];
  window._tutorData    = tutor;

  if (!isOwnProfile) {
    document.getElementById('openBooking').addEventListener('click', openModal);
  }
}

// ── Load tutor resources (public view) ───────────────────────────────────

async function loadTutorResources() {
  try {
    const response = await fetch('/api/tutors/' + tutorId + '/resources');
    if (!response.ok) return;

    const resources = await response.json();
    if (!resources || resources.length === 0) return;

    const typeIcons  = { link: '🔗', note: '📝', file: '📄' };
    const typeLabels = { link: 'Link', note: 'Note', file: 'File' };

    // Build the resources section using string concatenation — no nested template literals
    let itemsHTML = '';
    resources.forEach(function(r) {
      const icon  = typeIcons[r.type]  || '📎';
      const label = typeLabels[r.type] || r.type;
      const titleHTML = r.url
        ? '<a href="' + r.url + '" target="_blank" rel="noopener noreferrer">' + r.title + '</a>'
        : r.title;
      const descHTML = r.description
        ? '<div class="resource-public-desc">' + r.description + '</div>'
        : '';

      itemsHTML +=
        '<div class="resource-public-item">'
        + '<span class="resource-public-icon">' + icon + '</span>'
        + '<div class="resource-public-info">'
        + '<div class="resource-public-title">'
        + titleHTML
        + '<span class="resource-type-tag">' + label + '</span>'
        + '</div>'
        + descHTML
        + '</div>'
        + '</div>';
    });

    const section = document.createElement('div');
    section.className = 'tutor-bio-section';
    section.innerHTML =
      '<h2>📎 Resources &amp; Materials</h2>'
      + '<div class="resources-public-list">' + itemsHTML + '</div>';

    // Insert before the courses section
    const coursesSection = document.querySelector('.tutor-courses-section');
    if (coursesSection) {
      coursesSection.parentNode.insertBefore(section, coursesSection);
    }
  } catch (err) {
    console.error('Error loading tutor resources:', err);
  }
}

// ── Load reviews ──────────────────────────────────────────────────────────

function loadReviews() {
  fetch('/api/tutors/' + tutorId + '/reviews')
    .then(r => r.json())
    .then(function(data) {
      const section = document.getElementById('reviewsSection');
      section.classList.remove('hidden');

      const avgEl  = document.getElementById('reviewsAvg');
      const listEl = document.getElementById('reviewsList');

      if (data.total > 0) {
        const fullStars = Math.round(parseFloat(data.avg_rating));
        const starsHtml = '⭐'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        avgEl.innerHTML =
          '<div class="reviews-avg">'
          + '<div class="big-rating">' + data.avg_rating + '</div>'
          + '<div>'
          + '<div class="stars">' + starsHtml + '</div>'
          + '<div class="total">' + data.total + ' review' + (data.total !== 1 ? 's' : '') + '</div>'
          + '</div>'
          + '</div>';

        listEl.innerHTML = data.reviews.map(function(r) {
          const stars = '⭐'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          const date  = new Date(r.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          });
          return '<div class="review-card">'
            + '<div class="review-card-header">'
            + '<span class="review-student">🎓 ' + r.student_name + '</span>'
            + '<span class="review-stars">' + stars + '</span>'
            + '</div>'
            + (r.comment ? '<div class="review-comment">"' + r.comment + '"</div>' : '')
            + '<div class="review-date">' + date + '</div>'
            + '</div>';
        }).join('');
      } else {
        avgEl.innerHTML  = '';
        listEl.innerHTML = '<div class="no-reviews">No reviews yet. Be the first to review this tutor!</div>';
      }
    });
}

// ── Booking Modal ─────────────────────────────────────────────────────────

// #8 — Check for existing active bookings before opening modal
async function openModal() {
  const tutor = window._tutorData;

  const modalAvatarEl = document.getElementById('modalAvatar');
  if (tutor.avatar_url) {
    modalAvatarEl.innerHTML = '<img src="' + tutor.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
    modalAvatarEl.style.background = 'transparent';
    modalAvatarEl.style.padding    = '0';
  } else {
    modalAvatarEl.textContent = tutor.full_name.charAt(0);
    if (typeof getAvatarStyle === 'function') {
      modalAvatarEl.style.cssText += ';' + getAvatarStyle(tutor.id);
    }
  }
  document.getElementById('modalTutorName').textContent = tutor.full_name;
  document.getElementById('modalTutorRate').textContent = '$' + parseFloat(tutor.hourly_rate).toFixed(2) + '/hr';

  const courseSelect = document.getElementById('modalCourse');
  courseSelect.innerHTML = (window._tutorCourses || []).map(function(c) {
    return '<option value="' + c.course_code + '">' + c.course_code + ' — ' + c.course_name + '</option>';
  }).join('');

  document.getElementById('bookingModal').classList.remove('hidden');

  // #8 — Check if student already has an active booking with this tutor
  try {
    const res  = await fetch('/api/bookings');
    if (res.ok) {
      const bookings = await res.json();
      const active   = bookings.filter(function(b) {
        return parseInt(b.tutor_id) === parseInt(tutor.id)
          && (b.status === 'pending' || b.status === 'confirmed');
      });

      if (active.length > 0) {
        const existing = active[0];
        const statusLabel = existing.status === 'pending' ? '⏳ Pending' : '✅ Confirmed';
        showExistingBookingWarning(existing.course_code, statusLabel);
      } else {
        // Clear any previous warning
        clearExistingBookingWarning();
      }
    }
  } catch (err) {
    // Silently fail — don't block the modal from opening
    console.error('Could not check existing bookings:', err);
  }
}

function showExistingBookingWarning(courseCode, statusLabel) {
  // Remove existing warning if any
  clearExistingBookingWarning();

  const warning = document.createElement('div');
  warning.id    = 'existingBookingWarning';
  warning.style.cssText = [
    'background:linear-gradient(135deg,#fff8e1,#fff3cd)',
    'border-left:4px solid #f39c12',
    'border-radius:10px',
    'padding:12px 14px',
    'font-size:0.88rem',
    'color:#856404',
    'margin-bottom:4px',
    'display:flex',
    'align-items:flex-start',
    'gap:10px'
  ].join(';');

  warning.innerHTML =
    '<span style="font-size:1.1rem;flex-shrink:0;">⚠️</span>'
    + '<div>'
    + '<strong>You already have an active booking with this tutor.</strong>'
    + '<div style="margin-top:3px;font-size:0.82rem;opacity:0.85;">'
    + 'Course: ' + courseCode + ' &nbsp;·&nbsp; Status: ' + statusLabel
    + '</div>'
    + '<div style="margin-top:3px;font-size:0.82rem;opacity:0.85;">'
    + 'You can still book a different course or session type.'
    + '</div>'
    + '</div>';

  // Insert at the top of modal-body, before everything else
  const modalBody = document.querySelector('.modal-body');
  if (modalBody) modalBody.insertBefore(warning, modalBody.firstChild);
}

function clearExistingBookingWarning() {
  const existing = document.getElementById('existingBookingWarning');
  if (existing) existing.remove();
}

document.getElementById('closeModal').addEventListener('click',  function() { document.getElementById('bookingModal').classList.add('hidden'); });
document.getElementById('cancelModal').addEventListener('click', function() { document.getElementById('bookingModal').classList.add('hidden'); });

// Session type buttons
document.querySelectorAll('.session-type-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.session-type-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    selectedSessionType = btn.dataset.type;

    const isResources = selectedSessionType === 'resources';
    document.getElementById('resourcesNote').classList.toggle('hidden', !isResources);
    document.getElementById('dateGroup').classList.toggle('hidden', isResources);
  });
});

// Confirm booking
document.getElementById('confirmBooking').addEventListener('click', async function() {
  const course  = document.getElementById('modalCourse').value;
  const date    = document.getElementById('modalDate').value;
  const message = document.getElementById('modalMessage').value;

  if (!course) { showFeedback('Please select a course.', 'error'); return; }
  if (selectedSessionType !== 'resources' && !date) { showFeedback('Please pick a date and time.', 'error'); return; }

  const btn = document.getElementById('confirmBooking');
  btn.textContent = 'Booking...';
  btn.disabled    = true;

  try {
    const res = await fetch('/api/bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor_id:     tutorId,
        course_code:  course,
        scheduled_at: selectedSessionType === 'resources' ? new Date().toISOString() : date,
        message:      message,
        session_type: selectedSessionType
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showFeedback(data.error || 'Could not book session.', 'error');
    } else {
      showFeedback('✅ Booking request sent! Redirecting...', 'success');
      setTimeout(function() { window.location.href = '/bookings'; }, 1500);
    }
  } catch {
    showFeedback('Network error. Please try again.', 'error');
  }

  btn.textContent = 'Confirm Booking';
  btn.disabled    = false;
});

function showFeedback(msg, type) {
  const el            = document.getElementById('bookingFeedback');
  el.textContent      = msg;
  el.style.display    = 'block';
  el.style.background = type === 'error' ? '#fdecea' : '#eafaf1';
  el.style.color      = type === 'error' ? '#e74c3c' : '#27ae60';
  el.style.borderLeft = '3px solid ' + (type === 'error' ? '#e74c3c' : '#27ae60');
}