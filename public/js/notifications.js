// ── Notifications Page ────────────────────────────────────────────────────

const socket       = io();
let currentUser    = null;
let currentOffset  = 0;       // #7 pagination
const PAGE_SIZE    = 20;       // notifications per page

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

    socket.emit('join_user', user.id);
    loadNotifications();
  })
  .catch(() => window.location.href = '/');

// ── Load notifications ────────────────────────────────────────────────────

// #7 — Load notifications with pagination
function loadNotifications(append) {
  const url = '/api/notifications?limit=' + PAGE_SIZE + '&offset=' + currentOffset;

  fetch(url)
    .then(r => r.json())
    .then(function(data) {
      document.getElementById('notifLoading').classList.add('hidden');

      const notifs = data.notifications || [];
      const total  = data.total || 0;
      const hasMore = data.hasMore || false;

      // Update unread count from fresh data (only on first load)
      if (!append) {
        fetch('/api/notifications/unread-count')
          .then(r => r.json())
          .then(function(d) {
            const countEl = document.getElementById('unreadCount');
            countEl.textContent = d.count > 0
              ? d.count + ' unread notification' + (d.count !== 1 ? 's' : '')
              : 'All caught up!';
          });
      }

      if (!append && notifs.length === 0) {
        document.getElementById('notifEmpty').classList.remove('hidden');
        return;
      }

      const list = document.getElementById('notifList');
      list.classList.remove('hidden');

      if (append) {
        // Remove existing load-more button before appending
        const oldBtn = document.getElementById('loadMoreBtn');
        if (oldBtn) oldBtn.remove();

        // Append new cards
        const fragment = document.createDocumentFragment();
        notifs.forEach(function(n) {
          const div = document.createElement('div');
          div.innerHTML = buildNotifCard(n);
          const card = div.firstElementChild;
          card.style.opacity   = '0';
          card.style.transform = 'translateY(16px)';
          fragment.appendChild(card);
        });
        list.appendChild(fragment);

        // Animate the newly added cards
        Array.from(list.children).slice(-notifs.length).forEach(function(card, i) {
          setTimeout(function() {
            card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            card.style.opacity    = '1';
            card.style.transform  = 'translateY(0)';
          }, i * 60);
        });
      } else {
        // First load — replace content
        list.innerHTML = notifs.map(function(n) { return buildNotifCard(n); }).join('');

        // Staggered entrance animation
        list.querySelectorAll('.notif-card').forEach(function(card, index) {
          card.style.animationDelay = (index * 60) + 'ms';
          card.style.animation = 'slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both';
        });
      }

      // Show or hide "Load more" button
      if (hasMore) {
        const remaining = total - (currentOffset + notifs.length);
        const btn = document.createElement('div');
        btn.id        = 'loadMoreBtn';
        btn.className = 'load-more-container';
        btn.innerHTML = '<button class="btn-load-more" onclick="loadMore()">'
          + 'Load more <span class="load-more-count">(' + remaining + ' remaining)</span>'
          + '</button>';
        list.parentNode.insertBefore(btn, list.nextSibling);
      }
    })
    .catch(function(err) {
      console.error('Error loading notifications:', err);
      document.getElementById('notifLoading').classList.add('hidden');
    });
}

// #7 — Load next page
function loadMore() {
  currentOffset += PAGE_SIZE;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) {
    btn.innerHTML = '<div style="text-align:center;padding:16px;color:#888;font-size:0.88rem;">Loading...</div>';
  }
  loadNotifications(true);
}

// ── Build notification card ───────────────────────────────────────────────

