// ── My Profile page ──────────────────────────────────────────────────

fetch('/api/profile')
  .then(res => res.json())
  .then(user => {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('navUserName').textContent = user.full_name;
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }
    const page = document.getElementById('profilePage');
    page.classList.remove('hidden');
    if (user.role === 'tutor') {
      page.innerHTML = buildTutorProfile(user);
      initTutorEvents();
    } else {
      page.innerHTML = buildStudentProfile(user);
    }
  })
  .catch(() => window.location.href = '/');

function buildTutorProfile(user) {
  return `
    <div class="profile-header-card">
      <div class="profile-big-avatar">${user.full_name.charAt(0)}</div>
      <div class="profile-header-info">
        <h1>${user.full_name}</h1>
        <p>${user.email}</p>
        <span class="profile-role-badge">📚 Tutor</span>
        ${user.is_verified ? '<span class="verified-tag">✅ Verified</span>' : ''}
      </div>
    </div>
    <div class="profile-section">
      <h2>✏️ Edit Profile</h2>
      <div class="profile-form">
        <div class="input-group">
          <label>Bio</label>
          <textarea id="bioInput" placeholder="Tell students about your experience...">${user.bio || ''}</textarea>
        </div>
        <div class="input-group">
          <label>Hourly Rate ($)</label>
          <input type="number" id="rateInput" value="${parseFloat(user.hourly_rate || 0).toFixed(2)}" min="1" max="500" step="0.50" />
        </div>
        <div>
          <button class="btn-save" id="saveProfileBtn">💾 Save Changes</button>
          <span id="saveFeedback" class="save-feedback hidden"></span>
        </div>
      </div>
    </div>
    <div class="profile-section">
      <h2>📚 My Courses</h2>
      <div id="coursesList" class="courses-manager">
        ${buildCourseRows(user.courses || [])}
      </div>
      <div class="add-course-form">
        <h3>➕ Add a Course</h3>
        <div class="course-form-grid">
          <input type="text" id="newCode" placeholder="e.g. CSE 274" maxlength="20" />
          <input type="text" id="newName" placeholder="e.g. Data Structures" />
        </div>
        <div class="course-form-grid-2">
          <input type="text" id="newProf" placeholder="Professor (optional)" />
          <input type="text" id="newGrade" placeholder="Grade e.g. A, B+" maxlength="5" />
        </div>
        <button class="btn-add-course" id="addCourseBtn">Add Course</button>
        <span id="courseFeedback" class="save-feedback hidden" style="margin-left:10px;"></span>
      </div>
    </div>
  `;
}

function buildCourseRows(courses) {
  if (!courses || courses.length === 0) {
    return '<p style="color:#aaa;font-size:0.9rem;padding:8px 0;">No courses added yet.</p>';
  }
  return courses.map(c => `
    <div class="course-manage-row" id="course-row-${c.id}">
      <span class="course-manage-code">${c.course_code}</span>
      <span class="course-manage-name">${c.course_name}</span>
      <span class="course-manage-meta">${c.professor ? '👨‍🏫 ' + c.professor : ''} ${c.grade ? '· ' + c.grade : ''}</span>
      <button class="btn-delete-course" onclick="deleteCourse(${c.id})">Remove</button>
    </div>
  `).join('');
}

function buildStudentProfile(user) {
  return `
    <div class="profile-header-card">
      <div class="profile-big-avatar">${user.full_name.charAt(0)}</div>
      <div class="profile-header-info">
        <h1>${user.full_name}</h1>
        <p>${user.email}</p>
        <span class="profile-role-badge">🎓 Student</span>
      </div>
    </div>
    <div class="profile-section">
      <h2>📋 My Information</h2>
      <div class="info-grid">
        <div class="info-item"><label>Full Name</label><p>${user.full_name}</p></div>
        <div class="info-item"><label>Email</label><p>${user.email}</p></div>
        <div class="info-item"><label>Role</label><p>🎓 Student</p></div>
        <div class="info-item"><label>University</label><p>${user.university || 'Syracuse University'}</p></div>
      </div>
    </div>
    <div class="profile-section">
      <h2>📅 Quick Links</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="/dashboard" style="padding:10px 20px;background:linear-gradient(135deg,#F76900,#e05e00);color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9rem;">🔍 Find a Tutor</a>
        <a href="/bookings"  style="padding:10px 20px;background:#000E54;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9rem;">📅 My Bookings</a>
      </div>
    </div>
  `;
}

