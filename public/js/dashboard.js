// ── Dashboard — Search with type toggle and course autocomplete ───────────

let currentUser   = null;
let searchType    = 'course'; // 'course' | 'tutor' | 'professor'
let courseCatalog = [];       // loaded once for autocomplete
const MAX_RECENT_SEARCHES = 5;

// ── Bootstrap ─────────────────────────────────────────────────────────────

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

    loadRecentSearches();
  })
  .catch(() => window.location.href = '/');

// Load course catalog for autocomplete
fetch('/api/courses')
  .then(r => r.json())
  .then(data => { courseCatalog = data; })
  .catch(() => { courseCatalog = []; });

// ── Search type toggle ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchBtn   = document.getElementById('searchBtn');

  // Toggle buttons
  document.querySelectorAll('.search-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchType = btn.dataset.type;

      // Update placeholder based on type
      const placeholders = {
        course:    'e.g. CSE 274, Data Structures, Calculus...',
        tutor:     'e.g. Alex Johnson, Maria Garcia...',
        professor: 'e.g. Dr. Wills, Prof. Smith...'
      };
      searchInput.placeholder = placeholders[searchType];

      // Clear input, autocomplete, and results when switching type
      searchInput.value = '';
      clearAutocomplete();
      document.getElementById('resultsSection').classList.add('hidden');
      document.getElementById('emptyState').style.display = 'block';

      searchInput.focus();
    });
  });

  // Search button
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      clearAutocomplete();
      performSearch(query);
    }
  });

  // Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        clearAutocomplete();
        performSearch(query);
      }
    }
    // Navigate autocomplete with arrow keys
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      navigateAutocomplete(e.key);
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      clearAutocomplete();
    }
  });

  // Autocomplete on input — only for course type
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (searchType === 'course' && val.length >= 2) {
      showAutocomplete(val);
    } else {
      clearAutocomplete();
    }
  });

  // Clear searches button setup
  const quickChipsContainer = document.querySelector('.quick-chips');
  const clearButton = document.createElement('button');
  clearButton.textContent = '🗑️ Clear Recent';
  clearButton.className   = 'btn-clear-searches';
  clearButton.addEventListener('click', clearRecentSearches);

  const observer = new MutationObserver(() => {
    if (quickChipsContainer.children.length > 0 && !quickChipsContainer.querySelector('.btn-clear-searches')) {
      quickChipsContainer.appendChild(clearButton);
    }
  });
  observer.observe(quickChipsContainer, { childList: true });

  // Close autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      clearAutocomplete();
    }
  });

  // #12 — Price filter: re-run search when price inputs change
  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');

  function onPriceChange() {
    updatePriceLabel();
    // Only re-search if there's already a query
    const query = document.getElementById('searchInput').value.trim();
    if (query.length >= 2) performSearch(query);
  }

  if (priceMin) priceMin.addEventListener('change', onPriceChange);
  if (priceMax) priceMax.addEventListener('change', onPriceChange);
});

// ── Autocomplete ──────────────────────────────────────────────────────────

function showAutocomplete(query) {
  clearAutocomplete();

  const q = query.toLowerCase();
  const matches = courseCatalog
    .filter(c =>
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q)
    )
    .slice(0, 8); // max 8 suggestions

  if (matches.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.id = 'autocomplete-dropdown';
  dropdown.className = 'autocomplete-dropdown';

  matches.forEach((course, index) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.index = index;

    // Highlight matching text
    const codeHighlighted  = highlightMatch(course.course_code, query);
    const nameHighlighted  = highlightMatch(course.course_name, query);

    item.innerHTML = `
      <span class="autocomplete-code">${codeHighlighted}</span>
      <span class="autocomplete-name">${nameHighlighted}</span>
    `;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent input blur before click
      document.getElementById('searchInput').value = course.course_code;
      clearAutocomplete();
      performSearch(course.course_code);
    });

    dropdown.appendChild(item);
  });

  // Insert dropdown right after the search bar
  const searchBar = document.querySelector('.search-bar');
  searchBar.style.position = 'relative';
  searchBar.appendChild(dropdown);
}

function highlightMatch(text, query) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    text.substring(0, index) +
    `<strong>${text.substring(index, index + query.length)}</strong>` +
    text.substring(index + query.length)
  );
}

function clearAutocomplete() {
  const existing = document.getElementById('autocomplete-dropdown');
  if (existing) existing.remove();
}

