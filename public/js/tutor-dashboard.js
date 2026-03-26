// ── Tutor Dashboard ───────────────────────────────────────────────────────

let currentUser = null;

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
  })
  .catch(() => window.location.href = '/');

const sessionTypeLabels = {
  one_on_one: '👤 1-on-1',
  group:      '👥 Group',
  resources:  '📚 Resources'
};

// Load bookings and analytics in parallel
Promise.all([
  fetch('/api/tutor-bookings').then(r => r.json()),
  fetch('/api/tutor-analytics').then(r => r.json())
])
  .then(function(results) {
    const bookings  = results[0];
    const analytics = results[1];

    const pending   = bookings.filter(b => b.status === 'pending');
    const confirmed = bookings.filter(b => b.status === 'confirmed');
    const completed = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

    // #11 — Render full analytics section
    renderAnalytics(analytics, pending.length, confirmed.length);

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

    // History
    if (completed.length === 0) {
      document.getElementById('allEmpty').classList.remove('hidden');
    } else {
      document.getElementById('allList').innerHTML = completed.map(renderCompletedBooking).join('');
    }
  })
  .catch(function(err) {
    console.error('Dashboard load error:', err);
    document.getElementById('pendingList').innerHTML =
      '<p style="color:#e74c3c;padding:20px;text-align:center;">Could not load dashboard data.</p>';
  });

// ── #11 Analytics ─────────────────────────────────────────────────────────

function renderAnalytics(a, pendingCount, confirmedCount) {
  const avgRating     = parseFloat(a.rating.avg_rating || 0).toFixed(1);
  const totalEarnings = parseFloat(a.earnings.total_earnings || 0).toFixed(2);
  const monthEarnings = parseFloat(a.earnings.month_earnings || 0).toFixed(2);
  const completedCount = parseInt(a.sessions.completed || 0);
  const cancelledCount = parseInt(a.sessions.cancelled || 0);
  const totalSessions  = parseInt(a.sessions.total     || 0);
  const uniqueStudents = parseInt(a.uniqueStudents      || 0);
  const totalReviews   = parseInt(a.rating.total_reviews || 0);

  const statsRow = document.getElementById('statsRow');
  statsRow.style.display = 'block';
  statsRow.innerHTML =

    // ── Row 1: Key metrics ──
    '<div class="analytics-section">'
    + '<h2 class="analytics-title">📊 Your Performance</h2>'
    + '<div class="analytics-grid">'

    + '<div class="stat-card stat-earnings">'
    + '<div class="stat-icon">💰</div>'
    + '<div class="stat-number">$' + totalEarnings + '</div>'
    + '<div class="stat-label">Total Earnings</div>'
    + '<div class="stat-sub">$' + monthEarnings + ' this month</div>'
    + '</div>'

    + '<div class="stat-card stat-rating">'
    + '<div class="stat-icon">⭐</div>'
    + '<div class="stat-number">' + (totalReviews > 0 ? avgRating : '—') + '</div>'
    + '<div class="stat-label">Avg Rating</div>'
    + '<div class="stat-sub">' + totalReviews + ' review' + (totalReviews !== 1 ? 's' : '') + '</div>'
    + '</div>'

    + '<div class="stat-card stat-sessions">'
    + '<div class="stat-icon">🎓</div>'
    + '<div class="stat-number">' + completedCount + '</div>'
    + '<div class="stat-label">Completed Sessions</div>'
    + '<div class="stat-sub">' + totalSessions + ' total · ' + cancelledCount + ' cancelled</div>'
    + '</div>'

    + '<div class="stat-card stat-students">'
    + '<div class="stat-icon">👥</div>'
    + '<div class="stat-number">' + uniqueStudents + '</div>'
    + '<div class="stat-label">Students Helped</div>'
    + '<div class="stat-sub">' + pendingCount + ' pending · ' + confirmedCount + ' confirmed</div>'
    + '</div>'

    + '</div>' // analytics-grid
    + '</div>' // analytics-section

    // ── Row 2: Top courses + monthly chart ──
    + '<div class="analytics-bottom">'

    // Top courses
    + '<div class="analytics-card">'
    + '<h3>📚 Most Requested Courses</h3>'
    + (a.topCourses.length === 0
        ? '<p class="analytics-empty">No bookings yet</p>'
        : '<div class="top-courses-list">'
          + a.topCourses.map(function(c, i) {
              const maxBookings = a.topCourses[0].bookings;
              const pct = Math.round((c.bookings / maxBookings) * 100);
              return '<div class="top-course-row">'
                + '<span class="top-course-rank">' + (i + 1) + '</span>'
                + '<div class="top-course-info">'
                + '<span class="top-course-code">' + c.course_code + '</span>'
                + '<div class="top-course-bar-wrap">'
                + '<div class="top-course-bar" style="width:' + pct + '%"></div>'
                + '</div>'
                + '</div>'
                + '<span class="top-course-count">' + c.bookings + '</span>'
                + '</div>';
            }).join('')
          + '</div>'
      )
    + '</div>'

    // Monthly sessions chart
    + '<div class="analytics-card">'
    + '<h3>📅 Sessions — Last 6 Months</h3>'
    + (a.monthlyData.length === 0
        ? '<p class="analytics-empty">No data yet</p>'
        : renderMonthlyChart(a.monthlyData)
      )
    + '</div>'

    + '</div>'; // analytics-bottom

  // Animate stat cards
  statsRow.querySelectorAll('.stat-card').forEach(function(card, i) {
    card.style.animationDelay = (i * 80) + 'ms';
    card.style.animation = 'slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both';
  });
}