function initTutorEvents() {
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const bio      = document.getElementById('bioInput').value;
    const rate     = document.getElementById('rateInput').value;
    const feedback = document.getElementById('saveFeedback');
    const btn      = document.getElementById('saveProfileBtn');
    btn.textContent = 'Saving...';
    btn.disabled = true;
    feedback.classList.add('hidden');
    try {
      const res  = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, hourly_rate: rate })
      });
      const data = await res.json();
      feedback.textContent = !res.ok ? (data.error || 'Could not save.') : '✅ Profile saved!';
      feedback.className   = `save-feedback ${!res.ok ? 'error' : 'success'}`;
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 3000);
    } catch {
      feedback.textContent = 'Network error.';
      feedback.className   = 'save-feedback error';
      feedback.classList.remove('hidden');
    }
    btn.textContent = '💾 Save Changes';
    btn.disabled = false;
  });

  document.getElementById('addCourseBtn').addEventListener('click', async () => {
    const code     = document.getElementById('newCode').value.trim();
    const name     = document.getElementById('newName').value.trim();
    const prof     = document.getElementById('newProf').value.trim();
    const grade    = document.getElementById('newGrade').value.trim();
    const feedback = document.getElementById('courseFeedback');
    const btn      = document.getElementById('addCourseBtn');

    if (!code || !name) {
      feedback.textContent = 'Course code and name are required.';
      feedback.className   = 'save-feedback error';
      feedback.classList.remove('hidden');
      return;
    }
    btn.textContent = 'Adding...';
    btn.disabled = true;
    try {
      const res  = await fetch('/api/profile/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: code, course_name: name, professor: prof, grade })
      });
      const data = await res.json();
      if (!res.ok) {
        feedback.textContent = data.error || 'Could not add course.';
        feedback.className   = 'save-feedback error';
        feedback.classList.remove('hidden');
      } else {
        const list   = document.getElementById('coursesList');
        const newRow = document.createElement('div');
        newRow.className = 'course-manage-row';
        newRow.id = `course-row-${data.id}`;
        newRow.innerHTML = `
          <span class="course-manage-code">${code.toUpperCase()}</span>
          <span class="course-manage-name">${name}</span>
          <span class="course-manage-meta">${prof ? '👨‍🏫 ' + prof : ''} ${grade ? '· ' + grade : ''}</span>
          <button class="btn-delete-course" onclick="deleteCourse(${data.id})">Remove</button>
        `;
        const empty = list.querySelector('p');
        if (empty) empty.remove();
        list.appendChild(newRow);
        document.getElementById('newCode').value  = '';
        document.getElementById('newName').value  = '';
        document.getElementById('newProf').value  = '';
        document.getElementById('newGrade').value = '';
        feedback.textContent = '✅ Course added!';
        feedback.className   = 'save-feedback success';
        feedback.classList.remove('hidden');
        setTimeout(() => feedback.classList.add('hidden'), 3000);
      }
    } catch {
      feedback.textContent = 'Network error.';
      feedback.className   = 'save-feedback error';
      feedback.classList.remove('hidden');
    }
    btn.textContent = 'Add Course';
    btn.disabled = false;
  });
}

async function deleteCourse(id) {
  if (!confirm('Remove this course from your profile?')) return;
  try {
    const res  = await fetch(`/api/profile/courses/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      const row = document.getElementById(`course-row-${id}`);
      if (row) row.remove();
      const list = document.getElementById('coursesList');
      if (list && list.children.length === 0) {
        list.innerHTML = '<p style="color:#aaa;font-size:0.9rem;padding:8px 0;">No courses added yet.</p>';
      }
    }
  } catch {
    alert('Could not remove course. Please try again.');
  }
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