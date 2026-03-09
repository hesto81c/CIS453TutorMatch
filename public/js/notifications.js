// ── Notifications page ────────────────────────────────────────────────

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
    new_message:      '💬'
  };

  const icon = icons[n.type] || '🔔';
  const time = timeAgo(new Date(n.created_at));
  const readClass = n.is_read ? 'read' : 'unread';

  return `
    <div class="notif-card ${readClass}" id="notif-${n.id}" onclick="markRead(${n.id})">
      <div class="notif-icon">${icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-message">${n.message}</div>
        <div class="notif-time">${time}</div>
      </div>
      <div class="notif-unread-dot"></div>
    </div>
  `;
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

  const icons = {
    booking_request:  '📅',
    booking_confirmed:'✅',
    booking_declined: '❌',
    session_completed:'🎓',
    new_review:       '⭐',
    new_message:      '💬'
  };

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