function navigateAutocomplete(direction) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) return;

  const items   = dropdown.querySelectorAll('.autocomplete-item');
  const current = dropdown.querySelector('.autocomplete-item.highlighted');
  let nextIndex = 0;

  if (current) {
    const currentIndex = parseInt(current.dataset.index);
    current.classList.remove('highlighted');
    nextIndex = direction === 'ArrowDown'
      ? Math.min(currentIndex + 1, items.length - 1)
      : Math.max(currentIndex - 1, 0);
  } else {
    nextIndex = direction === 'ArrowDown' ? 0 : items.length - 1;
  }

  items[nextIndex].classList.add('highlighted');
  document.getElementById('searchInput').value =
    items[nextIndex].querySelector('.autocomplete-code').textContent;
}

// ── Recent searches ───────────────────────────────────────────────────────

function loadRecentSearches() {
  if (!currentUser) return;

  const recentSearches      = getRecentSearches(currentUser.id);
  const quickChipsContainer = document.querySelector('.quick-chips');

  if (recentSearches.length === 0) {
    quickChipsContainer.style.display = 'none';
    return;
  }

  quickChipsContainer.style.display = 'flex';
  quickChipsContainer.innerHTML = recentSearches
    .map(s => `<span class="chip recent-search" data-q="${s.query}" data-type="${s.type}">${s.query} <span class="chip-type-label">${s.type}</span></span>`)
    .join('');

  quickChipsContainer.querySelectorAll('.recent-search').forEach(chip => {
    chip.addEventListener('click', () => {
      const query    = chip.getAttribute('data-q');
      const type     = chip.getAttribute('data-type') || 'course';

      // Activate the correct toggle button
      document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
      const matchingBtn = document.querySelector(`.search-type-btn[data-type="${type}"]`);
      if (matchingBtn) matchingBtn.classList.add('active');
      searchType = type;

      document.getElementById('searchInput').value = query;
      performSearch(query);
    });
  });
}

function getRecentSearches(userId) {
  const key = `tutormatch_recent_searches_${userId}`;
  try {
    const searches = localStorage.getItem(key);
    if (!searches) return [];
    const parsed = JSON.parse(searches);
    // Filter out any malformed entries (old format or missing fields)
    const valid = parsed.filter(function(s) {
      return s && typeof s === 'object' && typeof s.query === 'string' && s.query.length > 0;
    });
    // If all entries were invalid, clear the key
    if (valid.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(valid));
    }
    return valid;
  } catch {
    localStorage.removeItem(`tutormatch_recent_searches_${userId}`);
    return [];
  }
}

function saveRecentSearch(userId, query, type) {
  if (!query || query.trim().length < 2) return;

  const key = `tutormatch_recent_searches_${userId}`;
  let searches = getRecentSearches(userId);

  // Remove duplicate
  searches = searches.filter(s => !(s.query.toLowerCase() === query.toLowerCase() && s.type === type));

  // Add to front
  searches.unshift({ query: query.trim(), type });

  // Keep max 5
  searches = searches.slice(0, MAX_RECENT_SEARCHES);

  localStorage.setItem(key, JSON.stringify(searches));
}

function clearRecentSearches() {
  if (!currentUser) return;
  const key = `tutormatch_recent_searches_${currentUser.id}`;
  localStorage.removeItem(key);
  loadRecentSearches();
}

// ── #12 Price filter helpers ─────────────────────────────────────────────

function getPriceParams() {
  const minVal = document.getElementById('priceMin')?.value;
  const maxVal = document.getElementById('priceMax')?.value;
  const min = minVal && minVal !== '' ? (parseFloat(minVal) || 0) : 0;
  const max = maxVal && maxVal !== '' ? (parseFloat(maxVal) || 0) : 0;
  return { min, max };
}

