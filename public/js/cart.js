// ── Avatar utilities — available globally on all pages ───────────────────
// Supports user photos (avatar_url) with color fallback based on user ID.

window.AVATAR_COLORS = [
  ['#000E54', '#0022aa'],   // Syracuse Navy
  ['#c0392b', '#e74c3c'],   // Red
  ['#16a085', '#1abc9c'],   // Teal
  ['#8e44ad', '#9b59b6'],   // Purple
  ['#d35400', '#e67e22'],   // Deep Orange
  ['#1a5276', '#2980b9'],   // Blue
  ['#145a32', '#27ae60'],   // Green
  ['#6d4c41', '#795548'],   // Brown
  ['#1b2631', '#2c3e50'],   // Dark
  ['#7d6608', '#f39c12'],   // Amber
];

window.getAvatarColors = function(id) {
  const index = Math.abs(parseInt(id) || 0) % window.AVATAR_COLORS.length;
  return window.AVATAR_COLORS[index];
};

// Returns inline style string (gradient) — used when no photo
window.getAvatarStyle = function(id) {
  const [from, to] = window.getAvatarColors(id);
  return 'background:linear-gradient(135deg,' + from + ',' + to + ')';
};

// Returns full avatar HTML — photo if available, colored initial otherwise
// usage: getAvatarHTML({ id, avatar_url, full_name }, sizeClass)
window.getAvatarHTML = function(user, extraStyle) {
  const id       = user.id        || 0;
  const name     = user.full_name || user.name || '?';
  const initial  = name.charAt(0).toUpperCase();
  const photoUrl = user.avatar_url;
  const style    = extraStyle || '';

  if (photoUrl) {
    return '<img src="' + photoUrl + '" alt="' + name + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;' + style + '" onerror="this.style.display=\'none\';" />';
  }
  return '<span style="' + getAvatarStyle(id) + ';display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:inherit;color:white;font-weight:800;' + style + '">' + initial + '</span>';
};

// ── Cart — shared across all pages ───────────────────────────────────────
// Fetches confirmed+unpaid bookings and shows a payment dropdown from the topnav