function buildNotifCard(n) {
  const icons = {
    booking_request:   '📅',
    booking_confirmed: '✅',
    booking_declined:  '❌',
    session_completed: '🎓',
    session_cancelled: '⚠️',
    new_review:        '⭐',
    new_message:       '💬',
    payment_received:  '💰'
  };

  const icon      = icons[n.type] || '🔔';
  const time      = timeAgo(new Date(n.created_at));
  const readClass = n.is_read ? 'read' : 'unread';

  // Only show action buttons for unread booking requests received by tutors
  const isActionable = n.type === 'booking_request'
    && currentUser
    && currentUser.role === 'tutor'
    && !n.is_read
    && n.booking_id;

  const actionButtons = isActionable
    ? '<div class="notif-actions" onclick="event.stopPropagation()">'
      + '<button class="btn-accept-notif" id="accept-' + n.id + '" onclick="acceptBooking(' + n.booking_id + ', ' + n.id + ')">'
      + '✅ Accept'
      + '</button>'
      + '<button class="btn-reject-notif" id="reject-' + n.id + '" onclick="openRejectModal(' + n.booking_id + ', ' + n.id + ')">'
      + '❌ Decline'
      + '</button>'
      + '</div>'
    : '';

  return '<div class="notif-card ' + readClass + '" id="notif-' + n.id + '" onclick="markRead(' + n.id + ')">'
    + '<div class="notif-icon">' + icon + '</div>'
    + '<div class="notif-body">'
    + '<div class="notif-title">' + n.title + '</div>'
    + '<div class="notif-message">' + n.message + '</div>'
    + '<div class="notif-time">' + time + '</div>'
    + actionButtons
    + '</div>'
    + '<div class="notif-unread-dot"></div>'
    + '</div>';
}

// ── #5 — Transform card into a clear result state ─────────────────────────
// Called after accept or decline succeeds.
// Replaces the action buttons with a permanent status banner inside the card.

function transformCardToResult(notifId, result) {
  const card = document.getElementById('notif-' + notifId);
  if (!card) return;

  // Remove action buttons first
  const actions = card.querySelector('.notif-actions');
  if (actions) {
    actions.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    actions.style.opacity    = '0';
    actions.style.transform  = 'translateY(-8px)';
    setTimeout(function() {
      if (actions.parentNode) actions.remove();

      // Insert result banner in its place
      const resultBanner = document.createElement('div');
      resultBanner.className = 'notif-result-banner notif-result-' + result;

      if (result === 'accepted') {
        resultBanner.innerHTML =
          '<span class="notif-result-icon">✅</span>'
          + '<span class="notif-result-text">Booking accepted — student has been notified</span>';
      } else {
        resultBanner.innerHTML =
          '<span class="notif-result-icon">❌</span>'
          + '<span class="notif-result-text">Booking declined — student has been notified</span>';
      }

      // Animate banner in
      resultBanner.style.opacity   = '0';
      resultBanner.style.transform = 'translateY(8px)';
      card.querySelector('.notif-body').appendChild(resultBanner);

      setTimeout(function() {
        resultBanner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        resultBanner.style.opacity    = '1';
        resultBanner.style.transform  = 'translateY(0)';
      }, 50);

      // Update card border color to reflect result
      card.style.transition  = 'border-left-color 0.4s ease, background 0.4s ease';
      card.style.borderLeftColor = result === 'accepted' ? '#00b894' : '#e74c3c';
      card.style.background  = result === 'accepted'
        ? 'linear-gradient(135deg, #f0fdf9, #eafaf1)'
        : 'linear-gradient(135deg, #fdf0f0, #fdecea)';

      card.classList.remove('unread');
      card.classList.add('read');
    }, 220);
  }
}

// ── Accept booking ────────────────────────────────────────────────────────

async function acceptBooking(bookingId, notifId) {
  if (!bookingId) { showNotifFeedback('Could not identify booking', 'error'); return; }

  const acceptBtn = document.getElementById('accept-' + notifId);
  const rejectBtn = document.getElementById('reject-' + notifId);

  // Loading state
  acceptBtn.disabled      = true;
  rejectBtn.disabled      = true;
  acceptBtn.innerHTML     = '⏳ Accepting...';
  acceptBtn.style.opacity = '0.8';

  try {
    const response = await fetch('/api/tutor-bookings/' + bookingId + '/confirm', {
      method: 'PATCH'
    });

    if (response.ok) {
      markRead(notifId);
      showNotifFeedback('🎉 Booking accepted! The student has been notified.', 'success');
      // #5 — transform the card to show a clear accepted state
      transformCardToResult(notifId, 'accepted');
    } else {
      const error = await response.json();
      acceptBtn.innerHTML     = '✅ Accept';
      acceptBtn.style.opacity = '1';
      acceptBtn.disabled      = false;
      rejectBtn.disabled      = false;
      showNotifFeedback(error.error || 'Could not accept booking', 'error');
    }
  } catch {
    acceptBtn.innerHTML     = '✅ Accept';
    acceptBtn.style.opacity = '1';
    acceptBtn.disabled      = false;
    rejectBtn.disabled      = false;
    showNotifFeedback('Network error. Please try again.', 'error');
  }
}

