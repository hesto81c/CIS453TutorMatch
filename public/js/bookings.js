// ── My Bookings Page ─────────────────────────────────────────────────────

const sessionTypeLabels = {
  one_on_one: '👤 1-on-1',
  group:      '👥 Group',
  resources:  '📚 Resources'
};

fetch('/api/me')
  .then(res => res.json())
  .then(user => {
    document.getElementById('navUserName').textContent = user.full_name;
    if (typeof updateNavPhoto === 'function') updateNavPhoto(user);
    const roleEl = document.getElementById('navUserRole');
    if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (user.role === 'tutor') {
      const link = document.getElementById('tutorDashLink');
      if (link) link.style.display = 'flex';
    }
  })
  .catch(() => window.location.href = '/');

fetch('/api/bookings')
  .then(res => res.json())
  .then(bookings => {
    document.getElementById('loadingState').classList.add('hidden');

    if (!bookings || bookings.length === 0) {
      document.getElementById('emptyState').classList.remove('hidden');
      return;
    }

    const list = document.getElementById('bookingsList');
    list.classList.remove('hidden');

    list.innerHTML = bookings.map(b => {
      const date    = new Date(b.scheduled_at);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour:   '2-digit',
        minute: '2-digit'
      });

      const statusLabel = {
        pending:   '⏳ Pending',
        confirmed: '✅ Confirmed',
        cancelled: '❌ Cancelled',
        completed: '🎓 Completed'
      }[b.status] || b.status;

      const sessionLabel  = sessionTypeLabels[b.session_type] || '👤 1-on-1';
      const canCancel     = b.status === 'pending';
      const canReview     = b.status === 'completed';
      const canPay        = b.status === 'confirmed' &&
                            (!b.payment_status || b.payment_status === 'pending' || b.payment_status === 'unpaid');
      const isResources   = b.session_type === 'resources';
      const paymentStatus = b.payment_status || 'pending';

      return `
        <div class="booking-card status-${b.status}" id="booking-${b.id}">
          <div class="booking-info">
            <div class="booking-tutor">👨‍🏫 ${b.tutor_name}</div>
            <span class="booking-course">${b.course_code}</span>
            <span class="session-type-badge">${sessionLabel}</span>
            ${!isResources
              ? `<div class="booking-date">📅 ${dateStr} at ${timeStr}</div>`
              : `<div class="booking-date">📚 Tutor will share materials after confirming</div>`
            }
            ${b.message ? `<div class="booking-message">"${b.message}"</div>` : ''}
            <div style="font-size:0.82rem;color:#aaa;margin-top:6px;">
              $${parseFloat(b.hourly_rate).toFixed(2)}/hr
              ${b.is_verified ? '· ✅ Verified Tutor' : ''}
            </div>
            ${paymentStatus === 'paid'
              ? `<div style="font-size:0.8rem;color:#27ae60;margin-top:4px;font-weight:600;">
                   💳 Payment: Paid
                 </div>`
              : paymentStatus === 'unpaid' || paymentStatus === 'pending'
              ? `<div style="font-size:0.8rem;color:#f39c12;margin-top:4px;font-weight:600;">
                   💳 Payment: Pending
                 </div>`
              : ''
            }
          </div>
          <!-- Resources section — filled async by loadBookingResources() -->
          <div id="booking-resources-${b.id}" class="booking-resources-section" style="display:none;"></div>
          <div class="booking-right">
            <span class="status-badge ${b.status}">${statusLabel}</span>
            ${canCancel ? `<button class="btn-cancel-booking" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
            ${canPay ? `
              <button class="btn-pay-booking" onclick="openPaymentModal(
                ${b.id},
                '${b.tutor_name.replace(/'/g, "\\'")}',
                ${b.hourly_rate}
              )">
                💳 Pay Now
              </button>
            ` : ''}
            ${canReview ? `
              <button class="btn-submit-review" onclick="toggleReviewForm(${b.id})" id="reviewBtn-${b.id}">
                ⭐ Leave Review
              </button>
            ` : ''}
          </div>
        </div>
        ${canReview ? `
          <div id="reviewForm-${b.id}" class="review-form-card hidden">
            <h4>⭐ Rate your session with ${b.tutor_name}</h4>
            <div class="star-picker" id="stars-${b.id}">
              <span data-val="1">★</span>
              <span data-val="2">★</span>
              <span data-val="3">★</span>
              <span data-val="4">★</span>
              <span data-val="5">★</span>
            </div>
            <textarea id="comment-${b.id}" placeholder="Share your experience (optional)..."></textarea>
            <br>
            <button class="btn-submit-review" onclick="submitReview(${b.id})">Submit Review</button>
            <span id="reviewFeedback-${b.id}" style="margin-left:10px;font-size:0.85rem;"></span>
          </div>
        ` : ''}
      `;
    }).join('');

    // Load resources for confirmed bookings
    bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .forEach(b => loadBookingResources(b.id, b.tutor_id));

    document.querySelectorAll('.star-picker').forEach(picker => {
      let selected = 0;
      picker.querySelectorAll('span').forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(picker, parseInt(star.dataset.val)));
        star.addEventListener('mouseout',  () => highlightStars(picker, selected));
        star.addEventListener('click', () => {
          selected = parseInt(star.dataset.val);
          picker.dataset.rating = selected;
          highlightStars(picker, selected);
        });
      });
    });
  })
  .catch(err => {
    console.error('Bookings error:', err);
    document.getElementById('loadingState').textContent = 'Could not load bookings.';
  });

// ── Load tutor resources for a confirmed booking ──────────────────────────

async function loadBookingResources(bookingId, tutorId) {
  try {
    const response = await fetch(`/api/tutors/${tutorId}/resources`);
    if (!response.ok) return;
    const resources = await response.json();
    if (!resources || resources.length === 0) return;

    const typeIcons  = { link: '🔗', note: '📝', file: '📄' };
    const typeLabels = { link: 'Link', note: 'Note', file: 'File' };

    const card = document.getElementById(`booking-${bookingId}`);
    if (!card) return;

    const resourcesHTML = `
      <div class="booking-resources">
        <div class="booking-resources-title">📎 Resources from your tutor</div>
        ${resources.map(r => `
          <div class="booking-resource-item">
            <span>${typeIcons[r.type] || '📎'}</span>
            <div>
              <div class="booking-resource-name">
                ${r.url
                  ? `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a>`
                  : r.title
                }
                <span class="resource-type-tag">${typeLabels[r.type] || r.type}</span>
              </div>
              ${r.description ? `<div class="booking-resource-desc">${r.description}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const bookingInfo = card.querySelector('.booking-info');
    if (bookingInfo) bookingInfo.insertAdjacentHTML('beforeend', resourcesHTML);
  } catch (err) {
    console.error('Error loading booking resources:', err);
  }
}

// ── Star picker ───────────────────────────────────────────────────────────

function highlightStars(picker, count) {
  picker.querySelectorAll('span').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.val) <= count);
  });
}