function renderMonthlyChart(data) {
  const maxTotal = Math.max.apply(null, data.map(function(d) { return d.total; })) || 1;

  return '<div class="monthly-chart">'
    + data.map(function(d) {
        const barH      = Math.round((d.total / maxTotal) * 100);
        const completedH = Math.round((d.completed / maxTotal) * 100);
        return '<div class="chart-col">'
          + '<div class="chart-bar-wrap">'
          + '<div class="chart-bar-total"  style="height:' + barH       + '%"></div>'
          + '<div class="chart-bar-done"   style="height:' + completedH + '%"></div>'
          + '</div>'
          + '<div class="chart-label">' + d.month.split(' ')[0] + '</div>'
          + '<div class="chart-count">'  + d.total + '</div>'
          + '</div>';
      }).join('')
    + '</div>'
    + '<div class="chart-legend">'
    + '<span class="legend-dot legend-total"></span> Total &nbsp;'
    + '<span class="legend-dot legend-done"></span> Completed'
    + '</div>';
}

// ── Render booking cards ──────────────────────────────────────────────────

function renderPendingBooking(b) {
  const date       = new Date(b.scheduled_at);
  const dateStr    = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr    = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';
  const isResources  = b.session_type === 'resources';

  return '<div class="booking-card pending-request">'
    + '<div class="booking-info">'
    + '<div class="booking-student">'
    + '<span class="student-avatar" style="' + (typeof getAvatarStyle === 'function' ? getAvatarStyle(b.student_id || 0) : '') + '">' + b.student_name.charAt(0).toUpperCase() + '</span>'
    + ' ' + b.student_name
    + '</div>'
    + '<span class="booking-course">' + b.course_code + '</span>'
    + '<span class="session-type-badge">' + sessionLabel + '</span>'
    + (!isResources
        ? '<div class="booking-date">📅 ' + dateStr + ' at ' + timeStr + '</div>'
        : '<div class="booking-date">📚 Student requesting study materials</div>')
    + (b.message ? '<div class="booking-message">"' + b.message + '"</div>' : '')
    + '<div class="booking-meta">Requested ' + timeAgo(new Date(b.created_at)) + '</div>'
    + '</div>'
    + '<div class="booking-actions">'
    + '<button class="btn-accept-dash" onclick="acceptBooking(' + b.id + ')" id="accept-' + b.id + '"><span>✅ Accept</span></button>'
    + '<button class="btn-reject-dash" onclick="openDashRejectModal(' + b.id + ')" id="reject-' + b.id + '"><span>❌ Decline</span></button>'
    + '</div>'
    + '</div>';
}