// ── Decline modal ─────────────────────────────────────────────────────────

function openRejectModal(bookingId, notifId) {
  if (!bookingId) { showNotifFeedback('Could not identify booking', 'error'); return; }

  const modal = document.createElement('div');
  modal.className = 'reject-modal-overlay';
  modal.innerHTML =
    '<div class="reject-modal">'
    + '<div class="reject-modal-header">'
    + '<h3>💬 Send Decline Message</h3>'
    + '<button class="close-reject-modal" onclick="closeRejectModal()">&times;</button>'
    + '</div>'
    + '<div class="reject-modal-body">'
    + '<label>Explain why you cannot accept this session:</label>'
    + '<textarea id="rejectReason" placeholder="I\'m sorry, but I\'m not available at that time. I could offer alternative times like..." maxlength="500"></textarea>'
    + '<div class="char-counter"><span id="charCount">0</span>/500 characters</div>'
    + '<div class="reject-actions">'
    + '<button class="btn-cancel-reject" onclick="closeRejectModal()">Cancel</button>'
    + '<button class="btn-confirm-reject" id="confirmRejectBtn" onclick="confirmReject(' + bookingId + ', ' + notifId + ')" disabled style="opacity:0.5;">💬 Send & Decline</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  document.body.appendChild(modal);

  const textarea = document.getElementById('rejectReason');
  textarea.focus();

  textarea.addEventListener('input', function() {
    const count = this.value.length;
    document.getElementById('charCount').textContent = count;
    const btn = document.getElementById('confirmRejectBtn');
    btn.disabled      = count === 0;
    btn.style.opacity = count === 0 ? '0.5' : '1';
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeRejectModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

function closeRejectModal() {
  const modal = document.querySelector('.reject-modal-overlay');
  if (modal) {
    modal.style.animation = 'fadeOut 0.25s ease-in-out forwards';
    setTimeout(function() { modal.remove(); }, 250);
  }
}

async function confirmReject(bookingId, notifId) {
  const reason     = document.getElementById('rejectReason').value.trim();
  const confirmBtn = document.getElementById('confirmRejectBtn');

  if (!reason) { showNotifFeedback('Please provide a reason.', 'error'); return; }

  confirmBtn.disabled  = true;
  confirmBtn.innerHTML = '⏳ Sending...';

  try {
    const response = await fetch('/api/tutor-bookings/' + bookingId + '/decline', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason })
    });

    if (response.ok) {
      confirmBtn.innerHTML           = '✅ Sent!';
      confirmBtn.style.background    = 'linear-gradient(135deg, #00d4aa, #00b894)';

      setTimeout(function() {
        closeRejectModal();
        markRead(notifId);
        showNotifFeedback('Booking declined — message sent to student.', 'info');
        // #5 — transform the card to show a clear declined state
        transformCardToResult(notifId, 'declined');
      }, 800);
    } else {
      const error      = await response.json();
      confirmBtn.disabled  = false;
      confirmBtn.innerHTML = '💬 Send & Decline';
      showNotifFeedback(error.error || 'Could not decline booking', 'error');
    }
  } catch {
    confirmBtn.disabled  = false;
    confirmBtn.innerHTML = '💬 Send & Decline';
    showNotifFeedback('Network error. Please try again.', 'error');
  }
}

// ── Mark read ─────────────────────────────────────────────────────────────

