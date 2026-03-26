// My Bookings page

const sessionTypeLabels = {
  one_on_one: '👤 1-on-1',
  group: '👥 Group',
  resources: '📚 Resources'
};

fetch('/api/me')
  .then(res => res.json())
  .then(user => {
    console.log('USER DEBUG:', user);
    document.getElementById('navUserName').textContent = user.full_name;
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
    console.log('BOOKINGS DEBUG:', bookings);
    document.getElementById('loadingState').classList.add('hidden');

    if (!bookings || bookings.length === 0) {
      document.getElementById('emptyState').classList.remove('hidden');
      return;
    }

    const list = document.getElementById('bookingsList');
    list.classList.remove('hidden');

    list.innerHTML = bookings.map(b => {
      console.log(`Booking ${b.id}: status=${b.status}, payment_status=${b.payment_status}, hourly_rate=${b.hourly_rate}`);

      const date = new Date(b.scheduled_at);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const statusLabel = {
        pending: '⏳ Pending',
        confirmed: '✅ Confirmed',
        cancelled: '❌ Cancelled',
        completed: '🎓 Completed'
      }[b.status] || b.status;

      const sessionLabel = sessionTypeLabels[b.session_type] || '👤 1-on-1';

      const canCancel = b.status === 'pending';
      const canReview = b.status === 'completed';

      const canPay = b.status === 'confirmed' &&
                    (!b.payment_status || b.payment_status === 'pending' || b.payment_status === 'unpaid');

      const isResources = b.session_type === 'resources';
      const paymentStatus = b.payment_status || 'pending';

      console.log(`Booking ${b.id} - canPay: ${canPay} (status: ${b.status}, payment_status: ${paymentStatus})`);

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
            ${paymentStatus === 'paid' ?
              `<div style="font-size:0.8rem;color:#27ae60;margin-top:4px;font-weight:600;">
                 💳 Payment: Paid
               </div>` :
              paymentStatus === 'unpaid' || paymentStatus === 'pending' ?
              `<div style="font-size:0.8rem;color:#f39c12;margin-top:4px;font-weight:600;">
                 💳 Payment: Pending
               </div>` : ''
            }
          </div>
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

    document.querySelectorAll('.star-picker').forEach(picker => {
      let selected = 0;
      picker.querySelectorAll('span').forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(picker, parseInt(star.dataset.val)));
        star.addEventListener('mouseout', () => highlightStars(picker, selected));
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

function highlightStars(picker, count) {
  picker.querySelectorAll('span').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.val) <= count);
  });
}

function toggleReviewForm(id) {
  document.getElementById(`reviewForm-${id}`).classList.toggle('hidden');
}

async function submitReview(bookingId) {
  const picker = document.getElementById(`stars-${bookingId}`);
  const rating = parseInt(picker.dataset.rating || 0);
  const comment = document.getElementById(`comment-${bookingId}`).value;
  const feedback = document.getElementById(`reviewFeedback-${bookingId}`);

  if (!rating) {
    feedback.textContent = '⚠️ Please select a star rating.';
    feedback.style.color = '#e74c3c';
    return;
  }

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, rating, comment })
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
    .catch(() => alert('Could not cancel. Please try again.'));
}

// Payment Modal Functions
function openPaymentModal(bookingId, tutorName, hourlyRate) {
  console.log('Opening payment modal for:', { bookingId, tutorName, hourlyRate });

  const container = document.getElementById('payment-modal-container');
  if (!container) {
    console.error('Payment modal container not found!');
    alert('Payment modal container not found. Please refresh the page.');
    return;
  }

  const subtotal = parseFloat(hourlyRate);
  const nyTax = subtotal * 0.0825;
  const total = subtotal + nyTax;

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
              <input 
                type="text" 
                class="form-input" 
                placeholder="1234 5678 9012 3456"
                maxlength="19"
                id="cardNumber"
              >
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Expiry Date</label>
                <input 
                  type="text" 
                  class="form-input" 
                  placeholder="MM/YY"
                  maxlength="5"
                  id="expiryDate"
                >
              </div>
              <div class="form-group">
                <label class="form-label">CVC</label>
                <input 
                  type="text" 
                  class="form-input" 
                  placeholder="123"
                  maxlength="4"
                  id="cvc"
                >
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Cardholder Name</label>
              <input 
                type="text" 
                class="form-input" 
                placeholder="John Doe"
                id="cardholderName"
              >
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
  
  // Initialize modal functionality
  initializePaymentModal(bookingId, total);
}

function initializePaymentModal(bookingId, total) {
  console.log('Initializing payment modal for booking:', bookingId);
  
  // Close button functionality
  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closePaymentModal();
    });
  }
  
  // Cancel button functionality
  const cancelBtn = document.getElementById('modalCancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closePaymentModal();
    });
  }
  
  // Pay button functionality
  const payBtn = document.getElementById('pay-button');
  if (payBtn) {
    payBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const id = this.getAttribute('data-booking-id');
      const amount = this.getAttribute('data-amount');
      processPayment(parseInt(id), parseFloat(amount));
    });
  }
  
  // Close on overlay click
  const modal = document.querySelector('.payment-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closePaymentModal();
      }
    });
  }

  // Auto-format card number
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\s/g, '');
      let formattedValue = value.replace(/(.{4})/g, '$1 ');
      e.target.value = formattedValue.trim();
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
      
      const cardForm = document.getElementById('card-form');
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
  console.log('Closing payment modal');
  const modal = document.querySelector('.payment-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      const container = document.getElementById('payment-modal-container');
      if (container) {
        container.innerHTML = '';
      }
    }, 300);
  }
}

async function processPayment(bookingId, amount) {
  console.log('Processing payment for booking:', bookingId, 'amount:', amount);
  
  const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'credit-card';
  const payBtn = document.getElementById('pay-button');
  
  if (!payBtn) {
    console.error('Pay button not found');
    return;
  }
  
  // Disable button and show loading
  payBtn.disabled = true;
  
  try {
    if (selectedMethod === 'google-pay') {
      payBtn.innerHTML = '⏳ Processing Google Pay...';
    } else if (selectedMethod === 'apple-pay') {
      payBtn.innerHTML = '⏳ Processing Apple Pay...';
    } else if (selectedMethod === 'paypal') {
      payBtn.innerHTML = '⏳ Redirecting to PayPal...';
    } else {
      payBtn.innerHTML = '⏳ Processing Card...';
    }

    // Call payment API
    const response = await fetch('/api/payments/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        booking_id: bookingId,
        payment_method: {
          type: selectedMethod,
          last4: selectedMethod === 'credit-card' ? '4242' : null
        },
        amount: amount
      })
    });

    const result = await response.json();
    console.log('Payment result:', result);

    if (result.success) {
      // Update booking payment status
      await fetch(`/api/bookings/${bookingId}/payment-success`, {
        method: 'POST'
      });
      
      alert(`Payment successful! 🎉\nPayment ID: ${result.payment_id}`);
      closePaymentModal();
      
      // Refresh bookings to show payment status
      window.location.reload();
    } else {
      payBtn.disabled = false;
      payBtn.innerHTML = `💳 Pay $${amount.toFixed(2)}`;
      alert(`Payment failed: ${result.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Payment error:', error);
    payBtn.disabled = false;
    payBtn.innerHTML = `💳 Pay $${amount.toFixed(2)}`;
    alert('Payment processing failed. Please try again.');
  }
}