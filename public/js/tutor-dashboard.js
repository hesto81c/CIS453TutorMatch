// ── Enhanced Tutor Dashboard with Cancel Session Functionality ──────────

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

    // Enhanced stats with animations
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

    // Add staggered animation to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
      card.style.animationDelay = `${index * 100}ms`;
      card.style.animation = 'slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both';
    });

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
        <button class="btn-accept-dash" onclick="acceptBooking(${b.id})" id="accept-${b.id}">
          <span>✅ Accept</span>
        </button>
        <button class="btn-reject-dash" onclick="openDashRejectModal(${b.id})" id="reject-${b.id}">
          <span>❌ Decline</span>
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
        <button class="btn-complete-dash" onclick="completeBooking(${b.id})" id="complete-${b.id}">
          <span>🎓 Complete</span>
        </button>
        <button class="btn-cancel-dash" onclick="openCancelModal(${b.id})" id="cancel-${b.id}">
          <span>⚠️ Cancel</span>
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

// Enhanced accept booking with feedback
async function acceptBooking(id) {
  const acceptBtn = document.getElementById(`accept-${id}`);
  const rejectBtn = document.getElementById(`reject-${id}`);
  
  // Disable buttons and show loading
  acceptBtn.disabled = true;
  rejectBtn.disabled = true;
  acceptBtn.innerHTML = '<span>⏳ Accepting...</span>';

  try {
    const res = await fetch(`/api/tutor-bookings/${id}/confirm`, { method: 'PATCH' });
    if (res.ok) {
      acceptBtn.innerHTML = '<span>✅ Accepted!</span>';
      acceptBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      
      showDashFeedback('🎉 Booking accepted successfully!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await res.json();
      acceptBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not accept booking', 'error');
      
      // Re-enable after error
      setTimeout(() => {
        acceptBtn.disabled = false;
        rejectBtn.disabled = false;
        acceptBtn.innerHTML = '<span>✅ Accept</span>';
      }, 2000);
    }
  } catch {
    acceptBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    
    // Re-enable after error
    setTimeout(() => {
      acceptBtn.disabled = false;
      rejectBtn.disabled = false;
      acceptBtn.innerHTML = '<span>✅ Accept</span>';
    }, 2000);
  }
}

// Enhanced complete booking
async function completeBooking(id) {
  const completeBtn = document.getElementById(`complete-${id}`);
  
  completeBtn.disabled = true;
  completeBtn.innerHTML = '<span>⏳ Completing...</span>';

  try {
    const res = await fetch(`/api/tutor-bookings/${id}/complete`, { method: 'PATCH' });
    if (res.ok) {
      completeBtn.innerHTML = '<span>✅ Complete!</span>';
      completeBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      
      showDashFeedback('🎓 Session marked as complete!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await res.json();
      completeBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not complete booking', 'error');
      
      setTimeout(() => {
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<span>🎓 Complete</span>';
      }, 2000);
    }
  } catch {
    completeBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    
    setTimeout(() => {
      completeBtn.disabled = false;
      completeBtn.innerHTML = '<span>🎓 Complete</span>';
    }, 2000);
  }
}

// NEW: Cancel confirmed session modal
function openCancelModal(bookingId) {
  const modal = document.createElement('div');
  modal.className = 'cancel-modal-overlay';
  modal.innerHTML = `
    <div class="cancel-modal">
      <div class="cancel-modal-header">
        <h3>⚠️ Cancel Session</h3>
        <button class="close-cancel-modal" onclick="closeCancelModal()">&times;</button>
      </div>
      <div class="cancel-modal-body">
        <label>Explain why you need to cancel this confirmed session:</label>
        <textarea id="cancelReason" placeholder="I apologize for the short notice, but I have an emergency and need to cancel. I can reschedule for..." maxlength="500"></textarea>
        <div class="cancel-char-counter">
          <span id="cancelCharCount">0</span>/500 characters
        </div>
        <div class="cancel-warning">
          <span class="warning-icon">⚠️</span>
          <span class="warning-text">This will cancel a confirmed session and notify the student immediately.</span>
        </div>
        <div class="cancel-reject-actions">
          <button class="btn-cancel-cancel" onclick="closeCancelModal()">
            <span>Keep Session</span>
          </button>
          <button class="btn-confirm-cancel" onclick="confirmCancel(${bookingId})" id="cancelConfirmBtn">
            <span>⚠️ Cancel Session</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Focus textarea and setup character counter
  const textarea = document.getElementById('cancelReason');
  textarea.focus();
  
  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('cancelCharCount').textContent = count;
    
    const confirmBtn = document.getElementById('cancelConfirmBtn');
    if (count === 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
  });

  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCancelModal();
  });
}

function closeCancelModal() {
  const modal = document.querySelector('.cancel-modal-overlay');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => modal.remove(), 300);
  }
}

// NEW: Confirm session cancellation
async function confirmCancel(bookingId) {
  const reason = document.getElementById('cancelReason').value.trim();
  const confirmBtn = document.getElementById('cancelConfirmBtn');
  
  if (!reason) {
    showDashFeedback('Please provide a reason for canceling', 'error');
    return;
  }

  // Show loading state
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span>⏳ Canceling...</span>';

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/cancel-confirmed`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });

    if (response.ok) {
      confirmBtn.innerHTML = '<span>✅ Canceled!</span>';
      confirmBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      
      setTimeout(() => {
        closeCancelModal();
        showDashFeedback('⚠️ Session canceled and student notified', 'warning');
        setTimeout(() => window.location.reload(), 1500);
      }, 1000);
      
    } else {
      const error = await response.json();
      confirmBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not cancel session', 'error');
      
      setTimeout(() => {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span>⚠️ Cancel Session</span>';
      }, 2000);
    }
  } catch (err) {
    confirmBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    
    setTimeout(() => {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>⚠️ Cancel Session</span>';
    }, 2000);
  }
}