function markRead(id) {
  fetch('/api/notifications/' + id + '/read', { method: 'PATCH' })
    .then(function() {
      const card = document.getElementById('notif-' + id);
      if (card) {
        card.classList.remove('unread');
        card.classList.add('read');
      }
      updateUnreadCount();
    });
}

document.getElementById('readAllBtn').addEventListener('click', function() {
  fetch('/api/notifications/read-all', { method: 'PATCH' })
    .then(function() {
      document.querySelectorAll('.notif-card.unread').forEach(function(card) {
        card.classList.remove('unread');
        card.classList.add('read');
      });
      document.getElementById('unreadCount').textContent = 'All caught up!';
      showNotifFeedback('All notifications marked as read', 'success');
    });
});

function updateUnreadCount() {
  const unread  = document.querySelectorAll('.notif-card.unread').length;
  const countEl = document.getElementById('unreadCount');
  countEl.textContent = unread > 0
    ? unread + ' unread notification' + (unread !== 1 ? 's' : '')
    : 'All caught up!';
}

// ── Real-time new notification ────────────────────────────────────────────

socket.on('new_notification', function(notif) {
  const list = document.getElementById('notifList');
  if (!list) return;

  list.classList.remove('hidden');
  document.getElementById('notifEmpty').classList.add('hidden');

  const tempNotif = {
    id:         Date.now(),
    type:       notif.type,
    title:      notif.title,
    message:    notif.message,
    is_read:    0,
    booking_id: notif.booking_id,
    created_at: new Date().toISOString()
  };

  list.insertAdjacentHTML('afterbegin', buildNotifCard(tempNotif));

  const addedCard = list.firstElementChild;
  addedCard.style.transform  = 'translateX(-100%)';
  addedCard.style.opacity    = '0';
  setTimeout(function() {
    addedCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    addedCard.style.transform  = 'translateX(0)';
    addedCard.style.opacity    = '1';
  }, 80);

  updateUnreadCount();
  showNotifFeedback('🔔 New notification received', 'info');
});

// ── Utilities ─────────────────────────────────────────────────────────────

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)    return 'Just now';
  if (seconds < 3600)  return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showNotifFeedback(message, type) {
  const existing = document.getElementById('notifFeedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.id = 'notifFeedback';

  const bg = type === 'success' ? 'linear-gradient(135deg,#00d4aa,#00b894)'
           : type === 'error'   ? 'linear-gradient(135deg,#e74c3c,#c0392b)'
           : 'linear-gradient(135deg,#F76900,#e05e00)';

  feedback.style.cssText = 'position:fixed;top:80px;right:20px;background:' + bg + ';color:white;'
    + 'padding:14px 20px;border-radius:14px;font-weight:600;font-size:0.9rem;'
    + 'z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,0.2);'
    + 'transform:translateX(120%);transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);max-width:340px;';

  feedback.textContent = message;
  document.body.appendChild(feedback);

  setTimeout(function() { feedback.style.transform = 'translateX(0)'; }, 60);
  setTimeout(function() {
    feedback.style.transform = 'translateX(120%)';
    setTimeout(function() { if (feedback.parentNode) feedback.parentNode.removeChild(feedback); }, 350);
  }, 3500);
}

// ── CSS injected at runtime ───────────────────────────────────────────────

const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeOut {
    to { opacity: 0; transform: scale(0.96); }
  }

  /* #5 — Result banner shown after accept/decline */
  .notif-result-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 0.84rem;
    font-weight: 600;
  }

  .notif-result-accepted {
    background: linear-gradient(135deg, #eafaf1, #d5f5e3);
    color: #1e8449;
    border: 1px solid rgba(30,132,73,0.2);
  }

  .notif-result-declined {
    background: linear-gradient(135deg, #fdecea, #fadbd8);
    color: #c0392b;
    border: 1px solid rgba(192,57,43,0.2);
  }

  .notif-result-icon { font-size: 1rem; flex-shrink: 0; }
  .notif-result-text { line-height: 1.4; }

  .char-counter {
    text-align: right;
    font-size: 0.8rem;
    color: #888;
    margin-top: 6px;
  }
`;
document.head.appendChild(style);