function renderConfirmedBooking(b) {
  const date       = new Date(b.scheduled_at);
  const dateStr    = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr    = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';
  const isResources  = b.session_type === 'resources';

  return '<div class="booking-card confirmed">'
    + '<div class="booking-info">'
    + '<div class="booking-student">'
    + '<span class="student-avatar" style="' + (typeof getAvatarStyle === 'function' ? getAvatarStyle(b.student_id || 0) : '') + '">' + b.student_name.charAt(0).toUpperCase() + '</span>'
    + ' ' + b.student_name
    + '</div>'
    + '<span class="booking-course">' + b.course_code + '</span>'
    + '<span class="session-type-badge">' + sessionLabel + '</span>'
    + (!isResources
        ? '<div class="booking-date">📅 ' + dateStr + ' at ' + timeStr + '</div>'
        : '<div class="booking-date">📚 Materials shared successfully</div>')
    + (b.message ? '<div class="booking-message">"' + b.message + '"</div>' : '')
    + '</div>'
    + '<div class="booking-actions">'
    + '<button class="btn-complete-dash" onclick="completeBooking(' + b.id + ')" id="complete-' + b.id + '"><span>🎓 Complete</span></button>'
    + '<button class="btn-cancel-dash" onclick="openCancelModal(' + b.id + ')" id="cancel-' + b.id + '"><span>⚠️ Cancel</span></button>'
    + '</div>'
    + '</div>';
}

function renderCompletedBooking(b) {
  const date       = new Date(b.scheduled_at);
  const dateStr    = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const sessionLabel = sessionTypeLabels[b.session_type] || '👤';
  const statusLabel  = b.status === 'completed' ? '✅ Completed' : '❌ Declined';

  return '<div class="booking-card ' + b.status + '">'
    + '<div class="booking-info">'
    + '<div class="booking-student">'
    + '<span class="student-avatar" style="' + (typeof getAvatarStyle === 'function' ? getAvatarStyle(b.student_id || 0) : '') + '">' + b.student_name.charAt(0).toUpperCase() + '</span>'
    + ' ' + b.student_name
    + '</div>'
    + '<span class="booking-course">' + b.course_code + '</span>'
    + '<span class="session-type-badge">' + sessionLabel + '</span>'
    + '<div class="booking-date">' + dateStr + '</div>'
    + '</div>'
    + '<div class="booking-status"><span class="status-badge ' + b.status + '">' + statusLabel + '</span></div>'
    + '</div>';
}

// ── Accept booking ────────────────────────────────────────────────────────

async function acceptBooking(id) {
  const acceptBtn = document.getElementById('accept-' + id);
  const rejectBtn = document.getElementById('reject-' + id);

  acceptBtn.disabled = true;
  rejectBtn.disabled = true;
  acceptBtn.innerHTML = '<span>⏳ Accepting...</span>';

  try {
    const res = await fetch('/api/tutor-bookings/' + id + '/confirm', { method: 'PATCH' });
    if (res.ok) {
      acceptBtn.innerHTML = '<span>✅ Accepted!</span>';
      acceptBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      showDashFeedback('🎉 Booking accepted successfully!', 'success');
      setTimeout(function() { window.location.reload(); }, 1500);
    } else {
      const error = await res.json();
      acceptBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not accept booking', 'error');
      setTimeout(function() {
        acceptBtn.disabled = false; rejectBtn.disabled = false;
        acceptBtn.innerHTML = '<span>✅ Accept</span>';
      }, 2000);
    }
  } catch {
    acceptBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    setTimeout(function() {
      acceptBtn.disabled = false; rejectBtn.disabled = false;
      acceptBtn.innerHTML = '<span>✅ Accept</span>';
    }, 2000);
  }
}

// ── Complete booking ──────────────────────────────────────────────────────

async function completeBooking(id) {
  const completeBtn = document.getElementById('complete-' + id);
  completeBtn.disabled = true;
  completeBtn.innerHTML = '<span>⏳ Completing...</span>';

  try {
    const res = await fetch('/api/tutor-bookings/' + id + '/complete', { method: 'PATCH' });
    if (res.ok) {
      completeBtn.innerHTML = '<span>✅ Complete!</span>';
      completeBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      showDashFeedback('🎓 Session marked as complete!', 'success');
      setTimeout(function() { window.location.reload(); }, 1500);
    } else {
      const error = await res.json();
      completeBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not complete booking', 'error');
      setTimeout(function() { completeBtn.disabled = false; completeBtn.innerHTML = '<span>🎓 Complete</span>'; }, 2000);
    }
  } catch {
    completeBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    setTimeout(function() { completeBtn.disabled = false; completeBtn.innerHTML = '<span>🎓 Complete</span>'; }, 2000);
  }
}

