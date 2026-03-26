// ── Messages/Chat System ────────────────────────────────────────────────

let currentUser = null;
let socket = null;
let activeConversation = null;
let conversations = [];

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
  await loadCurrentUser();
  await loadConversations();
  initializeSocket();
});

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      currentUser = await response.json();
      
      // Update nav display
      document.getElementById('navUserName').textContent = currentUser.full_name;
      const roleEl = document.getElementById('navUserRole');
      if (roleEl) roleEl.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
      
      // ✅ SHOW TUTOR DASHBOARD LINK IF USER IS TUTOR
      if (currentUser.role === 'tutor') {
        const tutorLink = document.getElementById('tutorDashLink');
        if (tutorLink) tutorLink.style.display = 'flex';
      }
    } else {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Error loading user:', error);
    window.location.href = '/';
  }
}

async function loadConversations() {
  try {
    const response = await fetch('/api/conversations');
    if (response.ok) {
      conversations = await response.json();
      console.log('🔍 Conversations loaded:', conversations); // Debug line
      displayConversations();
    } else {
      console.error('Failed to load conversations');
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    showEmptyState();
  }
}

function displayConversations() {
  const container = document.getElementById('conversationsList');
  
  if (!conversations || conversations.length === 0) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:#999;font-size:0.9rem;">
        <div style="font-size:2rem;margin-bottom:8px;">💬</div>
        <p style="font-weight:600;margin-bottom:4px;">No conversations yet</p>
        <p style="font-size:0.8rem;">Messages will appear here when you have confirmed sessions</p>
      </div>
    `;
    return;
  }

  const conversationsHTML = conversations.map(conv => {
    // ✅ FIXED: Use other_name directly from API
    const otherPerson = conv.other_name;
    const lastMessage = conv.last_message ? 
      (conv.last_message.length > 40 ? conv.last_message.substring(0, 40) + '...' : conv.last_message) : 
      'No messages yet';
    
    const unreadClass = conv.unread_count > 0 ? 'unread' : '';
    const activeClass = activeConversation === conv.booking_id ? 'active' : '';

    return `
      <div class="conversation-item ${unreadClass} ${activeClass}" onclick="openConversation(${conv.booking_id})">
        <div class="conversation-avatar">${otherPerson.charAt(0).toUpperCase()}</div>
        <div class="conversation-info">
          <div class="conversation-name">${otherPerson}</div>
          <div class="conversation-course">${conv.course_code}</div>
          <div class="conversation-preview">${lastMessage}</div>
          <div class="conversation-time">${timeAgo(new Date(conv.last_message_at || conv.created_at))}</div>
        </div>
        ${conv.unread_count > 0 ? `<div class="unread-badge">${conv.unread_count}</div>` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = conversationsHTML;
}

function showEmptyState() {
  const container = document.getElementById('conversationsList');
  container.innerHTML = `
    <div style="padding:20px;text-align:center;color:#999;font-size:0.9rem;">
      <div style="font-size:2rem;margin-bottom:8px;">😔</div>
      <p style="font-weight:600;margin-bottom:4px;">Could not load messages</p>
      <p style="font-size:0.8rem;">Please refresh the page to try again</p>
    </div>
  `;
}

async function openConversation(bookingId) {
  if (activeConversation === bookingId) return;
  
  activeConversation = bookingId;
  
  // Update UI
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  event.currentTarget.classList.add('active');

  // Load messages for this conversation
  try {
    const response = await fetch(`/api/conversations/${bookingId}/messages`);
    if (response.ok) {
      const data = await response.json();
      displayChatPanel(data.booking, data.messages);
      
      // Join socket room for real-time updates
      if (socket) {
        socket.emit('join_booking', bookingId);
      }
      
      // Mark as read
      markConversationAsRead(bookingId);
    }
  } catch (error) {
    console.error('Error loading conversation:', error);
  }
}

function displayChatPanel(booking, messages) {
  const chatPanel = document.getElementById('chatPanel');
  
  // ✅ FIXED: Get other person name from current conversations list
  const currentConv = conversations.find(c => c.booking_id === activeConversation);
  const otherPerson = currentConv ? currentConv.other_name : 'Unknown User';
  
  chatPanel.innerHTML = `
    <div class="chat-header">
      <div class="chat-avatar">${otherPerson.charAt(0).toUpperCase()}</div>
      <div class="chat-info">
        <div class="chat-name">${otherPerson}</div>
        <div class="chat-course">${booking.course_code} • ${booking.status}</div>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages">
      ${messages.map(msg => renderMessage(msg)).join('')}
    </div>
    <div class="chat-input-area">
      <div class="chat-input-container">
        <textarea id="messageInput" placeholder="Type a message..." rows="1"></textarea>
        <button id="sendButton" onclick="sendMessage()">Send</button>
      </div>
    </div>
  `;

  // Scroll to bottom
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Auto-resize textarea
  const textarea = document.getElementById('messageInput');
  textarea.addEventListener('input', autoResizeTextarea);
  textarea.addEventListener('keydown', handleKeyDown);
}

function renderMessage(msg) {
  const isOwn = msg.sender_id === currentUser.id;
  const time = new Date(msg.created_at).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return `
    <div class="message ${isOwn ? 'own' : 'other'}">
      <div class="message-content">${escapeHtml(msg.content)}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
}

function autoResizeTextarea() {
  const textarea = document.getElementById('messageInput');
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const textarea = document.getElementById('messageInput');
  const content = textarea.value.trim();
  
  if (!content || !activeConversation) return;

  try {
    const response = await fetch('/api/conversations/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        booking_id: activeConversation,
        content: content
      })
    });

    if (response.ok) {
      textarea.value = '';
      autoResizeTextarea();
      
      // Add message to chat immediately
      const messagesContainer = document.getElementById('chatMessages');
      const newMessage = {
        sender_id: currentUser.id,
        content: content,
        created_at: new Date().toISOString()
      };
      messagesContainer.innerHTML += renderMessage(newMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Update conversations list
      loadConversations();
    } else {
      console.error('Failed to send message');
      showFeedback('Failed to send message', 'error');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showFeedback('Network error', 'error');
  }
}

async function markConversationAsRead(bookingId) {
  try {
    await fetch(`/api/conversations/${bookingId}/read`, {
      method: 'POST'
    });
    
    // Update UI
    const convItem = document.querySelector(`[onclick="openConversation(${bookingId})"]`);
    if (convItem) {
      convItem.classList.remove('unread');
      const badge = convItem.querySelector('.unread-badge');
      if (badge) badge.remove();
    }
    
    // Update conversations list
    const conv = conversations.find(c => c.booking_id === bookingId);
    if (conv) conv.unread_count = 0;
    
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

function initializeSocket() {
  if (typeof io === 'undefined') {
    console.error('Socket.io not loaded');
    return;
  }

  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to socket server');
    if (currentUser) {
      socket.emit('join_user', currentUser.id);
    }
  });

  socket.on('new_message', (data) => {
    // Add message to chat if it's the active conversation
    if (data.booking_id === activeConversation) {
      const messagesContainer = document.getElementById('chatMessages');
      if (messagesContainer) {
        messagesContainer.innerHTML += renderMessage(data.message);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
    
    // Update conversations list
    loadConversations();
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from socket server');
  });
}

// Utility functions
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showFeedback(message, type = 'info') {
  // Remove existing feedback
  const existingFeedback = document.getElementById('feedback');
  if (existingFeedback) existingFeedback.remove();
  
  // Create feedback element
  const feedback = document.createElement('div');
  feedback.id = 'feedback';
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: all 0.3s ease;
    max-width: 300px;
  `;

  // Set message and style
  feedback.textContent = message;

  if (type === 'success') {
    feedback.style.background = '#F76900';
    feedback.style.color = 'white';
  } else if (type === 'error') {
    feedback.style.background = '#000E54';
    feedback.style.color = 'white';
  } else {
    feedback.style.background = '#F76900';
    feedback.style.color = 'white';
  }

  document.body.appendChild(feedback);

  // Auto-hide
  setTimeout(() => {
    if (feedback && feedback.parentNode) {
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
    })
    .catch(() => {
      // Silently fail for notification badge
    });
}

loadNotifBadge();
setInterval(loadNotifBadge, 30000);