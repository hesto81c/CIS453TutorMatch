// ── Dashboard with Personalized Recent Searches ──────────────────────────

let currentUser = null;
const MAX_RECENT_SEARCHES = 5;

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

    // Load recent searches for this user
    loadRecentSearches();
  })
  .catch(() => window.location.href = '/');

// Load and display recent searches
function loadRecentSearches() {
  if (!currentUser) return;

  const recentSearches = getRecentSearches(currentUser.id);
  const quickChipsContainer = document.querySelector('.quick-chips');
  
  if (recentSearches.length === 0) {
    // Hide the container if no recent searches
    quickChipsContainer.style.display = 'none';
    return;
  }

  // Show container and populate with recent searches
  quickChipsContainer.style.display = 'flex';
  quickChipsContainer.innerHTML = recentSearches
    .map(search => `<span class="chip recent-search" data-q="${search}">${search}</span>`)
    .join('');

  // Add click handlers to recent search chips
  quickChipsContainer.querySelectorAll('.recent-search').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-q');
      document.getElementById('searchInput').value = query;
      performSearch(query);
    });
  });
}

// Get recent searches for specific user from localStorage
function getRecentSearches(userId) {
  const key = `tutormatch_recent_searches_${userId}`;
  const searches = localStorage.getItem(key);
  return searches ? JSON.parse(searches) : [];
}

// Save search to recent searches for specific user
function saveRecentSearch(userId, query) {
  if (!query || query.trim().length < 2) return;

  const key = `tutormatch_recent_searches_${userId}`;
  let searches = getRecentSearches(userId);
  
  // Remove if already exists (to move to front)
  searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());
  
  // Add to beginning
  searches.unshift(query.trim());
  
  // Keep only last N searches
  searches = searches.slice(0, MAX_RECENT_SEARCHES);
  
  // Save to localStorage
  localStorage.setItem(key, JSON.stringify(searches));
}

// Clear recent searches for current user
function clearRecentSearches() {
  if (!currentUser) return;
  
  const key = `tutormatch_recent_searches_${currentUser.id}`;
  localStorage.removeItem(key);
  loadRecentSearches(); // Refresh display
}

// Enhanced search functionality
async function performSearch(query) {
  if (!query || query.trim().length < 2) return;

  const trimmedQuery = query.trim();
  
  // Save to recent searches
  if (currentUser) {
    saveRecentSearch(currentUser.id, trimmedQuery);
    loadRecentSearches(); // Refresh recent searches display
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
    const results = await response.json();

    document.getElementById('emptyState').style.display = 'none';
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.classList.remove('hidden');

    document.getElementById('resultsTitle').textContent = 'Search Results';
    document.getElementById('resultsCount').textContent = `${results.length} result${results.length !== 1 ? 's' : ''} found`;

    if (results.length === 0) {
      document.getElementById('resultsGrid').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;">🔍</div>
          <h3 style="color: #000E54; margin-bottom: 8px;">No tutors found</h3>
          <p>Try searching for a different course code, name, or professor.</p>
        </div>
      `;
      return;
    }

    const resultsHTML = results.map(tutor => {
      const avatar = tutor.full_name.charAt(0).toUpperCase();
      const rating = parseFloat(tutor.avg_rating || 0);
      const stars = '⭐'.repeat(Math.max(1, Math.round(rating)));
      const verified = tutor.is_verified ? '<span class="verified-badge">✓ Verified</span>' : '';

      return `
        <div class="tutor-card" onclick="window.location.href='/tutor/${tutor.id}'">
          <div class="tutor-avatar">${avatar}</div>
          <div class="tutor-info">
            <div class="tutor-name">${tutor.full_name}</div>
            <div class="tutor-course">${tutor.course_code} - ${tutor.course_name}</div>
            <div class="tutor-meta">
              <span class="tutor-professor">Prof. ${tutor.professor}</span>
              <span class="tutor-grade">Grade: ${tutor.grade}</span>
            </div>
            <div class="tutor-rating">${stars} (${rating.toFixed(1)})</div>
            <div class="tutor-price">$${tutor.hourly_rate}/hour</div>
            ${verified}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('resultsGrid').innerHTML = resultsHTML;
  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('resultsGrid').innerHTML = `
      <div style="text-align: center; padding: 40px; color: #e74c3c;">
        <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
        <h3 style="margin-bottom: 8px;">Search Error</h3>
        <p>Could not perform search. Please try again.</p>
      </div>
    `;
  }
}

// Search event listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  // Search button click
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) performSearch(query);
  });

  // Enter key in search input
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value.trim();
      if (query) performSearch(query);
    }
  });

  // Add clear searches option (optional)
  const clearButton = document.createElement('button');
  clearButton.textContent = '🗑️ Clear Recent';
  clearButton.className = 'btn-clear-searches';
  clearButton.style.cssText = `
    background: none;
    border: 1px solid #ddd;
    color: #666;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    cursor: pointer;
    margin-left: auto;
    transition: all 0.2s;
  `;
  clearButton.addEventListener('mouseover', () => {
    clearButton.style.backgroundColor = '#f5f5f5';
    clearButton.style.borderColor = '#999';
  });
  clearButton.addEventListener('mouseout', () => {
    clearButton.style.backgroundColor = 'transparent';
    clearButton.style.borderColor = '#ddd';
  });
  clearButton.addEventListener('click', clearRecentSearches);

  // Add clear button to quick chips container when there are recent searches
  const quickChipsContainer = document.querySelector('.quick-chips');
  const observer = new MutationObserver(() => {
    if (quickChipsContainer.children.length > 0 && !quickChipsContainer.querySelector('.btn-clear-searches')) {
      quickChipsContainer.appendChild(clearButton);
    }
  });
  observer.observe(quickChipsContainer, { childList: true });
});

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