function updatePriceLabel() {
  const { min, max } = getPriceParams();
  const label  = document.getElementById('priceRangeLabel');
  const clearBtn = document.getElementById('btnClearPrice');
  if (!label) return;

  if (!min && !max) {
    label.textContent = 'Any price';
    label.style.color = '#aaa';
    if (clearBtn) clearBtn.classList.add('hidden');
  } else if (min && !max) {
    label.textContent = 'From $' + min + '/hr';
    label.style.color = '#F76900';
    if (clearBtn) clearBtn.classList.remove('hidden');
  } else if (!min && max) {
    label.textContent = 'Up to $' + max + '/hr';
    label.style.color = '#F76900';
    if (clearBtn) clearBtn.classList.remove('hidden');
  } else {
    label.textContent = '$' + min + ' – $' + max + '/hr';
    label.style.color = '#F76900';
    if (clearBtn) clearBtn.classList.remove('hidden');
  }

  // Highlight active quick-select button
  document.querySelectorAll('.price-quick-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
}

function setPriceRange(min, max) {
  const minInput = document.getElementById('priceMin');
  const maxInput = document.getElementById('priceMax');
  if (minInput) minInput.value = min || '';
  if (maxInput) maxInput.value = max >= 999 ? '' : max;

  // Highlight the clicked button
  document.querySelectorAll('.price-quick-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  updatePriceLabel();

  // Re-run search if there's already a query
  const query = document.getElementById('searchInput').value.trim();
  if (query.length >= 2) performSearch(query);
}

function clearPriceFilter() {
  const minInput = document.getElementById('priceMin');
  const maxInput = document.getElementById('priceMax');
  if (minInput) minInput.value = '';
  if (maxInput) maxInput.value = '';
  document.querySelectorAll('.price-quick-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  updatePriceLabel();

  const query = document.getElementById('searchInput').value.trim();
  if (query.length >= 2) performSearch(query);
}

// ── Search ────────────────────────────────────────────────────────────────

async function performSearch(query) {
  if (!query || query.trim().length < 2) return;

  const trimmedQuery = query.trim();

  if (currentUser) {
    saveRecentSearch(currentUser.id, trimmedQuery, searchType);
    loadRecentSearches();
  }

  try {
    // Pass the search type to the API
    // #12 — Include price filter in search
    const { min, max } = getPriceParams();
    let url = `/api/search?q=${encodeURIComponent(trimmedQuery)}&type=${searchType}`;
    if (min) url += '&min=' + min;
    if (max) url += '&max=' + max;

    const response = await fetch(url);
    const results  = await response.json();

    document.getElementById('emptyState').style.display = 'none';
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.classList.remove('hidden');

    const typeLabels = {
      course:    'course',
      tutor:     'tutor name',
      professor: 'professor'
    };

    document.getElementById('resultsTitle').textContent =
      `Results for "${trimmedQuery}" by ${typeLabels[searchType]}`;
    document.getElementById('resultsCount').textContent =
      `${results.length} result${results.length !== 1 ? 's' : ''} found`;

    if (results.length === 0) {
      document.getElementById('resultsGrid').innerHTML = `
        <div style="text-align:center;padding:40px;color:#666;grid-column:1/-1;">
          <div style="font-size:3rem;margin-bottom:16px;opacity:0.5;">🔍</div>
          <h3 style="color:#000E54;margin-bottom:8px;">No tutors found</h3>
          <p>Try a different search or switch the search type above.</p>
        </div>
      `;
      return;
    }

    document.getElementById('resultsGrid').innerHTML = results.map(tutor => {
      const rating   = parseFloat(tutor.avg_rating || 0);
      const stars    = rating > 0 ? '⭐'.repeat(Math.max(1, Math.round(rating))) : '';
      const verified = tutor.is_verified ? '<span class="verified-badge">✓ Verified</span>' : '';
      // Avatar: photo if available, else colored initial
      const avatarContent = typeof getAvatarHTML === 'function'
        ? getAvatarHTML(tutor)
        : tutor.full_name.charAt(0).toUpperCase();
      const avatarStyle = !tutor.avatar_url && typeof getAvatarStyle === 'function'
        ? getAvatarStyle(tutor.id) : '';

      return `
        <div class="tutor-card" onclick="window.location.href='/tutor/${tutor.id}'">
          <div class="tutor-avatar" style="${avatarStyle}">${avatarContent}</div>
          <div class="tutor-info">
            <div class="tutor-name">${tutor.full_name}</div>
            <div class="tutor-course">${tutor.course_code} — ${tutor.course_name}</div>
            <div class="tutor-meta">
              <span class="tutor-professor">👨‍🏫 Prof. ${tutor.professor}</span>
              <span class="tutor-grade">Grade: ${tutor.grade}</span>
            </div>
            ${rating > 0 ? `<div class="tutor-rating">${stars} (${rating.toFixed(1)})</div>` : ''}
            <div class="tutor-price">$${parseFloat(tutor.hourly_rate).toFixed(2)}/hour</div>
            ${verified}
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('resultsGrid').innerHTML = `
      <div style="text-align:center;padding:40px;color:#e74c3c;grid-column:1/-1;">
        <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
        <h3 style="margin-bottom:8px;">Search Error</h3>
        <p>Could not perform search. Please try again.</p>
      </div>
    `;
  }
}

// ── Notification badge ────────────────────────────────────────────────────

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
    .catch(() => {});
}

loadNotifBadge();
setInterval(loadNotifBadge, 30000);