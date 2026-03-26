// ── Profile Page ──────────────────────────────────────────────────────────

let userProfile   = null;
let courseCatalog = [];
let professors    = [];
let userCourses   = [];
let userResources = [];
let selectedResourceType = 'link';

document.addEventListener('DOMContentLoaded', async function () {
  await loadUserProfile();
  await loadCourseCatalog();
  await loadProfessors();
  displayProfile();
  if (userProfile && userProfile.role === 'tutor') {
    await loadResources();
  }
});

async function loadUserProfile() {
  try {
    const response = await fetch('/api/profile');
    if (response.ok) {
      userProfile = await response.json();
      userCourses = userProfile.courses || [];
    }
  } catch (error) { console.error('Error loading profile:', error); }
}

async function loadCourseCatalog() {
  try {
    const response = await fetch('/api/courses');
    if (response.ok) courseCatalog = await response.json();
  } catch (error) { console.error('Error loading courses:', error); }
}

async function loadProfessors() {
  try {
    const response = await fetch('/api/professors');
    if (response.ok) professors = await response.json();
  } catch (error) { console.error('Error loading professors:', error); }
}

async function loadResources() {
  try {
    const response = await fetch('/api/tutors/' + userProfile.id + '/resources');
    if (response.ok) {
      userResources = await response.json();
      displayResources();
    }
  } catch (error) { console.error('Error loading resources:', error); }
}

function displayProfile() {
  if (!userProfile) return;

  document.getElementById('profileName').textContent       = userProfile.full_name;
  document.getElementById('profileEmail').textContent      = userProfile.email;
  document.getElementById('profileRole').textContent       = userProfile.role;
  document.getElementById('profileUniversity').textContent = userProfile.university || 'Syracuse University';

  // Set avatar — photo if available, else colored initial
  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) {
    const initial = userProfile.full_name.charAt(0).toUpperCase();
    if (userProfile.avatar_url) {
      avatarEl.innerHTML = '<img src="' + userProfile.avatar_url + '" alt="' + userProfile.full_name + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
      avatarEl.style.background = 'transparent';
      avatarEl.style.padding    = '0';
      const actionsEl = document.getElementById('avatarActions');
      if (actionsEl) actionsEl.style.display = 'block';
    } else {
      avatarEl.textContent = initial;
      if (typeof getAvatarStyle === 'function') {
        avatarEl.style.cssText += ';' + getAvatarStyle(userProfile.id);
      }
    }
  }

  const navUser = document.getElementById('navUser');
  const navRole = document.getElementById('navRole');
  if (navUser) navUser.textContent = userProfile.full_name;
  if (navRole) navRole.textContent = userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1);

  // #9 — Pre-fill account info fields for both roles
  const editName  = document.getElementById('editFullName');
  const editEmail = document.getElementById('editEmail');
  if (editName)  editName.value  = userProfile.full_name;
  if (editEmail) editEmail.value = userProfile.email;

  if (userProfile.role === 'tutor') {
    document.getElementById('studentSection').style.display = 'none';
    document.getElementById('tutorSections').style.display  = 'block';

    const tutorDashLink = document.getElementById('tutorDashboardLink');
    if (tutorDashLink) tutorDashLink.style.display = 'flex';

    if (userProfile.is_verified) {
      const verifiedTag = document.getElementById('verifiedTag');
      if (verifiedTag) verifiedTag.style.display = 'inline-block';
    }

    document.getElementById('bioTextarea').value     = userProfile.bio || '';
    document.getElementById('hourlyRateInput').value = userProfile.hourly_rate || '';

    displayUserCourses();
    setupAddCourseForm();
    updateResourceFormForType('link');
  } else {
    document.getElementById('studentSection').style.display = 'block';
    document.getElementById('tutorSections').style.display  = 'none';

    document.getElementById('studentName').textContent       = userProfile.full_name;
    document.getElementById('studentEmail').textContent      = userProfile.email;
    document.getElementById('studentUniversity').textContent = userProfile.university || 'Syracuse University';
    document.getElementById('studentRole').textContent       = 'Student';
  }
}

// ── Courses ───────────────────────────────────────────────────────────────

