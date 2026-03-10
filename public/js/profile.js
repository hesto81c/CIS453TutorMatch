let userProfile = null;
let courseCatalog = [];
let professors = [];
let userCourses = [];

document.addEventListener('DOMContentLoaded', async function() {
  await loadUserProfile();
  await loadCourseCatalog();
  await loadProfessors();
  displayProfile();
});

async function loadUserProfile() {
  try {
    const response = await fetch('/api/profile');
    if (response.ok) {
      userProfile = await response.json();
      userCourses = userProfile.courses || [];
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

async function loadCourseCatalog() {
  try {
    const response = await fetch('/api/courses');
    if (response.ok) {
      courseCatalog = await response.json();
    }
  } catch (error) {
    console.error('Error loading courses:', error);
  }
}

async function loadProfessors() {
  try {
    const response = await fetch('/api/professors');
    if (response.ok) {
      professors = await response.json();
    }
  } catch (error) {
    console.error('Error loading professors:', error);
  }
}

function displayProfile() {
  if (!userProfile) return;

  // Profile header
  document.getElementById('profileName').textContent = userProfile.full_name;
  document.getElementById('profileEmail').textContent = userProfile.email;
  document.getElementById('profileRole').textContent = userProfile.role;
  document.getElementById('profileUniversity').textContent = userProfile.university || 'Syracuse University';

  if (userProfile.role === 'tutor') {
    // HIDE student section for tutors
    document.getElementById('studentSection').style.display = 'none';
    
    document.getElementById('tutorSections').style.display = 'block';
    
    const tutorDashLink = document.getElementById('tutorDashboardLink');
    if (tutorDashLink) tutorDashLink.style.display = 'flex';
    
    // Fill tutor profile form
    document.getElementById('bioTextarea').value = userProfile.bio || '';
    document.getElementById('hourlyRateInput').value = userProfile.hourly_rate || '';

    // Display existing courses
    displayUserCourses();
    
    // Setup add course form with dropdowns
    setupAddCourseForm();
  } else {
    // SHOW student section for students
    document.getElementById('studentSection').style.display = 'block';
    document.getElementById('tutorSections').style.display = 'none';
    
    // Fill student information
    document.getElementById('studentName').textContent = userProfile.full_name;
    document.getElementById('studentEmail').textContent = userProfile.email;
    document.getElementById('studentUniversity').textContent = userProfile.university || 'Syracuse University';
    document.getElementById('studentRole').textContent = 'Student';
  }
}

function displayUserCourses() {
  const container = document.getElementById('userCourses');
  
  if (userCourses.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No courses added yet</p>';
    return;
  }

  const coursesHTML = userCourses.map(course => `
    <div class="course-manage-row">
      <div class="course-manage-code">${course.course_code}</div>
      <div class="course-manage-name">${course.course_name}</div>
      <div class="course-manage-meta">
        ${course.professor ? `Prof. ${course.professor}` : ''}
        ${course.professor && course.grade ? ' • ' : ''}
        ${course.grade ? `Grade: ${course.grade}` : ''}
      </div>
      <button class="btn-delete-course" onclick="deleteCourse(${course.id})">Delete</button>
    </div>
  `).join('');
  
  container.innerHTML = coursesHTML;
}

function setupAddCourseForm() {
  // Course Code Dropdown
  const courseCodeSelect = document.getElementById('courseCodeSelect');
  courseCodeSelect.innerHTML = '<option value="">Select Course Code</option>';
  courseCatalog.forEach(course => {
    courseCodeSelect.innerHTML += `<option value="${course.course_code}" data-name="${course.course_name}">${course.course_code} - ${course.course_name}</option>`;
  });

  // Professor Dropdown
  const professorSelect = document.getElementById('professorSelect');
  professorSelect.innerHTML = '<option value="">Select Professor (Optional)</option>';
  professors.forEach(prof => {
    professorSelect.innerHTML += `<option value="${prof.name}">${prof.name}</option>`;
  });

  // Grade Dropdown
  const gradeSelect = document.getElementById('gradeSelect');
  gradeSelect.innerHTML = `
    <option value="">Select Grade (Optional)</option>
    <option value="A+">A+ (97-100%)</option>
    <option value="A">A (93-96%)</option>
    <option value="A-">A- (90-92%)</option>
    <option value="B+">B+ (87-89%)</option>
    <option value="B">B (83-86%)</option>
    <option value="B-">B- (80-82%)</option>
    <option value="C+">C+ (77-79%)</option>
    <option value="C">C (73-76%)</option>
    <option value="C-">C- (70-72%)</option>
    <option value="D+">D+ (67-69%)</option>
    <option value="D">D (65-66%)</option>
    <option value="F">F (Below 65%)</option>
    <option value="P">P (Pass)</option>
    <option value="S">S (Satisfactory)</option>
  `;

  // Auto-fill course name when course code is selected
  courseCodeSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const courseName = selectedOption.getAttribute('data-name') || '';
    document.getElementById('courseNameInput').value = courseName;
  });
}

async function saveTutorProfile() {
  const bio = document.getElementById('bioTextarea').value;
  const hourlyRate = document.getElementById('hourlyRateInput').value;

  if (!hourlyRate || isNaN(hourlyRate) || parseFloat(hourlyRate) < 1) {
    showFeedback('Please enter a valid hourly rate.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, hourly_rate: parseFloat(hourlyRate) })
    });

    if (response.ok) {
      showFeedback('Profile updated successfully!', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not update profile', 'error');
    }
  } catch (error) {
    showFeedback('Network error. Please try again.', 'error');
  }
}

async function addCourse() {
  const courseCode = document.getElementById('courseCodeSelect').value;
  const courseName = document.getElementById('courseNameInput').value;
  const professor = document.getElementById('professorSelect').value;
  const grade = document.getElementById('gradeSelect').value;

  if (!courseCode || !courseName) {
    showFeedback('Please select a course code.', 'error');
    return;
  }

  // Check if course already exists
  if (userCourses.some(course => course.course_code === courseCode)) {
    showFeedback('You have already added this course.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/profile/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_code: courseCode,
        course_name: courseName,
        professor: professor || '',
        grade: grade || ''
      })
    });

    if (response.ok) {
      const result = await response.json();
      
      // Add to local array
      userCourses.push({
        id: result.id,
        course_code: courseCode,
        course_name: courseName,
        professor: professor || '',
        grade: grade || ''
      });
      
      displayUserCourses();
      
      // Reset form
      document.getElementById('courseCodeSelect').value = '';
      document.getElementById('courseNameInput').value = '';
      document.getElementById('professorSelect').value = '';
      document.getElementById('gradeSelect').value = '';
      
      showFeedback('Course added successfully!', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not add course', 'error');
    }
  } catch (error) {
    showFeedback('Network error. Please try again.', 'error');
  }
}

async function deleteCourse(courseId) {
  if (!confirm('Are you sure you want to remove this course?')) return;

  try {
    const response = await fetch(`/api/profile/courses/${courseId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      userCourses = userCourses.filter(course => course.id !== courseId);
      displayUserCourses();
      showFeedback('Course removed successfully!', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not remove course', 'error');
    }
  } catch (error) {
    showFeedback('Network error. Please try again.', 'error');
  }
}

function showFeedback(message, type = 'info') {
  // Create feedback element if it doesn't exist
  let feedback = document.getElementById('feedback');
  if (!feedback) {
    feedback = document.createElement('div');
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
    document.body.appendChild(feedback);
  }

  // Set message and style
  feedback.textContent = message;
  feedback.className = type;

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

  // Show and auto-hide
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