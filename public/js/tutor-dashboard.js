// ── Enhanced Tutor Dashboard with Reject Modals ──────────────────────────

let currentUser = null;

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

const sessionTypeLabels = {
  one_on_one: '👤 1-on-1',
  group:      '👥 Group',
  resources:  '📚 Resources'
};

fetch('/api/tutor-bookings')
  .then(res => res.json())
  .then(bookings => {
    const pending   = bookings.filter(b => b.status === 'pending');
    const confirmed = bookings.filter(b => b.status === 'confirmed');
    const completed = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

    // Stats
    document.getElementById('statsRow').innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${pending.length}</div>
        <div class="stat-label">Pending Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${confirmed.length}</div>
        <div class="stat-label">Confirmed Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${completed.length}</div>
        <div class="stat-label">Total Bookings</div>
      </div>
    `;

    // Pending requests
    if (pending.length === 0) {
      document.getElementById('pendingEmpty').classList.remove('hidden');
    } else {
      document.getElementById('pendingList').innerHTML = pending.map(renderPendingBooking).join('');
    }

    // Confirmed sessions
    if (confirmed.length > 0) {
      document.getElementById('confirmedSection').classList.remove('hidden');
      document.getElementById('confirmedList').innerHTML = confirmed.map(renderConfirmedBooking).join('');
    }

    // All other bookings
    if (completed.length === 0) {
      document.getElementById('allEmpty').classList.remove('hidden');
    } else {
      document.getElementById('allList').innerHTML = completed.map(renderCompletedBooking).join('');
    }
  })
  .catch(err => {
    console.error('Bookings error:', err);
    document.getElementById('pendingList').innerHTML = '<p style="color:#e74c3c;padding:20px;text-align:center;">Could not load bookings.</p>';
  });

function renderPendingBooking(b) {
  const date    = new Date(b.scheduled_at);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';
  const isResources = b.session_type === 'resources';

  return `
    <div class="booking-card pending-request">
      <div class="booking-info">
        <div class="booking-student">🎓 ${b.student_name}</div>
        <span class="booking-course">${b.course_code}</span>
        <span class="session-type-badge">${sessionLabel}</span>
        ${!isResources 
          ? `<div class="booking-date">📅 ${dateStr} at ${timeStr}</div>`
          : `<div class="booking-date">📚 Student requesting study materials</div>`
        }
        ${b.message ? `<div class="booking-message">"${b.message}"</div>` : ''}
        <div class="booking-meta">Requested ${timeAgo(new Date(b.created_at))}</div>
      </div>
      <div class="booking-actions">
        <button class="btn-accept-dash" onclick="acceptBooking(${b.id})">
          ✅ Accept
        </button>
        <button class="btn-reject-dash" onclick="openDashRejectModal(${b.id})">
          ❌ Decline
        </button>
      </div>
    </div>
  `;
}

function renderConfirmedBooking(b) {
  const date    = new Date(b.scheduled_at);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';
  const isResources = b.session_type === 'resources';

  return `
    <div class="booking-card confirmed">
      <div class="booking-info">
        <div class="booking-student">🎓 ${b.student_name}</div>
        <span class="booking-course">${b.course_code}</span>
        <span class="session-type-badge">${sessionLabel}</span>
        ${!isResources 
          ? `<div class="booking-date">📅 ${dateStr} at ${timeStr}</div>`
          : `<div class="booking-date">📚 Materials shared successfully</div>`
        }
        ${b.message ? `<div class="booking-message">"${b.message}"</div>` : ''}
      </div>
      <div class="booking-actions">
        <button class="btn-complete-dash" onclick="completeBooking(${b.id})">
          🎓 Mark Complete
        </button>
      </div>
    </div>
  `;
}

function renderCompletedBooking(b) {
  const date    = new Date(b.scheduled_at);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤';
  const statusLabel = b.status === 'completed' ? '✅ Completed' : '❌ Declined';

  return `
    <div class="booking-card ${b.status}">
      <div class="booking-info">
        <div class="booking-student">🎓 ${b.student_name}</div>
        <span class="booking-course">${b.course_code}</span>
        <span class="session-type-badge">${sessionLabel}</span>
        <div class="booking-date">${dateStr}</div>
      </div>
      <div class="booking-status">
        <span class="status-badge ${b.status}">${statusLabel}</span>
      </div>
    </div>
  `;
}

// Accept booking
async function acceptBooking(id) {
  try {
    const res = await fetch(`/api/tutor-bookings/${id}/confirm`, { method: 'PATCH' });
    if (res.ok) {
      showDashFeedback('✅ Booking accepted!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await res.json();
      showDashFeedback(error.error || 'Could not accept booking', 'error');
    }
  } catch {
    showDashFeedback('Network error', 'error');
  }
}

// Complete booking
async function completeBooking(id) {
  try {
    const res = await fetch(`/api/tutor-bookings/${id}/complete`, { method: 'PATCH' });
    if (res.ok) {
      showDashFeedback('🎓 Session marked as complete!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await res.json();
      showDashFeedback(error.error || 'Could not complete booking', 'error');
    }
  } catch {
    showDashFeedback('Network error', 'error');
  }
}

// Open dashboard reject modal
function openDashRejectModal(bookingId) {
  const modal = document.createElement('div');
  modal.className = 'dash-reject-modal-overlay';
  modal.innerHTML = `
    <div class="dash-reject-modal">
      <div class="dash-reject-modal-header">
        <h3>💬 Decline & Send Message</h3>
        <button class="close-dash-reject-modal" onclick="closeDashRejectModal()">&times;</button>
      </div>
      <div class="dash-reject-modal-body">
        <label>Explain why you can't accept this session:</label>
        <textarea id="dashRejectReason" placeholder="I'm sorry, but I'm not available at that time. Let me suggest some alternatives..." maxlength="500"></textarea>
        <div class="dash-reject-actions">
          <button class="btn-cancel-dash-reject" onclick="closeDashRejectModal()">Cancel</button>
          <button class="btn-send-dash-reject" onclick="confirmDashReject(${bookingId})">💬 Send & Decline</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('dashRejectReason').focus();
}

function closeDashRejectModal() {
  const modal = document.querySelector('.dash-reject-modal-overlay');
  if (modal) modal.remove();
}

// Confirm dashboard rejection
async function confirmDashReject(bookingId) {
  const reason = document.getElementById('dashRejectReason').value.trim();
  
  if (!reason) {
    showDashFeedback('Please provide a reason for declining', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/decline`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });

    if (response.ok) {
      closeDashRejectModal();
      showDashFeedback('✅ Decline message sent', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await response.json();
      showDashFeedback(error.error || 'Could not decline booking', 'error');
    }
  } catch (err) {
    showDashFeedback('Network error', 'error');
  }
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showDashFeedback(message, type = 'info') {
  let feedback = document.getElementById('dashFeedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'dashFeedback';
    feedback.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      max-width: 300px;
    `;
    document.body.appendChild(feedback);
  }

  feedback.textContent = message;
  
  if (type === 'success') {
    feedback.style.background = '#00d4aa';
    feedback.style.color = 'white';
  } else if (type === 'error') {
    feedback.style.background = '#e74c3c';
    feedback.style.color = 'white';
  } else {
    feedback.style.background = '#F76900';
    feedback.style.color = 'white';
  }

  feedback.style.display = 'block';
  feedback.style.opacity = '1';

  setTimeout(() => {
    if (feedback) {
      feedback.style.opacity = '0';
      setTimeout(() => {
        if (feedback && feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }
  }, 3000);
}

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