(function () {
  // ── Load cart badge on startup ──────────────────────────────────────────
  loadCartBadge();
  setInterval(loadCartBadge, 30000);

  function loadCartBadge() {
    fetch('/api/bookings')
      .then(r => {
        if (!r.ok) return [];
        return r.json();
      })
      .then(bookings => {
        if (!Array.isArray(bookings)) return;
        const pending = bookings.filter(b =>
          b.status === 'confirmed' &&
          (!b.payment_status || b.payment_status === 'unpaid' || b.payment_status === 'pending')
        );

        const badge = document.getElementById('cartBadge');
        if (!badge) return;

        if (pending.length > 0) {
          badge.textContent = pending.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      })
      .catch(() => {});
  }

  // ── Open cart modal ─────────────────────────────────────────────────────
  window.openCart = async function () {
    // Remove existing cart modal if open (toggle behavior)
    const existing = document.getElementById('cartModalOverlay');
    if (existing) {
      existing.remove();
      return;
    }

    // Fetch confirmed unpaid bookings
    let bookings = [];
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const all = await res.json();
        bookings = all.filter(b =>
          b.status === 'confirmed' &&
          (!b.payment_status || b.payment_status === 'unpaid' || b.payment_status === 'pending')
        );
      }
    } catch (e) {
      console.error('Cart fetch error:', e);
    }

    // Build modal HTML
    const overlay = document.createElement('div');
    overlay.id        = 'cartModalOverlay';
    overlay.className = 'cart-modal-overlay';

    const totalAmount = bookings.reduce((sum, b) => {
      const subtotal = parseFloat(b.hourly_rate || 0);
      return sum + subtotal + (subtotal * 0.0825);
    }, 0);

    const itemsHTML = bookings.length === 0
      ? `<div class="cart-empty">
           <div class="icon">🛒</div>
           <h4>No pending payments</h4>
           <p>Confirmed sessions that haven't been paid yet will appear here.</p>
           <a href="/bookings" class="btn-cart-go-bookings">View My Bookings</a>
         </div>`
      : bookings.map(b => {
          const subtotal = parseFloat(b.hourly_rate || 0);
          const tax      = subtotal * 0.0825;
          const total    = subtotal + tax;
          const date     = new Date(b.scheduled_at);
          const dateStr  = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

          return `
            <div class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-tutor">👨‍🏫 ${b.tutor_name}</div>
                <span class="cart-item-course">${b.course_code}</span>
                <div class="cart-item-date">📅 ${dateStr}</div>
              </div>
              <div class="cart-item-price">
                $${total.toFixed(2)}
                <span>incl. tax</span>
              </div>
              <button class="btn-cart-pay" onclick="payFromCart(${b.id}, '${b.tutor_name.replace(/'/g, "\\'")}', ${b.hourly_rate})">
                💳 Pay
              </button>
            </div>
          `;
        }).join('');

    const totalFooter = bookings.length > 1
      ? `<div class="cart-total">
           <span class="cart-total-label">Total pending (${bookings.length} sessions)</span>
           <span class="cart-total-amount">$${totalAmount.toFixed(2)}</span>
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="cart-modal" id="cartModal">
        <div class="cart-modal-header">
          <div>
            <h3>🛒 Pending Payments</h3>
            <p>${bookings.length} session${bookings.length !== 1 ? 's' : ''} waiting to be paid</p>
          </div>
          <button class="close-cart-modal" onclick="closeCart()">✕</button>
        </div>
        <div class="cart-modal-body">
          ${itemsHTML}
        </div>
        ${totalFooter}
      </div>
    `;

    document.body.appendChild(overlay);

    // Close when clicking outside the modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCart();
    });

    // Close with ESC
    document.addEventListener('keydown', cartEscHandler);
  };

  function cartEscHandler(e) {
    if (e.key === 'Escape') {
      closeCart();
      document.removeEventListener('keydown', cartEscHandler);
    }
  }

  window.closeCart = function () {
    const overlay = document.getElementById('cartModalOverlay');
    if (overlay) {
      overlay.style.opacity    = '0';
      overlay.style.transition = 'opacity 0.2s ease';
      setTimeout(() => overlay.remove(), 200);
    }
    document.removeEventListener('keydown', cartEscHandler);
  };

  // ── Pay from cart — opens the full payment modal ────────────────────────
  window.payFromCart = function (bookingId, tutorName, hourlyRate) {
    closeCart();

    // If we're already on the bookings page, use its openPaymentModal directly
    if (typeof openPaymentModal === 'function') {
      openPaymentModal(bookingId, tutorName, hourlyRate);
      return;
    }

    // Otherwise redirect to bookings page — the modal can be opened from there
    window.location.href = '/bookings';
  };
})();

// Update navbar to show user photo next to name
window.updateNavPhoto = function(user) {
  if (!user || !user.avatar_url) return;

  const existing = document.getElementById('navAvatarImg');
  if (existing) { existing.src = user.avatar_url; return; }

  const img = document.createElement('img');
  img.id  = 'navAvatarImg';
  img.src = user.avatar_url;
  img.alt = user.full_name || '';

  // Force small size inline — never relies on an external CSS file
  img.style.cssText = [
    'width:32px',
    'height:32px',
    'border-radius:8px',
    'object-fit:cover',
    'border:2px solid rgba(247,105,0,0.5)',
    'flex-shrink:0',
    'display:inline-block',
    'vertical-align:middle'
  ].join(';');

  img.onerror = function() { this.remove(); };

  // Insert right before the name span, inside topnav-right
  const navUser = document.getElementById('navUserName');
  if (navUser) {
    // navUserName is a <span> inside a <span class="nav-user">
    // insert before the nav-user span, not inside it
    const navUserSpan = navUser.closest('.nav-user') || navUser.parentNode;
    if (navUserSpan && navUserSpan.parentNode) {
      navUserSpan.parentNode.insertBefore(img, navUserSpan);
    }
  }
};