function displayUserCourses() {
  const container = document.getElementById('userCourses');
  if (userCourses.length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">No courses added yet</p>';
    return;
  }
  container.innerHTML = userCourses.map(function(course) {
    const prof  = course.professor ? 'Prof. ' + course.professor : '';
    const grade = course.grade     ? 'Grade: ' + course.grade    : '';
    const sep   = prof && grade    ? ' • '                        : '';
    return '<div class="course-manage-row" id="course-row-' + course.id + '">'
      + '<div class="course-manage-code">' + course.course_code + '</div>'
      + '<div class="course-manage-name">' + course.course_name + '</div>'
      + '<div class="course-manage-meta">' + prof + sep + grade + '</div>'
      + '<div class="course-manage-actions">'
      + '<button class="btn-add-resource-to-course" onclick="addResourceToCourse(' + course.id + ')">📎 Add Resource</button>'
      + '<button class="btn-delete-course" onclick="deleteCourse(' + course.id + ')">Delete</button>'
      + '</div>'
      + '</div>'
      // Inline resource form — hidden by default
      + '<div class="course-resource-form hidden" id="course-resource-form-' + course.id + '">'
      + '<div class="course-resource-form-inner">'
      + '<div style="font-size:0.82rem;font-weight:700;color:#000E54;margin-bottom:10px;">📎 Add resource to ' + course.course_code + '</div>'
      + '<div class="course-resource-row">'
      + '<input type="text" id="crf-title-' + course.id + '" placeholder="Title *" class="crf-input">'
      + '<select id="crf-type-' + course.id + '" class="crf-select" onchange="onCrfTypeChange(' + course.id + ')">'
      + '<option value="link">🔗 Link</option>'
      + '<option value="note">📝 Note</option>'
      + '<option value="file">📄 File Link</option>'
      + '<option value="upload">⬆️ Upload File</option>'
      + '</select>'
      + '</div>'
      + '<div id="crf-url-group-' + course.id + '">'
      + '<input type="url" id="crf-url-' + course.id + '" placeholder="URL (https://...)" class="crf-input" style="margin-top:6px;">'
      + '</div>'
      + '<div id="crf-file-group-' + course.id + '" class="hidden">'
      + '<div class="crf-file-drop" onclick="document.getElementById(&quot;crf-file-' + course.id + '&quot;).click()">'
      + '<span>📎 Click to choose file</span>'
      + '<span style="font-size:0.72rem;color:#aaa;display:block;margin-top:2px;">PDF · Word · PowerPoint · Excel · JPG · PNG — max 20 MB</span>'
      + '<span class="crf-file-name hidden" id="crf-file-name-' + course.id + '"></span>'
      + '</div>'
      + '<input type="file" id="crf-file-' + course.id + '" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png" style="display:none;" onchange="onCrfFileSelected(this,' + course.id + ')">'
      + '</div>'
      + '<textarea id="crf-desc-' + course.id + '" placeholder="Description (optional)" class="crf-textarea"></textarea>'
      + '<div class="crf-actions">'
      + '<button class="btn-add-course" onclick="saveCourseResource(' + course.id + ')" id="crf-save-' + course.id + '">Add Resource</button>'
      + '<button class="crf-cancel" onclick="closeCourseResourceForm(' + course.id + ')">Cancel</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function setupAddCourseForm() {
  const courseCodeSelect = document.getElementById('courseCodeSelect');
  courseCodeSelect.innerHTML = '<option value="">Select Course Code</option>';
  courseCatalog.forEach(course => {
    courseCodeSelect.innerHTML += '<option value="' + course.course_code + '" data-name="' + course.course_name + '">' + course.course_code + ' — ' + course.course_name + '</option>';
  });

  const professorSelect = document.getElementById('professorSelect');
  professorSelect.innerHTML = '<option value="">Select Professor (Optional)</option>';
  professors.forEach(prof => {
    professorSelect.innerHTML += '<option value="' + prof.name + '">' + prof.name + '</option>';
  });

  const gradeSelect = document.getElementById('gradeSelect');
  gradeSelect.innerHTML = `
    <option value="">Select Grade (Optional)</option>
    <option value="A+">A+ (97-100%)</option><option value="A">A (93-96%)</option>
    <option value="A-">A- (90-92%)</option><option value="B+">B+ (87-89%)</option>
    <option value="B">B (83-86%)</option><option value="B-">B- (80-82%)</option>
    <option value="C+">C+ (77-79%)</option><option value="C">C (73-76%)</option>
    <option value="C-">C- (70-72%)</option><option value="D">D (65-66%)</option>
    <option value="F">F (Below 65%)</option><option value="P">P (Pass)</option>
  `;

  courseCodeSelect.addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    document.getElementById('courseNameInput').value = selectedOption.getAttribute('data-name') || '';
  });

  // Populate the "Associate with course" dropdown in the resources form
  populateResourceCourseSelect();
}

