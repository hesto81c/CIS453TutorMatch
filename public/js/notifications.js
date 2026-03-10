// ── Enhanced Notifications with Modern UI ────────────────────────────────

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

      // Add staggered animation to cards
      const cards = list.querySelectorAll('.notif-card');
      cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        card.style.animation = 'slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both';
      });
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
      <button class="btn-accept-notif" onclick="acceptBookingFromNotif(${bookingId}, ${n.id})" id="accept-${n.id}">
        <span>✅ Accept</span>
      </button>
      <button class="btn-reject-notif" onclick="openRejectModal(${bookingId}, ${n.id})" id="reject-${n.id}">
        <span>❌ Decline</span>
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

// Accept booking with enhanced feedback
async function acceptBookingFromNotif(bookingId, notifId) {
  if (!bookingId) {
    showNotifFeedback('Could not identify booking', 'error');
    return;
  }

  const acceptBtn = document.getElementById(`accept-${notifId}`);
  const rejectBtn = document.getElementById(`reject-${notifId}`);
  
  // Disable buttons and show loading
  acceptBtn.disabled = true;
  rejectBtn.disabled = true;
  acceptBtn.innerHTML = '<span>⏳ Accepting...</span>';

  try {
    const response = await fetch(`/api/tutor-bookings/${bookingId}/confirm`, {
      method: 'PATCH'
    });

    if (response.ok) {
      // Success animation
      acceptBtn.innerHTML = '<span>✅ Accepted!</span>';
      acceptBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
      
      markRead(notifId);
      showNotifFeedback('🎉 Booking accepted successfully!', 'success');
      
      // Animate card update
      setTimeout(() => {
        const card = document.getElementById(`notif-${notifId}`);
        if (card) {
          card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
          card.style.transform = 'scale(0.95)';
          card.style.opacity = '0.7';
          
          const actions = card.querySelector('.notif-actions');
          if (actions) {
            actions.style.transform = 'translateY(-10px)';
            actions.style.opacity = '0';
            setTimeout(() => actions.remove(), 300);
          }
          
          card.classList.remove('unread');
          card.classList.add('read');
        }
      }, 1000);
      
    } else {
      const error = await response.json();
      acceptBtn.innerHTML = '<span>❌ Failed</span>';
      showNotifFeedback(error.error || 'Could not accept booking', 'error');
      
      // Re-enable buttons after error
      setTimeout(() => {
        acceptBtn.disabled = false;
        rejectBtn.disabled = false;
        acceptBtn.innerHTML = '<span>✅ Accept</span>';
      }, 2000);
    }
  } catch (err) {
    acceptBtn.innerHTML = '<span>❌ Error</span>';
    showNotifFeedback('Network error occurred', 'error');
    
    // Re-enable buttons after error
    setTimeout(() => {
      acceptBtn.disabled = false;
      rejectBtn.disabled = false;
      acceptBtn.innerHTML = '<span>✅ Accept</span>';
    }, 2000);
  }
}