// Enhanced dashboard reject modal (for pending requests)
function openDashRejectModal(bookingId) {
  const modal = document.createElement('div');
  modal.className = 'dash-reject-modal-overlay';
  modal.innerHTML = `
    <div class="dash-reject-modal">
      <div class="dash-reject-modal-header">
        <h3>💬 Send Decline Message</h3>
        <button class="close-dash-reject-modal" onclick="closeDashRejectModal()">&times;</button>
      </div>
      <div class="dash-reject-modal-body">
        <label>Explain why you can't accept this session:</label>
        <textarea id="dashRejectReason" placeholder="I'm sorry, but I'm not available at that time. However, I could offer alternative times like..." maxlength="500"></textarea>
        <div class="dash-char-counter">
          <span id="dashCharCount">0</span>/500 characters
        </div>
        <div class="dash-reject-actions">
          <button class="btn-cancel-dash-reject" onclick="closeDashRejectModal()">
            <span>Cancel</span>
          </button>
          <button class="btn-send-dash-reject" onclick="confirmDashReject(${bookingId})" id="dashConfirmRejectBtn">
            <span>💬 Send & Decline</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Focus textarea and setup character counter
  const textarea = document.getElementById('dashRejectReason');
  textarea.focus();
  
  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('dashCharCount').textContent = count;
    
    const confirmBtn = document.getElementById('dashConfirmRejectBtn');
    if (count === 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
  });

  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeDashRejectModal();
  });
}

function closeDashRejectModal() {
  const modal = document.querySelector('.dash-reject-modal-overlay');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => modal.remove(), 300);
  }
}

// Enhanced dashboard rejection confirmation
async function confirmDashReject(bookingId) {
  const reason = document.getElementById('dashRejectReason').value.trim();
  const confirmBtn = document.getElementById('dashConfirmRejectBtn');
  
  if (!reason) {
    showDashFeedback('Please provide a reason for declining', 'error');
    return;
  }

  // Show loading state
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span>⏳ Sending...</span>';

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/decline`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });

    if (response.ok) {
      confirmBtn.innerHTML = '<span>✅ Sent!</span>';
      confirmBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      
      setTimeout(() => {
        closeDashRejectModal();
        showDashFeedback('✅ Decline message sent successfully', 'success');
        setTimeout(() => window.location.reload(), 1500);
      }, 1000);
      
    } else {
      const error = await response.json();
      confirmBtn.innerHTML = '<span>❌ Failed</span>';
      showDashFeedback(error.error || 'Could not decline booking', 'error');
      
      setTimeout(() => {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span>💬 Send & Decline</span>';
      }, 2000);
    }
  } catch (err) {
    confirmBtn.innerHTML = '<span>❌ Error</span>';
    showDashFeedback('Network error occurred', 'error');
    
    setTimeout(() => {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>💬 Send & Decline</span>';
    }, 2000);
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
  // Remove existing feedback
  const existingFeedback = document.getElementById('dashFeedback');
  if (existingFeedback) existingFeedback.remove();

  const feedback = document.createElement('div');
  feedback.id = 'dashFeedback';
  feedback.innerHTML = `
    <div class="feedback-content">
      <span class="feedback-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '💬'}</span>
      <span class="feedback-message">${message}</span>
    </div>
  `;
  
  feedback.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #00d4aa, #00b894)' : 
                  type === 'error' ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : 
                  type === 'warning' ? 'linear-gradient(135deg, #f39c12, #e67e22)' :
                  'linear-gradient(135deg, #F76900, #e05e00)'};
    color: white;
    padding: 14px 18px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 6px 25px rgba(0,0,0,0.25), 0 3px 12px rgba(0,0,0,0.15);
    transform: translateX(100%);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 320px;
    backdrop-filter: blur(10px);
  `;

  feedback.querySelector('.feedback-content').style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  feedback.querySelector('.feedback-icon').style.cssText = `
    font-size: 1.1rem;
    flex-shrink: 0;
  `;

  feedback.querySelector('.feedback-message').style.cssText = `
    font-size: 0.85rem;
  `;

  document.body.appendChild(feedback);

  // Slide in
  setTimeout(() => {
    feedback.style.transform = 'translateX(0)';
  }, 100);

  // Slide out
  setTimeout(() => {
    feedback.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (feedback && feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 400);
  }, 3200);
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

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
`;
document.head.appendChild(style);