// ── Cancel confirmed session modal ────────────────────────────────────────

function openCancelModal(bookingId) {
  const modal = document.createElement('div');
  modal.className = 'cancel-modal-overlay';
  modal.innerHTML =
    '<div class="cancel-modal">'
    + '<div class="cancel-modal-header">'
    + '<h3>⚠️ Cancel Session</h3>'
    + '<button class="close-cancel-modal" onclick="closeCancelModal()">&times;</button>'
    + '</div>'
    + '<div class="cancel-modal-body">'
    + '<label>Explain why you need to cancel this confirmed session:</label>'
    + '<textarea id="cancelReason" placeholder="I apologize for the short notice..." maxlength="500"></textarea>'
    + '<div class="cancel-char-counter"><span id="cancelCharCount">0</span>/500 characters</div>'
    + '<div class="cancel-warning">'
    + '<span class="warning-icon">⚠️</span>'
    + '<span class="warning-text">This will cancel a confirmed session and notify the student immediately.</span>'
    + '</div>'
    + '<div class="cancel-reject-actions">'
    + '<button class="btn-cancel-cancel" onclick="closeCancelModal()"><span>Keep Session</span></button>'
    + '<button class="btn-confirm-cancel" onclick="confirmCancel(' + bookingId + ')" id="cancelConfirmBtn" disabled style="opacity:0.5;"><span>⚠️ Cancel Session</span></button>'
    + '</div>'
    + '</div>'
    + '</div>';

  document.body.appendChild(modal);

  const textarea = document.getElementById('cancelReason');
  textarea.focus();
  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('cancelCharCount').textContent = count;
    const btn = document.getElementById('cancelConfirmBtn');
    btn.disabled = count === 0;
    btn.style.opacity = count === 0 ? '0.5' : '1';
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { closeCancelModal(); document.removeEventListener('keydown', escHandler); }
  });
}

function closeCancelModal() {
  const modal = document.querySelector('.cancel-modal-overlay');
  if (modal) { modal.style.animation = 'fadeOut 0.3s ease-in-out'; setTimeout(function() { modal.remove(); }, 300); }
}

async function confirmCancel(bookingId) {
  const reason     = document.getElementById('cancelReason').value.trim();
  const confirmBtn = document.getElementById('cancelConfirmBtn');
  if (!reason) { showDashFeedback('Please provide a reason for canceling', 'error'); return; }

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span>⏳ Canceling...</span>';

  try {
    const response = await fetch('/api/tutor-bookings/' + bookingId + '/cancel-confirmed', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (response.ok) {
      confirmBtn.innerHTML = '<span>✅ Canceled!</span>';
      confirmBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      setTimeout(function() {
        closeCancelModal();
        showDashFeedback('⚠️ Session canceled and student notified', 'warning');
        setTimeout(function() { window.location.reload(); }, 1500);
      }, 1000);
    } else {
      const error = await response.json();
      confirmBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not cancel session', 'error');
      setTimeout(function() { confirmBtn.disabled = false; confirmBtn.innerHTML = '<span>⚠️ Cancel Session</span>'; }, 2000);
    }
  } catch {
    confirmBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    setTimeout(function() { confirmBtn.disabled = false; confirmBtn.innerHTML = '<span>⚠️ Cancel Session</span>'; }, 2000);
  }
}

// ── Decline pending request modal ─────────────────────────────────────────

function openDashRejectModal(bookingId) {
  const modal = document.createElement('div');
  modal.className = 'dash-reject-modal-overlay';
  modal.innerHTML =
    '<div class="dash-reject-modal">'
    + '<div class="dash-reject-modal-header">'
    + '<h3>💬 Send Decline Message</h3>'
    + '<button class="close-dash-reject-modal" onclick="closeDashRejectModal()">&times;</button>'
    + '</div>'
    + '<div class="dash-reject-modal-body">'
    + '<label>Explain why you cannot accept this session:</label>'
    + '<textarea id="dashRejectReason" placeholder="I\'m sorry, but I\'m not available at that time..." maxlength="500"></textarea>'
    + '<div class="dash-char-counter"><span id="dashCharCount">0</span>/500 characters</div>'
    + '<div class="dash-reject-actions">'
    + '<button class="btn-cancel-dash-reject" onclick="closeDashRejectModal()"><span>Cancel</span></button>'
    + '<button class="btn-send-dash-reject" onclick="confirmDashReject(' + bookingId + ')" id="dashConfirmRejectBtn" disabled style="opacity:0.5;"><span>💬 Send & Decline</span></button>'
    + '</div>'
    + '</div>'
    + '</div>';

  document.body.appendChild(modal);

  const textarea = document.getElementById('dashRejectReason');
  textarea.focus();
  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('dashCharCount').textContent = count;
    const btn = document.getElementById('dashConfirmRejectBtn');
    btn.disabled = count === 0;
    btn.style.opacity = count === 0 ? '0.5' : '1';
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { closeDashRejectModal(); document.removeEventListener('keydown', escHandler); }
  });
}

