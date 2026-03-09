// ── My Bookings page ─────────────────────────────────────────────────

const sessionTypeLabels = {
  one_on_one: '👤 1-on-1',
  group:      '👥 Group',
  resources:  '📚 Resources'
};

fetch('/api/me')
  .then(res => res.json())
  .then(user => {
    document.getElementById('navUserName').textContent = user.full_name;
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }
  })
  .catch(() => window.location.href = '/');

fetch('/api/bookings')
  .then(res => res.json())
  .then(bookings => {
    document.getElementById('loadingState').classList.add('hidden');

    if (!bookings || bookings.length === 0) {
      document.getElementById('emptyState').classList.remove('hidden');
      return;
    }

    const list = document.getElementById('bookingsList');
    list.classList.remove('hidden');

    list.innerHTML = bookings.map(b => {
      const date    = new Date(b.scheduled_at);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const statusLabel = {
        pending:   '⏳ Pending',
        confirmed: '✅ Confirmed',
        cancelled: '❌ Cancelled',
        completed: '🎓 Completed'
      }[b.status] || b.status;

      const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';
      const canCancel    = b.status === 'pending';
      const canReview    = b.status === 'completed';
      const canAddCal    = b.status === 'confirmed';
      const isResources  = b.session_type === 'resources';

      return `
        <div class="booking-card status-${b.status}" id="booking-${b.id}">
          <div class="booking-info">
            <div class="booking-tutor">👨‍🏫 ${b.tutor_name}</div>
            <span class="booking-course">${b.course_code}</span>
            <span class="session-type-badge">${sessionLabel}</span>
            ${!isResources
              ? `<div class="booking-date">📅 ${dateStr} at ${timeStr}</div>`
              : `<div class="booking-date">📚 Tutor will share materials after confirming</div>`
            }
            ${b.message ? `<div class="booking-message">"${b.message}"</div>` : ''}
            <div style="font-size:0.82rem;color:#aaa;margin-top:6px;">
              $${parseFloat(b.hourly_rate).toFixed(2)}/hr
              ${b.is_verified ? '· ✅ Verified Tutor' : ''}
            </div>
          </div>
          <div class="booking-right">
            <span class="status-badge ${b.status}">${statusLabel}</span>
            ${canCancel ? `<button class="btn-cancel-booking" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
            ${canReview ? `<button class="btn-submit-review" onclick="toggleReviewForm(${b.id})" id="reviewBtn-${b.id}">⭐ Leave Review</button>` : ''}
            ${canAddCal ? `<button class="btn-gcal" onclick="addToCalendar(${b.id}, this)">📅 Add to Google Calendar</button>` : ''}
          </div>
        </div>
        ${canReview ? `
          <div id="reviewForm-${b.id}" class="review-form-card hidden">
            <h4>⭐ Rate your session with ${b.tutor_name}</h4>
            <div class="star-picker" id="stars-${b.id}">
              <span data-val="1">★</span><span data-val="2">★</span>
              <span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span>
            </div>
            <textarea id="comment-${b.id}" placeholder="Share your experience (optional)..."></textarea>
            <br>
            <button class="btn-submit-review" onclick="submitReview(${b.id})">Submit Review</button>
            <span id="reviewFeedback-${b.id}" style="margin-left:10px;font-size:0.85rem;"></span>
          </div>
        ` : ''}
      `;
    }).join('');

    document.querySelectorAll('.star-picker').forEach(picker => {
      let selected = 0;
      picker.querySelectorAll('span').forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(picker, parseInt(star.dataset.val)));
        star.addEventListener('mouseout',  () => highlightStars(picker, selected));
        star.addEventListener('click', () => {
          selected = parseInt(star.dataset.val);
          picker.dataset.rating = selected;
          highlightStars(picker, selected);
        });
      });
    });
  })
  .catch(err => {
    console.error('Bookings error:', err);
    document.getElementById('loadingState').textContent = 'Could not load bookings.';
  });

function highlightStars(picker, count) {
  picker.querySelectorAll('span').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.val) <= count);
  });
}

function toggleReviewForm(id) {
  document.getElementById(`reviewForm-${id}`).classList.toggle('hidden');
}

async function submitReview(bookingId) {
  const picker   = document.getElementById(`stars-${bookingId}`);
  const rating   = parseInt(picker.dataset.rating || 0);
  const comment  = document.getElementById(`comment-${bookingId}`).value;
  const feedback = document.getElementById(`reviewFeedback-${bookingId}`);

  if (!rating) {
    feedback.textContent = '⚠️ Please select a star rating.';
    feedback.style.color = '#e74c3c';
    return;
  }

  try {
    const res  = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, rating, comment })
    });
    const data = await res.json();

    if (!res.ok) {
      feedback.textContent = data.error || 'Could not submit.';
      feedback.style.color = '#e74c3c';
    } else {
      feedback.textContent = '✅ Review submitted!';
      feedback.style.color = '#27ae60';
      const btn = document.getElementById(`reviewBtn-${bookingId}`);
      if (btn) btn.remove();
      setTimeout(() => document.getElementById(`reviewForm-${bookingId}`).classList.add('hidden'), 2000);
    }
  } catch {
    feedback.textContent = 'Network error.';
    feedback.style.color = '#e74c3c';
  }
}

function cancelBooking(id) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;
  fetch(`/api/bookings/${id}/cancel`, { method: 'PATCH' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const card = document.getElementById(`booking-${id}`);
        card.classList.remove('status-pending');
        card.classList.add('status-cancelled');
        card.querySelector('.status-badge').className = 'status-badge cancelled';
        card.querySelector('.status-badge').textContent = '❌ Cancelled';
        const btn = card.querySelector('.btn-cancel-booking');
        if (btn) btn.remove();
      }
    })
    .catch(() => alert('Could not cancel. Please try again.'));
}

// ── Google Calendar ───────────────────────────────────────────────────
async function addToCalendar(bookingId, btn) {
  btn.disabled = true;
  btn.textContent = '⏳ Adding...';

  try {
    const res  = await fetch(`/api/calendar/add/${bookingId}`, { method: 'POST' });
    const data = await res.json();

    if (data.redirect) {
      window.location.href = data.redirect;
      return;
    }
    if (data.success) {
      btn.textContent = '✅ Added to Calendar!';
      btn.style.background = '#00d4aa';
      btn.style.color = '#000';
      setTimeout(() => {
        btn.textContent = '📅 Add to Google Calendar';
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
      }, 3000);
    }
  } catch {
    btn.textContent = '❌ Failed. Try again.';
    btn.disabled = false;
  }
}

// Manejar redirect de vuelta desde Google OAuth
const gcalParam = new URLSearchParams(window.location.search).get('gcal');
if (gcalParam === 'success')   alert('✅ Session added to Google Calendar!');
if (gcalParam === 'error')     alert('❌ Could not connect Google Calendar. Try again.');
if (gcalParam === 'connected') alert('✅ Google Calendar connected!');
if (gcalParam) window.history.replaceState({}, '', '/bookings');

// ── Notification badge ────────────────────────────────────────────────
function loadNotifBadge() {
  fetch('/api/notifications/unread-count')
    .then(r => r.json())
    .then(data => {
      const badge = document.getElementById('sidebarBadge');
      if (!badge) return;
      if (data.count > 0) {
        badge.textContent = data.count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
}

loadNotifBadge();
setInterval(loadNotifBadge, 30000);