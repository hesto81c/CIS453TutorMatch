// ── Dashboard page ───────────────────────────────────────────────────

fetch('/api/me')
  .then(res => res.json())
  .then(user => {
    document.getElementById('navUserName').textContent = user.full_name;
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }
  })
  .catch(() => window.location.href = '/');

const searchInput = document.getElementById('searchInput');
const searchBtn   = document.getElementById('searchBtn');

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    searchInput.value = chip.dataset.q;
    doSearch();
  });
});

async function doSearch() {
  const q = searchInput.value.trim();
  if (q.length < 2) return;

  searchBtn.textContent = 'Searching...';
  searchBtn.disabled = true;

  try {
    const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');

    const title = document.getElementById('resultsTitle');
    const count = document.getElementById('resultsCount');
    const grid  = document.getElementById('resultsGrid');

    title.textContent = `Results for "${q}"`;

    const unique = [];
    const seen   = new Set();
    data.forEach(t => {
      if (!seen.has(t.id)) { seen.add(t.id); unique.push(t); }
    });

    count.textContent = `${unique.length} tutor${unique.length !== 1 ? 's' : ''} found`;

    if (unique.length === 0) {
      grid.innerHTML = `<div class="no-results">No tutors found for "<strong>${q}</strong>". Try a different search.</div>`;
    } else {
      grid.innerHTML = unique.map(t => `
        <div class="tutor-card" onclick="window.location.href='/tutor/${t.id}'">
          <div class="tutor-card-header">
            <div class="tutor-avatar">${t.full_name.charAt(0)}</div>
            <div class="tutor-card-info">
              <h3>${t.full_name}</h3>
              <div class="tutor-meta">
                ${t.is_verified ? '<span class="verified-badge">✅ Verified</span>' : ''}
                ${parseFloat(t.avg_rating) > 0
                  ? `<span class="rating">⭐ ${parseFloat(t.avg_rating).toFixed(1)}</span>`
                  : '<span style="font-size:0.78rem;color:#aaa;">No reviews yet</span>'}
              </div>
            </div>
          </div>
          <span class="course-tag">${t.course_code}</span>
          <div class="professor-tag">👨‍🏫 ${t.professor || '—'} · Grade earned: <strong>${t.grade || '—'}</strong></div>
          <div class="tutor-card-footer">
            <div class="rate">$${parseFloat(t.hourly_rate).toFixed(2)} <span>/ hour</span></div>
            <button class="btn-view">View Profile →</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Search error:', err);
  }

  searchBtn.textContent = 'Search';
  searchBtn.disabled = false;
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