function closeDashRejectModal() {
  const modal = document.querySelector('.dash-reject-modal-overlay');
  if (modal) { modal.style.animation = 'fadeOut 0.3s ease-in-out'; setTimeout(function() { modal.remove(); }, 300); }
}

async function confirmDashReject(bookingId) {
  const reason     = document.getElementById('dashRejectReason').value.trim();
  const confirmBtn = document.getElementById('dashConfirmRejectBtn');
  if (!reason) { showDashFeedback('Please provide a reason for declining', 'error'); return; }

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span>⏳ Sending...</span>';

  try {
    const response = await fetch('/api/tutor-bookings/' + bookingId + '/decline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (response.ok) {
      confirmBtn.innerHTML = '<span>✅ Sent!</span>';
      confirmBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      setTimeout(function() {
        closeDashRejectModal();
        showDashFeedback('✅ Decline message sent successfully', 'success');
        setTimeout(function() { window.location.reload(); }, 1500);
      }, 1000);
    } else {
      const error = await response.json();
      confirmBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not decline booking', 'error');
      setTimeout(function() { confirmBtn.disabled = false; confirmBtn.innerHTML = '<span>💬 Send & Decline</span>'; }, 2000);
    }
  } catch {
    confirmBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    setTimeout(function() { confirmBtn.disabled = false; confirmBtn.innerHTML = '<span>💬 Send & Decline</span>'; }, 2000);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return Math.floor(seconds / 60)   + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showDashFeedback(message, type) {
  const existing = document.getElementById('dashFeedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.id = 'dashFeedback';

  const bg = type === 'success' ? 'linear-gradient(135deg,#00d4aa,#00b894)'
           : type === 'error'   ? 'linear-gradient(135deg,#e74c3c,#c0392b)'
           : type === 'warning' ? 'linear-gradient(135deg,#f39c12,#e67e22)'
           : 'linear-gradient(135deg,#F76900,#e05e00)';

  feedback.style.cssText = 'position:fixed;top:80px;right:20px;background:' + bg + ';color:white;'
    + 'padding:14px 18px;border-radius:12px;font-weight:600;font-size:0.88rem;'
    + 'z-index:10000;box-shadow:0 6px 24px rgba(0,0,0,0.2);'
    + 'transform:translateX(120%);transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);max-width:320px;';

  feedback.textContent = message;
  document.body.appendChild(feedback);
  setTimeout(function() { feedback.style.transform = 'translateX(0)'; }, 60);
  setTimeout(function() {
    feedback.style.transform = 'translateX(120%)';
    setTimeout(function() { if (feedback.parentNode) feedback.parentNode.removeChild(feedback); }, 350);
  }, 3200);
}

// ── Notification badge ────────────────────────────────────────────────────

function loadNotifBadge() {
  fetch('/api/notifications/unread-count')
    .then(r => r.json())
    .then(function(data) {
      const badge = document.getElementById('sidebarBadge');
      if (!badge) return;
      if (data.count > 0) { badge.textContent = data.count; badge.classList.remove('hidden'); }
      else { badge.classList.add('hidden'); }
    });
}

loadNotifBadge();
setInterval(loadNotifBadge, 30000);

// ── Injected CSS for analytics ────────────────────────────────────────────

const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes fadeOut {
    to { opacity:0; transform:scale(0.95); }
  }

  .analytics-section { margin-bottom: 24px; }
  .analytics-title {
    font-size: 1.05rem; font-weight: 700; color: #000E54;
    margin-bottom: 16px; padding-bottom: 10px;
    border-bottom: 2px solid #f0f0f0;
  }
  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }
  .stat-card {
    background: white; border-radius: 14px; padding: 18px 16px;
    text-align: center; box-shadow: 0 2px 10px rgba(0,14,84,0.06);
    border-left: 4px solid #F76900; transition: transform 0.2s;
  }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-icon { font-size: 1.4rem; margin-bottom: 6px; }
  .stat-number { font-size: 1.8rem; font-weight: 800; color: #000E54; }
  .stat-label  { font-size: 0.8rem; font-weight: 700; color: #666; margin-top: 2px; }
  .stat-sub    { font-size: 0.72rem; color: #aaa; margin-top: 4px; line-height: 1.4; }
  .stat-earnings { border-left-color: #00b894; }
  .stat-rating   { border-left-color: #f39c12; }
  .stat-sessions { border-left-color: #000E54; }
  .stat-students { border-left-color: #F76900; }

  .analytics-bottom {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;
  }
  .analytics-card {
    background: white; border-radius: 14px; padding: 20px;
    box-shadow: 0 2px 10px rgba(0,14,84,0.06);
  }
  .analytics-card h3 { font-size: 0.95rem; font-weight: 700; color: #000E54; margin-bottom: 14px; }
  .analytics-empty   { color: #aaa; font-size: 0.85rem; text-align: center; padding: 16px 0; }

  /* Top courses */
  .top-courses-list { display: flex; flex-direction: column; gap: 8px; }
  .top-course-row {
    display: flex; align-items: center; gap: 10px;
  }
  .top-course-rank {
    width: 20px; height: 20px; background: #F76900; color: white;
    border-radius: 50%; font-size: 0.72rem; font-weight: 800;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .top-course-info { flex: 1; min-width: 0; }
  .top-course-code { font-weight: 700; color: #000E54; font-size: 0.85rem; display: block; margin-bottom: 3px; }
  .top-course-bar-wrap { height: 6px; background: #f0f2f8; border-radius: 3px; overflow: hidden; }
  .top-course-bar { height: 100%; background: linear-gradient(90deg, #F76900, #e05e00); border-radius: 3px; transition: width 0.6s ease; }
  .top-course-count { font-size: 0.82rem; font-weight: 700; color: #F76900; flex-shrink: 0; }

  /* Monthly chart */
  .monthly-chart {
    display: flex; align-items: flex-end; gap: 8px;
    height: 120px; padding-bottom: 24px; position: relative;
  }
  .chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
  .chart-bar-wrap {
    width: 100%; flex: 1; display: flex; align-items: flex-end;
    position: relative; background: #f4f6fb; border-radius: 4px 4px 0 0;
  }
  .chart-bar-total {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: rgba(0,14,84,0.12); border-radius: 4px 4px 0 0; transition: height 0.6s ease;
  }
  .chart-bar-done {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: linear-gradient(180deg, #F76900, #e05e00);
    border-radius: 4px 4px 0 0; transition: height 0.6s ease;
  }
  .chart-label { font-size: 0.68rem; color: #aaa; margin-top: 4px; }
  .chart-count { font-size: 0.7rem; font-weight: 700; color: #000E54; }
  .chart-legend { display: flex; gap: 14px; font-size: 0.75rem; color: #666; margin-top: 8px; }
  .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin-right: 3px; }
  .legend-total { background: rgba(0,14,84,0.2); }
  .legend-done  { background: #F76900; }

  @media (max-width: 950px) {
    .analytics-grid   { grid-template-columns: repeat(2, 1fr); }
    .analytics-bottom { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .analytics-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .stat-number    { font-size: 1.5rem; }
  }
`;
document.head.appendChild(style);