// ── Notifications page with Booking Actions ──────────────────────────

const socket = io();
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

    // Join personal socket room
    socket.emit('join_user', user.id);

    loadNotifications();
  })
  .catch(() => window.location.href = '/');

function loadNotifications() {
  fetch('/api/notifications')
    .then(r => r.json())
    .then(notifs => {
      document.getElementById('notifLoading').classList.add('hidden');

      const unread = notifs.filter(n => !n.is_read).length;
      const countEl = document.getElementById('unreadCount');
      countEl.textContent = unread > 0
        ? `${unread} unread notification${unread !== 1 ? 's' : ''}`
        : 'All caught up!';

      if (notifs.length === 0) {
        document.getElementById('notifEmpty').classList.remove('hidden');
        return;
      }

      const list = document.getElementById('notifList');
      list.classList.remove('hidden');
      list.innerHTML = notifs.map(n => buildNotifCard(n)).join('');
    });
}

function buildNotifCard(n) {
  const icons = {
    booking_request:  '📅',
    booking_confirmed:'✅',
    booking_declined: '❌',
    session_completed:'🎓',
    new_review:       '⭐',
    new_message:      '💬',
    payment_received: '💰'
  };

  const icon = icons[n.type] || '🔔';
  const time = timeAgo(new Date(n.created_at));
  const readClass = n.is_read ? 'read' : 'unread';

  // For tutors: Add action buttons to booking requests
  const isBookingRequest = n.type === 'booking_request' && currentUser && currentUser.role === 'tutor' && !n.is_read;
  const bookingId = n.booking_id; // Use booking_id from database

  const actionButtons = isBookingRequest && bookingId ? `
    <div class="notif-actions" onclick="event.stopPropagation()">
      <button class="btn-accept-notif" onclick="acceptBookingFromNotif(${bookingId}, ${n.id})">
        ✅ Accept
      </button>
      <button class="btn-reject-notif" onclick="openRejectModal(${bookingId}, ${n.id})">
        ❌ Decline
      </button>
    </div>
  ` : '';

  return `
    <div class="notif-card ${readClass}" id="notif-${n.id}" onclick="markRead(${n.id})">
      <div class="notif-icon">${icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-message">${n.message}</div>
        <div class="notif-time">${time}</div>
        ${actionButtons}
      </div>
      <div class="notif-unread-dot"></div>
    </div>
  `;
}

// Extract booking ID from notification message
function extractBookingId(message) {
  // Try to extract booking ID from notification data
  // This is a simple approach - in production you'd store booking_id in notifications table
  const match = message.match(/booking[:\s]+(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

// Accept booking directly from notification
async function acceptBookingFromNotif(bookingId, notifId) {
  if (!bookingId) {
    showNotifFeedback('Could not identify booking', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/confirm`, {
      method: 'PATCH'
    });

    if (response.ok) {
      markRead(notifId);
      document.getElementById(`notif-${notifId}`).style.opacity = '0.5';
      showNotifFeedback('✅ Booking accepted!', 'success');
      
      // Update the card to show it's been handled
      setTimeout(() => {
        const card = document.getElementById(`notif-${notifId}`);
        if (card) {
          card.querySelector('.notif-actions').remove();
          card.classList.add('read');
        }
      }, 1000);
    } else {
      const error = await response.json();
      showNotifFeedback(error.error || 'Could not accept booking', 'error');
    }
  } catch (err) {
    showNotifFeedback('Network error', 'error');
  }
}

// Open rejection modal
function openRejectModal(bookingId, notifId) {
  if (!bookingId) {
    showNotifFeedback('Could not identify booking', 'error');
    return;
  }

  // Create and show rejection modal
  const modal = document.createElement('div');
  modal.className = 'reject-modal-overlay';
  modal.innerHTML = `
    <div class="reject-modal">
      <div class="reject-modal-header">
        <h3>Decline Booking Request</h3>
        <button class="close-reject-modal" onclick="closeRejectModal()">&times;</button>
      </div>
      <div class="reject-modal-body">
        <label>Reason for declining:</label>
        <textarea id="rejectReason" placeholder="Let the student know why you can't accept this session..." maxlength="500"></textarea>
        <div class="reject-actions">
          <button class="btn-cancel-reject" onclick="closeRejectModal()">Cancel</button>
          <button class="btn-confirm-reject" onclick="confirmReject(${bookingId}, ${notifId})">Send Decline Message</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('rejectReason').focus();
}

function closeRejectModal() {
  const modal = document.querySelector('.reject-modal-overlay');
  if (modal) modal.remove();
}

// Confirm rejection and send message
async function confirmReject(bookingId, notifId) {
  const reason = document.getElementById('rejectReason').value.trim();
  
  if (!reason) {
    showNotifFeedback('Please provide a reason for declining', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/decline`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });

    if (response.ok) {
      closeRejectModal();
      markRead(notifId);
      document.getElementById(`notif-${notifId}`).style.opacity = '0.5';
      showNotifFeedback('✅ Decline message sent', 'success');
      
      // Update the card to show it's been handled
      setTimeout(() => {
        const card = document.getElementById(`notif-${notifId}`);
        if (card) {
          card.querySelector('.notif-actions').remove();
          card.classList.add('read');
        }
      }, 1000);
    } else {
      const error = await response.json();
      showNotifFeedback(error.error || 'Could not decline booking', 'error');
    }
  } catch (err) {
    showNotifFeedback('Network error', 'error');
  }
}

function markRead(id) {
  fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    .then(() => {
      const card = document.getElementById(`notif-${id}`);
      if (card) {
        card.classList.remove('unread');
        card.classList.add('read');
      }
      updateUnreadCount();
    });
}

document.getElementById('readAllBtn').addEventListener('click', () => {
  fetch('/api/notifications/read-all', { method: 'PATCH' })
    .then(() => {
      document.querySelectorAll('.notif-card.unread').forEach(card => {
        card.classList.remove('unread');
        card.classList.add('read');
      });
      document.getElementById('unreadCount').textContent = 'All caught up!';
    });
});

function updateUnreadCount() {
  const unread = document.querySelectorAll('.notif-card.unread').length;
  const countEl = document.getElementById('unreadCount');
  countEl.textContent = unread > 0
    ? `${unread} unread notification${unread !== 1 ? 's' : ''}`
    : 'All caught up!';
}

// Real-time new notification
socket.on('new_notification', (notif) => {
  const list = document.getElementById('notifList');
  if (!list) return;

  list.classList.remove('hidden');
  document.getElementById('notifEmpty').classList.add('hidden');

  const tempNotif = {
    id: Date.now(),
    type: notif.type,
    title: notif.title,
    message: notif.message,
    is_read: 0,
    created_at: new Date().toISOString()
  };

  list.insertAdjacentHTML('afterbegin', buildNotifCard(tempNotif));
  updateUnreadCount();
});

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)   return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showNotifFeedback(message, type = 'info') {
  let feedback = document.getElementById('notifFeedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'notifFeedback';
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