function toggleReviewForm(id) {
  document.getElementById(`reviewForm-${id}`).classList.toggle('hidden');
}

// ── Submit review ─────────────────────────────────────────────────────────

async function submitReview(bookingId) {
  const picker   = document.getElementById(`stars-${bookingId}`);
  const rating   = parseInt(picker.dataset.rating || 0);
  const comment  = document.getElementById(`comment-${bookingId}`).value;
  const feedback = document.getElementById(`reviewFeedback-${bookingId}`);

  if (!rating) {
    feedback.textContent = '⚠️ Please select a star rating.';
    feedback.style.color = '#e74c3c';
    return;
  }

  try {
    const res  = await fetch('/api/reviews', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ booking_id: bookingId, rating, comment })
    });
    const data = await res.json();

    if (!res.ok) {
      feedback.textContent = data.error || 'Could not submit.';
      feedback.style.color = '#e74c3c';
    } else {
      feedback.textContent = '✅ Review submitted!';
      feedback.style.color = '#27ae60';
      const btn = document.getElementById(`reviewBtn-${bookingId}`);
      if (btn) btn.remove();
      setTimeout(() => document.getElementById(`reviewForm-${bookingId}`).classList.add('hidden'), 2000);
    }
  } catch {
    feedback.textContent = 'Network error.';
    feedback.style.color = '#e74c3c';
  }
}

// ── Cancel booking ────────────────────────────────────────────────────────