// Open enhanced rejection modal
function openRejectModal(bookingId, notifId) {
  if (!bookingId) {
    showNotifFeedback('Could not identify booking', 'error');
    return;
  }

  // Create modal with enhanced styling
  const modal = document.createElement('div');
  modal.className = 'reject-modal-overlay';
  modal.innerHTML = `
    <div class="reject-modal">
      <div class="reject-modal-header">
        <h3>💬 Send Decline Message</h3>
        <button class="close-reject-modal" onclick="closeRejectModal()">&times;</button>
      </div>
      <div class="reject-modal-body">
        <label>Explain why you can't accept this session:</label>
        <textarea id="rejectReason" placeholder="I'm sorry, but I'm not available at that time. However, I could offer alternative times like..." maxlength="500"></textarea>
        <div class="char-counter">
          <span id="charCount">0</span>/500 characters
        </div>
        <div class="reject-actions">
          <button class="btn-cancel-reject" onclick="closeRejectModal()">
            <span>Cancel</span>
          </button>
          <button class="btn-confirm-reject" onclick="confirmReject(${bookingId}, ${notifId})" id="confirmRejectBtn">
            <span>💬 Send & Decline</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Focus textarea and setup character counter
  const textarea = document.getElementById('rejectReason');
  textarea.focus();
  
  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('charCount').textContent = count;
    
    const confirmBtn = document.getElementById('confirmRejectBtn');
    if (count === 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
  });

  // Close modal on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeRejectModal();
  });
}

function closeRejectModal() {
  const modal = document.querySelector('.reject-modal-overlay');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => modal.remove(), 300);
  }
}

// Confirm rejection with enhanced feedback
async function confirmReject(bookingId, notifId) {
  const reason = document.getElementById('rejectReason').value.trim();
  const confirmBtn = document.getElementById('confirmRejectBtn');
  
  if (!reason) {
    showNotifFeedback('Please provide a reason for declining', 'error');
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
        closeRejectModal();
        markRead(notifId);
        showNotifFeedback('✅ Decline message sent successfully', 'success');
        
        // Update card
        setTimeout(() => {
          const card = document.getElementById(`notif-${notifId}`);
          if (card) {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0.7';
            
            const actions = card.querySelector('.notif-actions');
            if (actions) {
              actions.style.transform = 'translateY(-10px)';
              actions.style.opacity = '0';
              setTimeout(() => actions.remove(), 300);
            }
            
            card.classList.remove('unread');
            card.classList.add('read');
          }
        }, 500);
      }, 1000);
      
    } else {
      const error = await response.json();
      confirmBtn.innerHTML = '<span>❌ Failed</span>';
      showNotifFeedback(error.error || 'Could not decline booking', 'error');
      
      setTimeout(() => {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span>💬 Send & Decline</span>';
      }, 2000);
    }
  } catch (err) {
    confirmBtn.innerHTML = '<span>❌ Error</span>';
    showNotifFeedback('Network error occurred', 'error');
    
    setTimeout(() => {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>💬 Send & Decline</span>';
    }, 2000);
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
      showNotifFeedback('✅ All notifications marked as read', 'success');
    });
});

function updateUnreadCount() {
  const unread = document.querySelectorAll('.notif-card.unread').length;
  const countEl = document.getElementById('unreadCount');
  countEl.textContent = unread > 0
    ? `${unread} unread notification${unread !== 1 ? 's' : ''}`
    : 'All caught up!';
}

// Real-time new notification with animation
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
    booking_id: notif.booking_id,
    created_at: new Date().toISOString()
  };

  const newCard = buildNotifCard(tempNotif);
  list.insertAdjacentHTML('afterbegin', newCard);
  
  // Animate new notification
  const addedCard = list.firstElementChild;
  addedCard.style.transform = 'translateX(-100%)';
  addedCard.style.opacity = '0';
  
  setTimeout(() => {
    addedCard.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    addedCard.style.transform = 'translateX(0)';
    addedCard.style.opacity = '1';
  }, 100);
  
  updateUnreadCount();
  showNotifFeedback('🔔 New notification received', 'info');
});

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)   return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showNotifFeedback(message, type = 'info') {
  // Remove existing feedback
  const existingFeedback = document.getElementById('notifFeedback');
  if (existingFeedback) existingFeedback.remove();

  const feedback = document.createElement('div');
  feedback.id = 'notifFeedback';
  feedback.innerHTML = `
    <div class="feedback-content">
      <span class="feedback-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '💬'}</span>
      <span class="feedback-message">${message}</span>
    </div>
  `;
  
  feedback.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #00d4aa, #00b894)' : 
                  type === 'error' ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : 
                  'linear-gradient(135deg, #F76900, #e05e00)'};
    color: white;
    padding: 16px 20px;
    border-radius: 16px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2);
    transform: translateX(100%);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 350px;
    backdrop-filter: blur(10px);
  `;

  feedback.querySelector('.feedback-content').style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  feedback.querySelector('.feedback-icon').style.cssText = `
    font-size: 1.2rem;
  `;

  feedback.querySelector('.feedback-message').style.cssText = `
    font-size: 0.9rem;
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
  }, 3500);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
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
  
  .char-counter {
    text-align: right;
    font-size: 0.8rem;
    color: #666;
    margin-top: 8px;
  }
`;
document.head.appendChild(style);