const express       = require('express');
const session       = require('express-session');
const bcrypt        = require('bcrypt');
const path          = require('path');
const http          = require('http');
const crypto        = require('crypto');
const nodemailer    = require('nodemailer');
const { Server }    = require('socket.io');
const { google }    = require('googleapis');
require('dotenv').config();

const db  = require('./db');
const app = express();

const httpServer = http.createServer(app);
const io         = new Server(httpServer);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

// ── Nodemailer transporter ────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ── Helper: create notification ───────────────────────────────────────
async function createNotification(userId, type, title, message) {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [userId, type, title, message]
    );
    io.to(`user_${userId}`).emit('new_notification', { type, title, message });
  } catch (err) {
    console.error('Notification error:', err);
  }
}

// ── Pages ─────────────────────────────────────────────────────────────
app.get('/',                (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register',        (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'views', 'forgot-password.html')));
app.get('/reset-password',  (req, res) => res.sendFile(path.join(__dirname, 'views', 'reset-password.html')));
app.get('/dashboard',       requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/bookings',        requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'bookings.html')));
app.get('/profile',         requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'profile.html')));
app.get('/messages',        requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'messages.html')));
app.get('/messages/:id',    requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'messages.html')));
app.get('/notifications',   requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'notifications.html')));
app.get('/tutor/:id',       requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'tutor.html')));
app.get('/tutor-dashboard', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'tutor-dashboard.html')));