function cancelBooking(id) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;
  fetch(`/api/bookings/${id}/cancel`, { method: 'PATCH' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const card = document.getElementById(`booking-${id}`);
        card.classList.remove('status-pending');
        card.classList.add('status-cancelled');
        card.querySelector('.status-badge').className = 'status-badge cancelled';
        card.querySelector('.status-badge').textContent = '❌ Cancelled';
        const btn = card.querySelector('.btn-cancel-booking');
        if (btn) btn.remove();
      }
    })
    .catch(() => showFeedback('Could not cancel. Please try again.', 'error'));
}

// ── Payment modal ─────────────────────────────────────────────────────────

function openPaymentModal(bookingId, tutorName, hourlyRate) {
  const container = document.getElementById('payment-modal-container');
  if (!container) {
    showFeedback('Payment modal not found. Please refresh the page.', 'error');
    return;
  }

  const subtotal = parseFloat(hourlyRate);
  const nyTax    = subtotal * 0.0825;
  const total    = subtotal + nyTax;

  const modalHTML = `
    <div class="payment-modal">
      <div class="payment-container">
        <div class="payment-header">
          <span style="font-size: 1.5rem;">💳</span>
          <h2>Complete Payment</h2>
          <button class="close-btn" id="modalCloseBtn">×</button>
        </div>

        <div class="payment-body">
          <div class="tutor-info">
            <div class="tutor-avatar">${tutorName.charAt(0).toUpperCase()}</div>
            <div class="tutor-details">
              <h3>${tutorName}</h3>
              <div class="tutor-rate">$${subtotal.toFixed(2)}/hour</div>
            </div>
          </div>

          <div class="payment-summary">
            <div class="summary-header">
              <span>💰</span>
              <span>Payment Summary</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Session fee:</span>
              <span class="summary-value">$${subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">NY State Tax (8.25%):</span>
              <span class="summary-value">$${nyTax.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Platform fee:</span>
              <span class="summary-value">$0.00</span>
            </div>
            <div class="summary-row summary-total">
              <span class="summary-label">Total:</span>
              <span class="summary-value">$${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="payment-methods">
            <h3>Choose Payment Method</h3>
            <div class="payment-options">
              <label class="payment-option">
                <input type="radio" name="payment-method" value="google-pay">
                <div class="payment-option-content">
                  <img src="https://developers.google.com/pay/api/web/guides/brand-guidelines/assets/google-pay-mark_800.png" alt="Google Pay" class="payment-logo" onerror="this.style.display='none'">
                  <div class="payment-option-info">
                    <div class="payment-option-title">Google Pay</div>
                    <div class="payment-option-desc">Pay with your Google account</div>
                  </div>
                </div>
              </label>

              <label class="payment-option">
                <input type="radio" name="payment-method" value="apple-pay">
                <div class="payment-option-content">
                  <img src="https://developer.apple.com/assets/elements/badges/apple-pay-badge.svg" alt="Apple Pay" class="payment-logo" style="background: black; padding: 4px;" onerror="this.style.display='none'">
                  <div class="payment-option-info">
                    <div class="payment-option-title">Apple Pay</div>
                    <div class="payment-option-desc">Pay with Touch ID or Face ID</div>
                  </div>
                </div>
              </label>

              <label class="payment-option">
                <input type="radio" name="payment-method" value="paypal">
                <div class="payment-option-content">
                  <img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-200px.png" alt="PayPal" class="payment-logo" onerror="this.style.display='none'">
                  <div class="payment-option-info">
                    <div class="payment-option-title">PayPal</div>
                    <div class="payment-option-desc">Pay with your PayPal account</div>
                  </div>
                </div>
              </label>

              <label class="payment-option" id="card-option">
                <input type="radio" name="payment-method" value="credit-card" checked>
                <div class="payment-option-content">
                  <img src="https://cdn-icons-png.flaticon.com/512/349/349221.png" alt="Credit Card" class="payment-logo" onerror="this.style.display='none'">
                  <div class="payment-option-info">
                    <div class="payment-option-title">Credit or Debit Card</div>
                    <div class="payment-option-desc">Visa, Mastercard, American Express</div>
                  </div>
                  <div class="card-logos">
                    <img src="https://cdn.worldvectorlogo.com/logos/visa.svg" alt="Visa" class="card-logo" onerror="this.style.display='none'">
                    <img src="https://cdn.worldvectorlogo.com/logos/mastercard.svg" alt="Mastercard" class="card-logo" onerror="this.style.display='none'">
                    <img src="https://cdn.worldvectorlogo.com/logos/american-express.svg" alt="American Express" class="card-logo" onerror="this.style.display='none'">
                    <img src="https://cdn.worldvectorlogo.com/logos/discover.svg" alt="Discover" class="card-logo" onerror="this.style.display='none'">
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="card-form active" id="card-form">
            <div class="form-group">
              <label class="form-label">Card Number</label>
              <input type="text" class="form-input" placeholder="1234 5678 9012 3456" maxlength="19" id="cardNumber">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Expiry Date</label>
                <input type="text" class="form-input" placeholder="MM/YY" maxlength="5" id="expiryDate">
              </div>
              <div class="form-group">
                <label class="form-label">CVC</label>
                <input type="text" class="form-input" placeholder="123" maxlength="4" id="cvc">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cardholder Name</label>
              <input type="text" class="form-input" placeholder="John Doe" id="cardholderName">
            </div>
          </div>

          <div class="tax-info">
            <strong>NY Sales Tax:</strong> 8.25% tax is automatically calculated based on your New York location for tutoring services.
          </div>

          <div class="security-info">
            <span>🔒</span>
            <span>Your payment is secured with 256-bit SSL encryption</span>
          </div>

          <div class="payment-actions">
            <button type="button" class="btn-cancel" id="modalCancelBtn">Cancel</button>
            <button type="button" class="btn-pay" id="pay-button" data-booking-id="${bookingId}" data-amount="${total.toFixed(2)}">💳 Pay $${total.toFixed(2)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = modalHTML;
  initializePaymentModal(bookingId, total);
}

function initializePaymentModal(bookingId, total) {
  // Close button
  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closePaymentModal();
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('modalCancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closePaymentModal();
    });
  }

  // Pay button
  const payBtn = document.getElementById('pay-button');
  if (payBtn) {
    payBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const id     = this.getAttribute('data-booking-id');
      const amount = this.getAttribute('data-amount');
      processPayment(parseInt(id), parseFloat(amount));
    });
  }

  // Close on overlay click
  const modal = document.querySelector('.payment-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) closePaymentModal();
    });
  }

  // Auto-format card number
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function(e) {
      let value          = e.target.value.replace(/\s/g, '');
      let formattedValue = value.replace(/(.{4})/g, '$1 ');
      e.target.value     = formattedValue.trim();
    });
  }

  // Auto-format expiry date
  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      e.target.value = value;
    });
  }

  // Only allow numbers for CVC
  const cvcInput = document.getElementById('cvc');
  if (cvcInput) {
    cvcInput.addEventListener('input', function(e) {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  }

  // Handle payment method selection
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('selected');
      });
      this.closest('.payment-option').classList.add('selected');

      const cardForm  = document.getElementById('card-form');
      const payButton = document.getElementById('pay-button');

      if (this.value === 'credit-card') {
        cardForm.classList.add('active');
        payButton.innerHTML = `💳 Pay $${total.toFixed(2)}`;
      } else {
        cardForm.classList.remove('active');
        if (this.value === 'google-pay') {
          payButton.innerHTML = `Pay with Google Pay $${total.toFixed(2)}`;
        } else if (this.value === 'apple-pay') {
          payButton.innerHTML = `Pay with Apple Pay $${total.toFixed(2)}`;
        } else if (this.value === 'paypal') {
          payButton.innerHTML = `Pay with PayPal $${total.toFixed(2)}`;
        }
      }
    });
  });

  // Set initial selected state
  const defaultSelected = document.querySelector('input[name="payment-method"]:checked');
  if (defaultSelected) {
    defaultSelected.closest('.payment-option').classList.add('selected');
  }

  // ESC key to close
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closePaymentModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

function closePaymentModal() {
  const modal = document.querySelector('.payment-modal');
  if (modal) {
    modal.style.opacity    = '0';
    modal.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      const container = document.getElementById('payment-modal-container');
      if (container) container.innerHTML = '';
    }, 300);
  }
}

// ── Process payment ───────────────────────────────────────────────────────

async function processPayment(bookingId, amount) {
  const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'credit-card';
  const payBtn         = document.getElementById('pay-button');

  if (!payBtn) return;

  payBtn.disabled = true;

  // Show loading state per payment method
  if (selectedMethod === 'google-pay') {
    payBtn.innerHTML = '⏳ Processing Google Pay...';
  } else if (selectedMethod === 'apple-pay') {
    payBtn.innerHTML = '⏳ Processing Apple Pay...';
  } else if (selectedMethod === 'paypal') {
    payBtn.innerHTML = '⏳ Redirecting to PayPal...';
  } else {
    payBtn.innerHTML = '⏳ Processing Card...';
  }

  try {
    const response = await fetch('/api/payments/process', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id:     bookingId,
        payment_method: {
          type:  selectedMethod,
          last4: selectedMethod === 'credit-card' ? '4242' : null
        },
        amount: amount
      })
    });

    const result = await response.json();

    if (result.success) {
      // Update booking payment status on the server
      await fetch(`/api/bookings/${bookingId}/payment-success`, { method: 'POST' });

      closePaymentModal();

      // FIX: replaced alert() with showFeedback() for a consistent, non-blocking UI
      showFeedback(`✅ Payment successful! ID: ${result.payment_id}`, 'success');

      // Reload bookings after a short delay so the user can read the feedback
      setTimeout(() => window.location.reload(), 2000);

    } else {
      payBtn.disabled = false;
      payBtn.innerHTML = `💳 Pay $${amount.toFixed(2)}`;

      // FIX: replaced alert() with showFeedback() for a consistent, non-blocking UI
      showFeedback(`❌ Payment failed: ${result.message || 'Please try again.'}`, 'error');
    }

  } catch (error) {
    console.error('Payment error:', error);
    payBtn.disabled  = false;
    payBtn.innerHTML = `💳 Pay $${amount.toFixed(2)}`;

    // FIX: replaced alert() with showFeedback() for a consistent, non-blocking UI
    showFeedback('❌ Payment processing failed. Please try again.', 'error');
  }
}

// ── Load tutor resources for a booking ───────────────────────────────────

async function loadBookingResources(bookingId, tutorId) {
  try {
    const response = await fetch(`/api/tutors/${tutorId}/resources`);
    if (!response.ok) return;
    const resources = await response.json();

    const container = document.getElementById(`booking-resources-${bookingId}`);
    if (!container) return;
    if (!resources || resources.length === 0) return;

    const resourceIcons  = { link: '🔗', note: '📝', file: '📄' };
    const resourceLabels = { link: 'Link', note: 'Note', file: 'File' };

    container.style.display = 'block';
    container.innerHTML = `
      <div class="booking-resources-header">📎 Tutor Resources</div>
      ${resources.map(r => `
        <div class="booking-resource-item">
          <span class="booking-resource-icon">${resourceIcons[r.type] || '📎'}</span>
          <div class="booking-resource-info">
            <div class="booking-resource-title">
              ${r.url
                ? `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a>`
                : r.title
              }
              <span class="resource-type-badge">${resourceLabels[r.type] || r.type}</span>
            </div>
            ${r.description ? `<div class="booking-resource-desc">${r.description}</div>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    console.error('Error loading booking resources:', err);
  }
}

// ── Feedback toast ────────────────────────────────────────────────────────

function showFeedback(message, type = 'info') {
  const existingFeedback = document.getElementById('bookingFeedback');
  if (existingFeedback) existingFeedback.remove();

  const feedback = document.createElement('div');
  feedback.id    = 'bookingFeedback';

  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 14px 20px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
    z-index: 10000;
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    max-width: 340px;
    transform: translateX(0);
  `;

  feedback.textContent = message;

  if (type === 'success') {
    feedback.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
    feedback.style.color      = 'white';
  } else if (type === 'error') {
    feedback.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    feedback.style.color      = 'white';
  } else {
    feedback.style.background = 'linear-gradient(135deg, #F76900, #e05e00)';
    feedback.style.color      = 'white';
  }

  document.body.appendChild(feedback);

  setTimeout(() => {
    if (feedback && feedback.parentNode) {
      feedback.style.opacity = '0';
      setTimeout(() => {
        if (feedback && feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }
  }, 3500);
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
    .catch(() => {
      // Silently fail for notification badge
    });
}

loadNotifBadge();
setInterval(loadNotifBadge, 30000);