function populateResourceCourseSelect() {
  const select = document.getElementById('resourceCourseSelect');
  if (!select) return;
  select.innerHTML = '<option value="">— No specific course —</option>';
  userCourses.forEach(function(course) {
    select.innerHTML += '<option value="' + course.id + '">' + course.course_code + ' — ' + course.course_name + '</option>';
  });
}

async function saveTutorProfile() {
  const bio        = document.getElementById('bioTextarea').value;
  const hourlyRate = document.getElementById('hourlyRateInput').value;

  if (!hourlyRate || isNaN(hourlyRate) || parseFloat(hourlyRate) < 1) {
    showFeedback('Please enter a valid hourly rate.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, hourly_rate: parseFloat(hourlyRate) })
    });
    if (response.ok) {
      showFeedback('Profile updated successfully!', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not update profile', 'error');
    }
  } catch { showFeedback('Network error. Please try again.', 'error'); }
}

async function addCourse() {
  const courseCode = document.getElementById('courseCodeSelect').value;
  const courseName = document.getElementById('courseNameInput').value;
  const professor  = document.getElementById('professorSelect').value;
  const grade      = document.getElementById('gradeSelect').value;

  if (!courseCode || !courseName) { showFeedback('Please select a course code.', 'error'); return; }
  if (userCourses.some(c => c.course_code === courseCode)) { showFeedback('You already added this course.', 'error'); return; }

  try {
    const response = await fetch('/api/profile/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_code: courseCode, course_name: courseName, professor: professor || '', grade: grade || '' })
    });
    if (response.ok) {
      const result = await response.json();
      userCourses.push({ id: result.id, course_code: courseCode, course_name: courseName, professor: professor || '', grade: grade || '' });
      displayUserCourses();
      document.getElementById('courseCodeSelect').value = '';
      document.getElementById('courseNameInput').value  = '';
      document.getElementById('professorSelect').value  = '';
      document.getElementById('gradeSelect').value      = '';
      showFeedback('Course added successfully!', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not add course', 'error');
    }
  } catch { showFeedback('Network error. Please try again.', 'error'); }
}

