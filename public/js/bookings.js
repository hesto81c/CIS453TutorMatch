let currentUser = null;
let bookings = [];

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  await loadCurrentUser();
  await loadBookings();
  displayBookings();
  
  // Check for URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gcal') === 'success') {
    showFeedback('Calendar event added successfully! 📅', 'success');
  } else if (urlParams.get('gcal') === 'error') {
    showFeedback('Could not add to calendar. Try again.', 'error');
  }
});

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      currentUser = await response.json();
    }
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

async function loadBookings() {
  try {
    const response = await fetch('/api/bookings');
    if (response.ok) {
      bookings = await response.json();
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
}

function displayBookings() {
  const container = document.getElementById('bookingsList');
  
  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-bookings">
        <div class="empty-icon">📚</div>
        <h3>No bookings yet</h3>
        <p>Start your learning journey by booking a session with a tutor who has already mastered your course!</p>
        <a href="/dashboard">Find a Tutor</a>
      </div>
    `;
    return;
  }

  const bookingsHTML = bookings.map(booking => createBookingCard(booking)).join('');
  container.innerHTML = bookingsHTML;
}

function createBookingCard(booking) {
  const date = new Date(booking.scheduled_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const sessionIcons = {
    'one_on_one': '👨‍🏫',
    'group': '👥',
    'resources': '📚'
  };

  const sessionLabels = {
    'one_on_one': '1-on-1',
    'group': 'Group',
    'resources': 'Resources'
  };

  // Payment status logic
  const showPayButton = booking.status === 'confirmed' && booking.payment_status === 'unpaid';
  const showCalendarButton = booking.status === 'confirmed' && booking.payment_status === 'paid';

  let actionButtons = '';
  
  if (booking.status === 'pending') {
    actionButtons = `<button class="btn-cancel-booking" onclick="cancelBooking(${booking.id})">Cancel</button>`;
  } else if (showPayButton) {
    actionButtons = `
      <button class="btn-pay-now" onclick="openPaymentModal(${booking.id}, ${booking.hourly_rate})">
        💳 Pay Now
      </button>
      <div class="payment-status-badge unpaid">Payment Required</div>
    `;
  } else if (showCalendarButton) {
    actionButtons = `
      <button class="btn-gcal" onclick="addToGoogleCalendar(${booking.id})" id="gcal-btn-${booking.id}">
        📅 Add to Calendar
      </button>
      <div class="payment-status-badge paid">✓ Paid</div>
    `;
  } else if (booking.payment_status === 'paid') {
    actionButtons = `<div class="payment-status-badge paid">✓ Paid</div>`;
  }

  return `
    <div class="booking-card status-${booking.status}">
      <div class="booking-info">
        <div class="booking-tutor">${booking.tutor_name}</div>
        <div>
          <span class="booking-course">${booking.course_code}</span>
          <span class="session-type-badge">
            ${sessionIcons[booking.session_type]} ${sessionLabels[booking.session_type]}
          </span>
        </div>
        <div class="booking-date">📅 ${formattedDate} at ${formattedTime}</div>
        ${booking.message ? `<div class="booking-message">"${booking.message}"</div>` : ''}
      </div>
      <div class="booking-right">
        <span class="status-badge ${booking.status}">${booking.status}</span>
        ${actionButtons}
      </div>
    </div>
  `;
}

async function cancelBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;

  try {
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'PATCH'
    });

    if (response.ok) {
      await loadBookings();
      displayBookings();
      showFeedback('Booking cancelled successfully', 'success');
    } else {
      const error = await response.json();
      showFeedback(error.error || 'Could not cancel booking', 'error');
    }
  } catch (error) {
    showFeedback('Network error. Please try again.', 'error');
  }
}

async function addToGoogleCalendar(bookingId) {
  const button = document.getElementById(`gcal-btn-${bookingId}`);
  if (!button) return;

  button.disabled = true;
  button.innerHTML = '⏳ Adding...';

  try {
    const response = await fetch(`/api/calendar/add/${bookingId}`, {
      method: 'POST'
    });
    
    const result = await response.json();

    if (result.success) {
      button.innerHTML = '✅ Added';
      showFeedback('Event added to Google Calendar!', 'success');
    } else if (result.redirect) {
      window.location.href = result.redirect;
    } else {
      throw new Error('Failed to add event');
    }
  } catch (error) {
    button.disabled = false;
    button.innerHTML = '📅 Add to Calendar';
    showFeedback('Could not add to calendar. Try again.', 'error');
  }
}

// ───────────────────────────────────────────────────────────────────────
// ── STAGE 9: PAYMENT SYSTEM ───────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────

let paymentModal = null;
let currentBookingForPayment = null;

function openPaymentModal(bookingId, hourlyRate) {
  currentBookingForPayment = bookingId;
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const amount = hourlyRate;
  
  paymentModal = document.createElement('div');
  paymentModal.className = 'modal-overlay';
  paymentModal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>💳 Complete Payment</h2>
        <button class="modal-close" onclick="closePaymentModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="modal-tutor-info">
          <div class="modal-avatar">${booking.tutor_name.charAt(0)}</div>
          <div>
            <div class="modal-tutor-name">${booking.tutor_name}</div>
            <div class="modal-tutor-rate">$${hourlyRate}/hour</div>
          </div>
        </div>

        <div class="payment-summary">
          <h4>💰 Payment Summary</h4>
          <div class="payment-row">
            <span>Session fee:</span>
            <span>$${amount}.00</span>
          </div>
          <div class="payment-row">
            <span>Platform fee:</span>
            <span>$0.00</span>
          </div>
          <div class="payment-row">
            <span>Total:</span>
            <span>$${amount}.00</span>
          </div>
        </div>

        <div id="paymentForm">
          <div class="payment-form">
            <div class="input-group">
              <label>Card Number</label>
              <div class="card-input">
                <span class="card-icon">💳</span>
                <input type="text" id="cardNumber" placeholder="4242 4242 4242 4242" maxlength="19" 
                       oninput="formatCardNumber(this)" autocomplete="cc-number">
              </div>
            </div>
            
            <div class="card-row">
              <div class="input-group">
                <label>Expiry Date</label>
                <div class="card-input">
                  <span class="card-icon">📅</span>
                  <input type="text" id="cardExpiry" placeholder="MM/YY" maxlength="5" 
                         oninput="formatExpiry(this)" autocomplete="cc-exp">
                </div>
              </div>
              <div class="input-group">
                <label>CVC</label>
                <div class="card-input">
                  <span class="card-icon">🔒</span>
                  <input type="text" id="cardCvc" placeholder="123" maxlength="4" 
                         oninput="formatCvc(this)" autocomplete="cc-csc">
                </div>
              </div>
            </div>

            <div class="input-group">
              <label>Cardholder Name</label>
              <input type="text" id="cardName" placeholder="John Doe" autocomplete="cc-name">
            </div>

            <div class="payment-note">
              <span class="icon">🔒</span>
              <div>
                <strong>Demo Mode:</strong> This is a mock payment system for demonstration. 
                Use card number 4242 4242 4242 4242 with any future date and CVC.
              </div>
            </div>

            <div id="paymentError" class="payment-error" style="display: none;"></div>
          </div>
        </div>

        <div id="paymentSuccess" class="payment-success" style="display: none;">
          <div class="icon">✅</div>
          <h3>Payment Successful!</h3>
          <p>Your session is now fully confirmed and paid.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel-modal" onclick="closePaymentModal()">Cancel</button>
        <button class="btn-process-payment" onclick="processPayment()" id="payBtn">
          💳 Pay $${amount}.00
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(paymentModal);
  document.getElementById('cardNumber').focus();
}

function closePaymentModal() {
  if (paymentModal) {
    document.body.removeChild(paymentModal);
    paymentModal = null;
    currentBookingForPayment = null;
  }
}

function formatCardNumber(input) {
  let value = input.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  input.value = formattedValue;
}

function formatExpiry(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  input.value = value;
}

function formatCvc(input) {
  input.value = input.value.replace(/\D/g, '');
}

async function processPayment() {
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const cardExpiry = document.getElementById('cardExpiry').value;
  const cardCvc = document.getElementById('cardCvc').value;
  const cardName = document.getElementById('cardName').value;
  const payBtn = document.getElementById('payBtn');
  const paymentError = document.getElementById('paymentError');

  // Reset error
  paymentError.style.display = 'none';

  // Basic validation
  if (!cardNumber || cardNumber.length < 13) {
    showPaymentError('Please enter a valid card number');
    return;
  }
  if (!cardExpiry || !cardExpiry.includes('/')) {
    showPaymentError('Please enter a valid expiry date (MM/YY)');
    return;
  }
  if (!cardCvc || cardCvc.length < 3) {
    showPaymentError('Please enter a valid CVC');
    return;
  }
  if (!cardName.trim()) {
    showPaymentError('Please enter the cardholder name');
    return;
  }

  // Show loading state
  payBtn.disabled = true;
  payBtn.innerHTML = `<span class="payment-loading"></span> Processing...`;

  try {
    const booking = bookings.find(b => b.id === currentBookingForPayment);
    const response = await fetch('/api/payments/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        booking_id: currentBookingForPayment,
        amount: booking.hourly_rate,
        payment_method: {
          last4: cardNumber.slice(-4),
          name: cardName
        }
      })
    });

    const result = await response.json();

    if (result.success) {
      // Show success state
      document.getElementById('paymentForm').style.display = 'none';
      document.getElementById('paymentSuccess').style.display = 'block';
      document.querySelector('.modal-footer').style.display = 'none';
      
      // Auto close after 3 seconds and refresh bookings
      setTimeout(async () => {
        closePaymentModal();
        await loadBookings();
        displayBookings();
        showFeedback('Payment successful! Session confirmed. 💰', 'success');
      }, 3000);

    } else {
      payBtn.disabled = false;
      payBtn.innerHTML = `💳 Pay $${booking.hourly_rate}.00`;
      showPaymentError(result.message || 'Payment failed. Please try again.');
    }

  } catch (error) {
    payBtn.disabled = false;
    payBtn.innerHTML = `💳 Pay $${booking.hourly_rate}.00`;
    showPaymentError('Network error. Please try again.');
  }
}

function showPaymentError(message) {
  const errorDiv = document.getElementById('paymentError');
  errorDiv.innerHTML = `⚠️ ${message}`;
  errorDiv.style.display = 'flex';
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

// Close modal when clicking outside
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    closePaymentModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closePaymentModal();
  }
});