// ── Auth ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { full_name, email, password, role, university } = req.body;
  if (!full_name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required.' });
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already registered.' });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, password_hash, role, university) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, hash, role, university || 'Syracuse University']
    );
    if (role === 'tutor') {
      await db.query('INSERT INTO tutor_profiles (user_id, bio, hourly_rate) VALUES (?, ?, ?)',
        [result.insertId, '', 25.00]);
    }
    req.session.userId = result.insertId;
    req.session.role   = role;
    res.json({ success: true, role });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });
    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    req.session.userId = user.id;
    req.session.role   = user.role;
    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, full_name, email, role FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Forgot Password ───────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const [users] = await db.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
    // Always return success to prevent email enumeration
    if (users.length === 0) return res.json({ success: true });
    const user    = users[0];
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    // Invalidate any existing unused tokens for this user
    await db.query(
      'UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0',
      [user.id]
    );
    await db.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expires]
    );
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
    await transporter.sendMail({
      from:    `"TutorMatch" <${process.env.MAIL_USER}>`,
      to:      email,
      subject: 'Reset your TutorMatch password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f1428;color:#e8eaf6;border-radius:16px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h2 style="color:#F76900;margin:0;">TutorMatch</h2>
            <p style="color:#6b7499;font-size:0.85rem;margin:4px 0 0;">Syracuse University</p>
          </div>
          <h3 style="color:#ffffff;margin-bottom:8px;">Hi ${user.full_name},</h3>
          <p style="color:#aaa;line-height:1.6;">
            We received a request to reset your TutorMatch password.
            Click the button below to choose a new password.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}"
               style="background:#F76900;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;display:inline-block;">
              Reset My Password
            </a>
          </div>
          <p style="color:#6b7499;font-size:0.8rem;line-height:1.6;">
            This link expires in <strong style="color:#aaa;">1 hour</strong>.
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
          <p style="color:#6b7499;font-size:0.75rem;text-align:center;">
            TutorMatch · Syracuse University · #OrangeNation
          </p>
        </div>
      `
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Could not send email. Try again.' });
  }
});

app.get('/api/reset-password/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.json({ valid: false });
  try {
    const [rows] = await db.query(
      'SELECT id FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    res.json({ valid: rows.length > 0 });
  } catch (err) {
    res.json({ valid: false });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Missing fields.' });
  if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const [rows] = await db.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (rows.length === 0)
      return res.status(400).json({ error: 'This link has expired or already been used.' });
    const reset = rows[0];
    const hash  = await bcrypt.hash(password, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, reset.user_id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// ── Search ────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) return res.json([]);
  try {
    const like = `%${q}%`;
    const [rows] = await db.query(`
      SELECT u.id, u.full_name, tp.hourly_rate, tp.is_verified,
             tc.course_code, tc.course_name, tc.professor, tc.grade,
             COALESCE(AVG(r.rating), 0) AS avg_rating
      FROM users u
      JOIN tutor_profiles tp ON tp.user_id = u.id
      JOIN tutor_courses  tc ON tc.tutor_id = u.id
      LEFT JOIN bookings  b  ON b.tutor_id = u.id
      LEFT JOIN reviews   r  ON r.booking_id = b.id
      WHERE u.role = 'tutor'
        AND (tc.course_code LIKE ? OR tc.course_name LIKE ? OR tc.professor LIKE ?)
      GROUP BY u.id, tc.id
      ORDER BY is_verified DESC, avg_rating DESC
    `, [like, like, like]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Tutor profile ─────────────────────────────────────────────────────
app.get('/api/tutors/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.full_name, tp.bio, tp.hourly_rate, tp.is_verified,
             COALESCE(AVG(r.rating), 0) AS avg_rating,
             COUNT(DISTINCT r.id) AS review_count
      FROM users u
      JOIN tutor_profiles tp ON tp.user_id = u.id
      LEFT JOIN bookings b   ON b.tutor_id = u.id
      LEFT JOIN reviews r    ON r.booking_id = b.id
      WHERE u.id = ? AND u.role = 'tutor'
      GROUP BY u.id, tp.id
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tutor not found' });
    const [courses] = await db.query(
      'SELECT * FROM tutor_courses WHERE tutor_id = ? ORDER BY course_code',
      [req.params.id]
    );
    res.json({ ...rows[0], courses });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Bookings ──────────────────────────────────────────────────────────
app.post('/api/bookings', requireLogin, async (req, res) => {
  const { tutor_id, course_code, scheduled_at, message, session_type } = req.body;
  if (!tutor_id || !course_code || !scheduled_at)
    return res.status(400).json({ error: 'Missing required fields.' });
  try {
    await db.query(
      'INSERT INTO bookings (student_id, tutor_id, course_code, scheduled_at, message, session_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.userId, tutor_id, course_code, scheduled_at, message || '', session_type || 'one_on_one']
    );
    const [student] = await db.query('SELECT full_name FROM users WHERE id = ?', [req.session.userId]);
    await createNotification(
      tutor_id, 'booking_request', '📅 New Booking Request',
      `${student[0].full_name} wants to book a session for ${course_code}`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not create booking.' });
  }
});

app.get('/api/bookings', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*, u.full_name AS tutor_name, tp.hourly_rate, tp.is_verified
      FROM bookings b
      JOIN users u           ON u.id = b.tutor_id
      JOIN tutor_profiles tp ON tp.user_id = b.tutor_id
      WHERE b.student_id = ?
      ORDER BY b.created_at DESC
    `, [req.session.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/bookings/:id/cancel', requireLogin, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND student_id = ? AND status = 'pending'",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot cancel this booking.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Profile ───────────────────────────────────────────────────────────
app.get('/api/profile', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, full_name, email, role, university FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    if (user.role === 'tutor') {
      const [profile] = await db.query(
        'SELECT bio, hourly_rate, is_verified FROM tutor_profiles WHERE user_id = ?',
        [req.session.userId]
      );
      const [courses] = await db.query(
        'SELECT id, course_code, course_name, professor, grade FROM tutor_courses WHERE tutor_id = ? ORDER BY course_code',
        [req.session.userId]
      );
      return res.json({ ...user, ...profile[0], courses });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/profile', requireLogin, async (req, res) => {
  const { bio, hourly_rate } = req.body;
  if (!hourly_rate || isNaN(hourly_rate) || hourly_rate < 1)
    return res.status(400).json({ error: 'Please enter a valid hourly rate.' });
  try {
    await db.query(
      'UPDATE tutor_profiles SET bio = ?, hourly_rate = ? WHERE user_id = ?',
      [bio || '', hourly_rate, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

app.post('/api/profile/courses', requireLogin, async (req, res) => {
  const { course_code, course_name, professor, grade } = req.body;
  if (!course_code || !course_name) return res.status(400).json({ error: 'Course code and name are required.' });
  try {
    const [result] = await db.query(
      'INSERT INTO tutor_courses (tutor_id, course_code, course_name, professor, grade) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, course_code.toUpperCase(), course_name, professor || '', grade || '']
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Could not add course.' });
  }
});

app.delete('/api/profile/courses/:id', requireLogin, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM tutor_courses WHERE id = ? AND tutor_id = ?',
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Course not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete course.' });
  }
});

// ── Tutor dashboard ───────────────────────────────────────────────────
app.get('/api/tutor-bookings', requireLogin, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.id, b.course_code, b.scheduled_at, b.status, b.message,
             b.session_type, b.created_at,
             u.full_name AS student_name, u.email AS student_email
      FROM bookings b
      JOIN users u ON u.id = b.student_id
      WHERE b.tutor_id = ?
      ORDER BY CASE b.status WHEN 'pending' THEN 0 ELSE 1 END, b.scheduled_at ASC
    `, [req.session.userId]);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Could not load bookings.' });
  }
});

app.patch('/api/tutor-bookings/:id/confirm', requireLogin, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = 'confirmed' WHERE id = ? AND tutor_id = ? AND status = 'pending'",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Booking not found.' });
    const [booking] = await db.query(
      'SELECT b.student_id, b.course_code, u.full_name AS tutor_name FROM bookings b JOIN users u ON u.id = b.tutor_id WHERE b.id = ?',
      [req.params.id]
    );
    if (booking.length > 0) {
      await createNotification(booking[0].student_id, 'booking_confirmed', '✅ Booking Confirmed!',
        `${booking[0].tutor_name} confirmed your session for ${booking[0].course_code}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not confirm booking.' });
  }
});

app.patch('/api/tutor-bookings/:id/decline', requireLogin, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND tutor_id = ? AND status = 'pending'",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Booking not found.' });
    const [booking] = await db.query(
      'SELECT b.student_id, b.course_code, u.full_name AS tutor_name FROM bookings b JOIN users u ON u.id = b.tutor_id WHERE b.id = ?',
      [req.params.id]
    );
    if (booking.length > 0) {
      await createNotification(booking[0].student_id, 'booking_declined', '❌ Booking Declined',
        `${booking[0].tutor_name} could not accept your session for ${booking[0].course_code}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not decline booking.' });
  }
});

app.patch('/api/tutor-bookings/:id/complete', requireLogin, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE bookings SET status = 'completed' WHERE id = ? AND tutor_id = ? AND status = 'confirmed'",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Booking not found.' });
    const [booking] = await db.query(
      'SELECT b.student_id, b.course_code, u.full_name AS tutor_name FROM bookings b JOIN users u ON u.id = b.tutor_id WHERE b.id = ?',
      [req.params.id]
    );
    if (booking.length > 0) {
      await createNotification(booking[0].student_id, 'session_completed', '🎓 Session Completed!',
        `Your session with ${booking[0].tutor_name} for ${booking[0].course_code} is complete. Leave a review!`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not complete booking.' });
  }
});

// ── Reviews ───────────────────────────────────────────────────────────
app.post('/api/reviews', requireLogin, async (req, res) => {
  const { booking_id, rating, comment } = req.body;
  if (!booking_id || !rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Invalid review data.' });
  try {
    const [bookings] = await db.query(
      "SELECT * FROM bookings WHERE id = ? AND student_id = ? AND status = 'completed'",
      [booking_id, req.session.userId]
    );
    if (bookings.length === 0) return res.status(403).json({ error: 'Booking not found or not completed.' });
    const [existing] = await db.query('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
    if (existing.length > 0) return res.status(400).json({ error: 'Already reviewed.' });
    await db.query('INSERT INTO reviews (booking_id, rating, comment) VALUES (?, ?, ?)',
      [booking_id, rating, comment || '']);
    const [student] = await db.query('SELECT full_name FROM users WHERE id = ?', [req.session.userId]);
    await createNotification(bookings[0].tutor_id, 'new_review', '⭐ New Review Received!',
      `${student[0].full_name} left you a ${rating}-star review for ${bookings[0].course_code}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit review.' });
  }
});

app.get('/api/tutors/:id/reviews', async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS student_name
      FROM reviews r
      JOIN bookings b ON b.id = r.booking_id
      JOIN users u    ON u.id = b.student_id
      WHERE b.tutor_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    const [avg] = await db.query(`
      SELECT AVG(r.rating) AS avg_rating, COUNT(r.id) AS total
      FROM reviews r JOIN bookings b ON b.id = r.booking_id
      WHERE b.tutor_id = ?
    `, [req.params.id]);
    res.json({
      reviews,
      avg_rating: parseFloat(avg[0].avg_rating || 0).toFixed(1),
      total: avg[0].total
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

// ── Notifications ─────────────────────────────────────────────────────
app.get('/api/notifications', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

app.get('/api/notifications/unread-count', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.session.userId]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/notifications/read-all', requireLogin, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/notifications/:id/read', requireLogin, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Messages ──────────────────────────────────────────────────────────
app.get('/api/conversations', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.id AS booking_id, b.course_code, b.status, b.session_type,
        CASE WHEN b.student_id = ? THEN tutor.full_name   ELSE student.full_name END AS other_name,
        CASE WHEN b.student_id = ? THEN b.tutor_id        ELSE b.student_id      END AS other_id,
        (SELECT content    FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*)   FROM messages WHERE booking_id = b.id) AS message_count
      FROM bookings b
      JOIN users student ON student.id = b.student_id
      JOIN users tutor   ON tutor.id   = b.tutor_id
      WHERE (b.student_id = ? OR b.tutor_id = ?) AND b.status IN ('confirmed','completed')
      ORDER BY last_message_at DESC, b.created_at DESC
    `, [req.session.userId, req.session.userId, req.session.userId, req.session.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not load conversations.' });
  }
});

app.get('/api/messages/:bookingId', requireLogin, async (req, res) => {
  try {
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND (student_id = ? OR tutor_id = ?)',
      [req.params.bookingId, req.session.userId, req.session.userId]
    );
    if (booking.length === 0) return res.status(403).json({ error: 'Access denied.' });
    const [messages] = await db.query(`
      SELECT m.id, m.content, m.created_at, m.sender_id, u.full_name AS sender_name
      FROM messages m JOIN users u ON u.id = m.sender_id
      WHERE m.booking_id = ? ORDER BY m.created_at ASC
    `, [req.params.bookingId]);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Could not load messages.' });
  }
});

// ── Google OAuth helpers ──────────────────────────────────────────────
function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

app.get('/auth/google', requireLogin, (req, res) => {
  const { booking_id } = req.query;
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: booking_id || ''
  });
  res.redirect(url);
});

app.get('/auth/google/callback', requireLogin, async (req, res) => {
  const { code, state: booking_id } = req.query;
  if (!code) return res.redirect('/bookings?gcal=error');
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await db.query(`
      INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry_date)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        access_token  = VALUES(access_token),
        refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
        expiry_date   = VALUES(expiry_date)
    `, [req.session.userId, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null]);
    if (booking_id) {
      await createCalendarEvent(req.session.userId, booking_id, tokens);
      return res.redirect('/bookings?gcal=success');
    }
    res.redirect('/bookings?gcal=connected');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('/bookings?gcal=error');
  }
});

app.post('/api/calendar/add/:bookingId', requireLogin, async (req, res) => {
  try {
    const [tokenRows] = await db.query(
      'SELECT * FROM google_tokens WHERE user_id = ?', [req.session.userId]
    );
    if (tokenRows.length === 0)
      return res.json({ redirect: `/auth/google?booking_id=${req.params.bookingId}` });
    await createCalendarEvent(req.session.userId, req.params.bookingId, tokenRows[0]);
    res.json({ success: true });
  } catch (err) {
    console.error('Calendar add error:', err);
    if (err.code === 401)
      return res.json({ redirect: `/auth/google?booking_id=${req.params.bookingId}` });
    res.status(500).json({ error: 'Could not add to Google Calendar.' });
  }
});

async function createCalendarEvent(userId, bookingId, tokens) {
  const [bookings] = await db.query(`
    SELECT b.course_code, b.scheduled_at, b.session_type,
           s.full_name AS student_name, s.email AS student_email,
           t.full_name AS tutor_name,   t.email AS tutor_email
    FROM bookings b
    JOIN users s ON s.id = b.student_id
    JOIN users t ON t.id = b.tutor_id
    WHERE b.id = ? AND (b.student_id = ? OR b.tutor_id = ?)
  `, [bookingId, userId, userId]);
  if (bookings.length === 0) throw new Error('Booking not found');
  const bk = bookings[0];
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expiry_date: tokens.expiry_date });
  oauth2Client.on('tokens', async (newTokens) => {
    await db.query('UPDATE google_tokens SET access_token = ?, expiry_date = ? WHERE user_id = ?',
      [newTokens.access_token, newTokens.expiry_date, userId]);
  });
  const calendar  = google.calendar({ version: 'v3', auth: oauth2Client });
  const startTime = new Date(bk.scheduled_at);
  const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000);
  const sessionLabel = { one_on_one: '1-on-1 Session', group: 'Group Session', resources: 'Resources Session' }[bk.session_type] || 'Session';
  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary:     `TutorMatch — ${bk.course_code} ${sessionLabel}`,
      description: `Tutoring session via TutorMatch.\nTutor: ${bk.tutor_name}\nStudent: ${bk.student_name}\nCourse: ${bk.course_code}`,
      start: { dateTime: startTime.toISOString(), timeZone: 'America/New_York' },
      end:   { dateTime: endTime.toISOString(),   timeZone: 'America/New_York' },
      attendees: [{ email: bk.student_email }, { email: bk.tutor_email }],
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] }
    }
  });
}

// ── Socket.io ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  socket.on('join_user',     (userId)    => socket.join(`user_${userId}`));
  socket.on('join_booking',  (bookingId) => socket.join(`booking_${bookingId}`));
  socket.on('leave_booking', (bookingId) => socket.leave(`booking_${bookingId}`));

  socket.on('send_message', async (data) => {
    const { booking_id, sender_id, content } = data;
    if (!content || !booking_id || !sender_id) return;
    try {
      const [result] = await db.query(
        'INSERT INTO messages (booking_id, sender_id, content) VALUES (?, ?, ?)',
        [booking_id, sender_id, content]
      );
      const [rows] = await db.query(
        'SELECT m.*, u.full_name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?',
        [result.insertId]
      );
      io.to(`booking_${booking_id}`).emit('new_message', rows[0]);
      const [booking] = await db.query('SELECT student_id, tutor_id FROM bookings WHERE id = ?', [booking_id]);
      if (booking.length > 0) {
        const otherId = booking[0].student_id === sender_id ? booking[0].tutor_id : booking[0].student_id;
        const [sender] = await db.query('SELECT full_name FROM users WHERE id = ?', [sender_id]);
        await createNotification(otherId, 'new_message', '💬 New Message', `${sender[0].full_name} sent you a message`);
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  });

  socket.on('disconnect', () => console.log('🔌 Socket disconnected:', socket.id));
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 TutorMatch running on http://localhost:${PORT}`);
});