async function deleteCourse(courseId) {
  if (!confirm('Are you sure you want to remove this course?')) return;
  try {
    const response = await fetch('/api/profile/courses/' + courseId, { method: 'DELETE' });
    if (response.ok) {
      userCourses = userCourses.filter(c => c.id !== courseId);
      displayUserCourses();
      showFeedback('Course removed.', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not remove course', 'error');
    }
  } catch { showFeedback('Network error. Please try again.', 'error'); }
}

// ── Resources ─────────────────────────────────────────────────────────────

const resourceTypeIcons  = { link: '🔗', note: '📝', file: '📄' };
const resourceTypeLabels = { link: 'Link', note: 'Note', file: 'File' };

function selectResourceType(type) {
  selectedResourceType = type;
  document.querySelectorAll('.resource-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  updateResourceFormForType(type);
}

function updateResourceFormForType(type) {
  const urlGroup  = document.getElementById('resourceUrlGroup');
  const urlLabel  = document.getElementById('resourceUrlLabel');
  const urlInput  = document.getElementById('resourceUrl');
  const fileGroup = document.getElementById('resourceFileGroup');
  if (!urlGroup) return;

  // Reset all
  urlGroup.style.display  = 'none';
  if (fileGroup) fileGroup.style.display = 'none';
  urlInput.value = '';
  urlInput.removeAttribute('required');

  if (type === 'note') {
    // No URL or file needed
  } else if (type === 'upload') {
    // Show file upload area
    if (fileGroup) fileGroup.style.display = 'block';
  } else {
    // link or file-link
    urlGroup.style.display = 'block';
    urlInput.setAttribute('required', 'true');
    urlLabel.textContent = type === 'file'
      ? 'File URL * (Google Drive, Dropbox, OneDrive...)'
      : 'URL *';
    urlInput.placeholder = type === 'file'
      ? 'https://drive.google.com/file/...'
      : 'https://drive.google.com/...';
  }
}

// Handle file selected in main resources form
function onFileSelected(input) {
  const file        = input.files[0];
  const selectedEl  = document.getElementById('fileSelected');
  const uploadText  = document.querySelector('#fileUploadArea .file-upload-text');
  if (!file) return;
  if (selectedEl) {
    selectedEl.textContent = '✅ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
    selectedEl.classList.remove('hidden');
  }
  if (uploadText) uploadText.textContent = 'File ready to upload';
}

function displayResources() {
  const container = document.getElementById('resourcesList');
  if (!container) return;

  if (!userResources || userResources.length === 0) {
    container.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;font-size:0.88rem;">No resources added yet.</p>';
    return;
  }

  container.innerHTML = userResources.map(r => `
    <div class="resource-manage-row" id="resource-${r.id}">
      <div class="resource-manage-icon">${resourceTypeIcons[r.type] || '📎'}</div>
      <div class="resource-manage-info">
        <div class="resource-manage-title">
          ${r.url ? '<a href="' + r.url + '" target="_blank" rel="noopener noreferrer">' + r.title + '</a>' : r.title}
          <span class="resource-type-tag">${resourceTypeLabels[r.type] || r.type}</span>
          ${r.course_id ? '<span class="resource-course-tag">' + (userCourses.find(function(c){return c.id == r.course_id;})?.course_code || '') + '</span>' : ''}
        </div>
        ${r.description ? '<div class="resource-manage-desc">' + r.description + '</div>' : ''}
        ${r.url ? '<div class="resource-manage-url">' + r.url + '</div>' : ''}
      </div>
      <button class="btn-delete-course" onclick="deleteResource(${r.id})">Delete</button>
    </div>
  `).join('');
}

async function addResource() {
  const title       = document.getElementById('resourceTitle').value.trim();
  const url         = document.getElementById('resourceUrl').value.trim();
  const description = document.getElementById('resourceDescription').value.trim();
  const type        = selectedResourceType;
  const courseId    = document.getElementById('resourceCourseSelect')?.value || null;

  if (!title) { showFeedback('Please enter a title.', 'error'); return; }

  const btn = document.getElementById('btnAddResource');
  btn.disabled = true; btn.textContent = 'Adding...';

  try {
    let response, result;

    if (type === 'upload') {
      // Handle file upload
      const fileInput = document.getElementById('resourceFile');
      if (!fileInput || !fileInput.files[0]) {
        showFeedback('Please choose a file to upload.', 'error');
        btn.disabled = false; btn.textContent = 'Add Resource';
        return;
      }
      const formData = new FormData();
      formData.append('file',        fileInput.files[0]);
      formData.append('title',       title);
      formData.append('description', description);
      if (courseId) formData.append('course_id', courseId);

      btn.textContent = 'Uploading...';
      response = await fetch('/api/profile/resources/upload', { method: 'POST', body: formData });
    } else {
      if (type !== 'note' && !url) { showFeedback('Please enter a URL.', 'error'); btn.disabled = false; btn.textContent = 'Add Resource'; return; }
      if (type !== 'note' && url && !isValidUrl(url)) { showFeedback('Please enter a valid URL (https://...).', 'error'); btn.disabled = false; btn.textContent = 'Add Resource'; return; }

      response = await fetch('/api/profile/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, url: url || null, description: description || null, course_id: courseId || null })
      });
    }

    result = await response.json();

    if (response.ok) {
      userResources.unshift({
        id: result.id, title,
        type: type === 'upload' ? 'file' : type,
        url: result.url || url || null,
        description: description || null,
        course_id: courseId || null,
        is_local_file: type === 'upload'
      });
      displayResources();
      // Reset form
      document.getElementById('resourceTitle').value       = '';
      document.getElementById('resourceUrl').value         = '';
      document.getElementById('resourceDescription').value = '';
      const fileInput = document.getElementById('resourceFile');
      if (fileInput) fileInput.value = '';
      const fileSelected = document.getElementById('fileSelected');
      if (fileSelected) { fileSelected.textContent = ''; fileSelected.classList.add('hidden'); }
      const uploadText = document.querySelector('#fileUploadArea .file-upload-text');
      if (uploadText) uploadText.textContent = 'Click to choose a file or drag & drop here';
      showFeedback(type === 'upload' ? 'File uploaded successfully!' : 'Resource added!', 'success');
    } else {
      showFeedback(result.error || 'Could not add resource.', 'error');
    }
  } catch (err) {
    console.error(err);
    showFeedback('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Add Resource';
  }
}

async function deleteResource(resourceId) {
  if (!confirm('Delete this resource?')) return;
  try {
    const response = await fetch('/api/profile/resources/' + resourceId, { method: 'DELETE' });
    if (response.ok) {
      userResources = userResources.filter(r => r.id !== resourceId);
      displayResources();
      showFeedback('Resource deleted.', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not delete resource.', 'error');
    }
  } catch { showFeedback('Network error. Please try again.', 'error'); }
}

function isValidUrl(string) {
  try { const url = new URL(string); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}

// ── #9 Save basic account info ───────────────────────────────────────────

async function saveBasicInfo() {
  const full_name = document.getElementById('editFullName').value.trim();
  const email     = document.getElementById('editEmail').value.trim().toLowerCase();

  if (!full_name || full_name.length < 2) {
    showFeedback('Please enter a valid full name.', 'error');
    return;
  }
  if (!email.endsWith('.edu')) {
    showFeedback('Only university (.edu) emails are accepted.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/profile/basic', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name, email })
    });

    const data = await response.json();

    if (response.ok) {
      // Update all visible name/email elements on the page
      document.getElementById('profileName').textContent = full_name;
      const navUser = document.getElementById('navUser');
      if (navUser) navUser.textContent = full_name;

      // Update local profile object
      if (userProfile) {
        userProfile.full_name = full_name;
        userProfile.email     = email;
      }

      // Update student info section if visible
      const studentName  = document.getElementById('studentName');
      const studentEmail = document.getElementById('studentEmail');
      if (studentName)  studentName.textContent  = full_name;
      if (studentEmail) studentEmail.textContent = email;

      showFeedback('Account info updated successfully!', 'success');
    } else {
      showFeedback(data.error || 'Could not update account info.', 'error');
    }
  } catch {
    showFeedback('Network error. Please try again.', 'error');
  }
}

// ── Course resource inline form ──────────────────────────────────────────

function addResourceToCourse(courseId) {
  // Close any other open forms first
  document.querySelectorAll('.course-resource-form').forEach(function(f) {
    if (f.id !== 'course-resource-form-' + courseId) {
      f.classList.add('hidden');
    }
  });
  const form = document.getElementById('course-resource-form-' + courseId);
  if (form) form.classList.toggle('hidden');
}

function closeCourseResourceForm(courseId) {
  const form = document.getElementById('course-resource-form-' + courseId);
  if (form) form.classList.add('hidden');
}

function onCrfTypeChange(courseId) {
  const type      = document.getElementById('crf-type-' + courseId).value;
  const urlGroup  = document.getElementById('crf-url-group-' + courseId);
  const fileGroup = document.getElementById('crf-file-group-' + courseId);
  if (urlGroup)  urlGroup.style.display  = (type === 'upload' || type === 'note') ? 'none' : 'block';
  if (fileGroup) fileGroup.style.display = type === 'upload' ? 'block' : 'none';
}

function onCrfFileSelected(input, courseId) {
  const file    = input.files[0];
  const nameEl  = document.getElementById('crf-file-name-' + courseId);
  if (file && nameEl) {
    nameEl.textContent = '✅ ' + file.name;
    nameEl.classList.remove('hidden');
  }
}

async function saveCourseResource(courseId) {
  const title       = document.getElementById('crf-title-' + courseId).value.trim();
  const type        = document.getElementById('crf-type-' + courseId).value;
  const url         = document.getElementById('crf-url-' + courseId)?.value.trim() || '';
  const description = document.getElementById('crf-desc-' + courseId).value.trim();
  const saveBtn     = document.getElementById('crf-save-' + courseId);

  if (!title) { showFeedback('Please enter a title.', 'error'); return; }
  if (type !== 'note' && type !== 'upload' && !url) { showFeedback('Please enter a URL.', 'error'); return; }
  if (type !== 'note' && type !== 'upload' && url && !isValidUrl(url)) { showFeedback('Please enter a valid URL.', 'error'); return; }

  saveBtn.disabled  = true;
  saveBtn.textContent = 'Saving...';

  try {
    let response, result;

    if (type === 'upload') {
      const fileInput = document.getElementById('crf-file-' + courseId);
      if (!fileInput || !fileInput.files[0]) {
        showFeedback('Please choose a file.', 'error');
        saveBtn.disabled = false; saveBtn.textContent = 'Add Resource';
        return;
      }
      const formData = new FormData();
      formData.append('file',        fileInput.files[0]);
      formData.append('title',       title);
      formData.append('description', description);
      formData.append('course_id',   courseId);
      saveBtn.textContent = 'Uploading...';
      response = await fetch('/api/profile/resources/upload', { method: 'POST', body: formData });
    } else {
      response = await fetch('/api/profile/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, url: url || null, description: description || null, course_id: courseId })
      });
    }

    result = await response.json();

    if (response.ok) {
      userResources.unshift({
        id: result.id, title,
        type: type === 'upload' ? 'file' : type,
        url: result.url || url || null,
        description: description || null,
        course_id: courseId,
        is_local_file: type === 'upload'
      });
      displayResources();
      closeCourseResourceForm(courseId);
      showFeedback('Resource added to ' + (userCourses.find(function(c) { return c.id === courseId; })?.course_code || 'course') + '!', 'success');
    } else {
      showFeedback(result.error || 'Could not add resource.', 'error');
    }
  } catch (err) {
    console.error(err);
    showFeedback('Network error. Please try again.', 'error');
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Add Resource';
  }
}

// ── Avatar upload ─────────────────────────────────────────────────────────

async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;

  // Client-side size check
  if (file.size > 5 * 1024 * 1024) {
    showFeedback('Image must be under 5 MB.', 'error');
    input.value = '';
    return;
  }

  // Show preview immediately while uploading
  const avatarEl = document.getElementById('profileAvatar');
  const reader   = new FileReader();
  reader.onload  = function(e) {
    avatarEl.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
    avatarEl.style.background = 'transparent';
    avatarEl.style.padding    = '0';
  };
  reader.readAsDataURL(file);

  showFeedback('Uploading photo...', 'info');

  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
    const data     = await response.json();

    if (response.ok) {
      // Update navbar avatar too
      updateNavAvatar(data.avatar_url);
      const actionsEl = document.getElementById('avatarActions');
      if (actionsEl) actionsEl.style.display = 'block';
      if (userProfile) userProfile.avatar_url = data.avatar_url;
      showFeedback('Photo updated successfully!', 'success');
    } else {
      showFeedback(data.error || 'Could not upload photo.', 'error');
      // Revert preview
      displayProfile();
    }
  } catch {
    showFeedback('Network error. Please try again.', 'error');
    displayProfile();
  }

  input.value = '';
}

async function removeAvatar() {
  if (!confirm('Remove your profile photo?')) return;

  try {
    const response = await fetch('/api/profile/avatar', { method: 'DELETE' });
    if (response.ok) {
      if (userProfile) userProfile.avatar_url = null;
      // Reset avatar to colored initial
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) {
        avatarEl.innerHTML = userProfile ? userProfile.full_name.charAt(0).toUpperCase() : 'U';
        avatarEl.style.background = '';
        avatarEl.style.padding    = '';
        if (typeof getAvatarStyle === 'function' && userProfile) {
          avatarEl.style.cssText += ';' + getAvatarStyle(userProfile.id);
        }
      }
      updateNavAvatar(null);
      const actionsEl = document.getElementById('avatarActions');
      if (actionsEl) actionsEl.style.display = 'none';
      showFeedback('Photo removed.', 'success');
    }
  } catch {
    showFeedback('Network error. Please try again.', 'error');
  }
}

function updateNavAvatar(avatarUrl) {
  // Update navbar user display if it exists
  const navUser = document.getElementById('navUser');
  if (!navUser) return;
  // Nothing to show in text nav — but if we ever add nav avatar img, update here
}

// ── Feedback toast ────────────────────────────────────────────────────────

function showFeedback(message, type = 'info') {
  let feedback = document.getElementById('feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'feedback';
    feedback.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:10000;box-shadow:0 6px 20px rgba(0,0,0,0.2);transition:all 0.3s ease;max-width:320px;';
    document.body.appendChild(feedback);
  }
  feedback.textContent = message;
  feedback.style.background = type === 'success' ? 'linear-gradient(135deg,#00d4aa,#00b894)' : type === 'error' ? 'linear-gradient(135deg,#e74c3c,#c0392b)' : 'linear-gradient(135deg,#F76900,#e05e00)';
  feedback.style.color   = 'white';
  feedback.style.display = 'block';
  feedback.style.opacity = '1';
  setTimeout(() => {
    if (feedback) { feedback.style.opacity = '0'; setTimeout(() => { if (feedback && feedback.parentNode) feedback.parentNode.removeChild(feedback); }, 300); }
  }, 3000);
}