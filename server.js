const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const { google } = require('googleapis');
require('dotenv').config();

const db = require('./db');
const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static('public'));
app.use(express.static('views'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: false,
    httpOnly: true
  }
}));

// Require login middleware
function requireLogin(req, res, next) {
  console.log('Session check - userId:', req.session.userId);

  if (!req.session.userId) {
    console.log('No session, redirecting to login');
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    return res.redirect('/');
  }
  console.log('Session valid, proceeding');
  next();
}

// Nodemailer transporter
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

// Helper: create notification with booking_id
async function createNotification(userId, type, title, message, bookingId = null) {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message, booking_id) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message, bookingId]
    );
    io.to(`user_${userId}`).emit('new_notification', { type, title, message, booking_id: bookingId });
  } catch (err) {
    console.error('Notification error:', err);
  }
}

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'views', 'forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'views', 'reset-password.html')));
app.get('/dashboard', requireLogin, (req, res) => {
  console.log('Dashboard accessed by user:', req.session.userId);
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});
app.get('/bookings', requireLogin, (req, res) => {
  console.log('Bookings accessed by user:', req.session.userId);
  res.sendFile(path.join(__dirname, 'views', 'bookings.html'));
});
app.get('/profile', requireLogin, (req, res) => {
  console.log('Profile accessed by user:', req.session.userId);
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});
app.get('/messages', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'messages.html')));
app.get('/messages/:id', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'messages.html')));
app.get('/notifications', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'notifications.html')));
app.get('/tutor/:id', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'tutor.html')));
app.get('/tutor-dashboard', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'tutor-dashboard.html')));

// Auth
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
    req.session.role = role;
    console.log('User registered and session created:', result.insertId);
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
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    req.session.userId = user.id;
    req.session.role = user.role;
    console.log('User logged in and session created:', user.id);
    console.log('Session after login:', JSON.stringify(req.session, null, 2));
    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/logout', (req, res) => {
  console.log('User logging out:', req.session.userId);
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, full_name, email, role FROM users WHERE id = ?', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const [users] = await db.query('SELECT id, full_name FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.json({ success: true });
    const user = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
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
      from: `"TutorMatch" <${process.env.MAIL_USER}>`,
      to: email,
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
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const [rows] = await db.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (rows.length === 0)
      return res.status(400).json({ error: 'This link has expired or already been used.' });
    const reset = rows[0];
    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, reset.user_id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

// Search
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
      JOIN tutor_courses tc ON tc.tutor_id = u.id
      LEFT JOIN bookings b ON b.tutor_id = u.id
      LEFT JOIN reviews r ON r.booking_id = b.id
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

// Tutor profile
app.get('/api/tutors/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.full_name, tp.bio, tp.hourly_rate, tp.is_verified,
             COALESCE(AVG(r.rating), 0) AS avg_rating,
             COUNT(DISTINCT r.id) AS review_count
      FROM users u
      JOIN tutor_profiles tp ON tp.user_id = u.id
      LEFT JOIN bookings b ON b.tutor_id = u.id
      LEFT JOIN reviews r ON r.booking_id = b.id
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

// Bookings
app.post('/api/bookings', requireLogin, async (req, res) => {
  const { tutor_id, course_code, scheduled_at, message, session_type } = req.body;
  if (!tutor_id || !course_code || !scheduled_at)
    return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const [result] = await db.query(
      'INSERT INTO bookings (student_id, tutor_id, course_code, scheduled_at, message, session_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.userId, tutor_id, course_code, scheduled_at, message || '', session_type || 'one_on_one', 'unpaid']
    );
    const bookingId = result.insertId;
    const [student] = await db.query('SELECT full_name FROM users WHERE id = ?', [req.session.userId]);
    await createNotification(
      tutor_id, 'booking_request', ' New Booking Request',
      `${student[0].full_name} wants to book a session for ${course_code}`,
      bookingId
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ error: 'Could not create booking.' });
  }
});

app.get('/api/bookings', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*, 
             u.full_name AS tutor_name, 
             tp.hourly_rate, 
             tp.is_verified,
             COALESCE(p.status, 'unpaid') as payment_status,
             p.id as payment_id
      FROM bookings b
      JOIN users u ON u.id = b.tutor_id
      JOIN tutor_profiles tp ON tp.user_id = b.tutor_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.student_id = ?
      ORDER BY b.created_at DESC
    `, [req.session.userId]);

    console.log('Bookings with payment status:', rows.map(b => ({
      id: b.id,
      status: b.status,
      payment_status: b.payment_status,
      canPay: b.status === 'confirmed' && (b.payment_status === 'unpaid' || b.payment_status === 'pending')
    })));

    res.json(rows);
  } catch (err) {
    console.error('Bookings API error:', err);
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

app.post('/api/bookings/:id/payment-success', requireLogin, async (req, res) => {
  try {
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND student_id = ?',
      [req.params.id, req.session.userId]
    );

    if (booking.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query(
      "UPDATE bookings SET payment_status = 'paid' WHERE id = ?",
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile
app.get('/api/profile', requireLogin, async (req, res) => {
  console.log('Profile API accessed by user:', req.session.userId);
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
    console.error('Profile API error:', err);
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

// Course Catalog API
app.get('/api/courses', requireLogin, async (req, res) => {
  console.log('Courses API accessed by user:', req.session.userId);
  try {
    const [courses] = await db.query(
      'SELECT course_code, course_name, department FROM course_catalog ORDER BY course_code'
    );
    console.log(`Found ${courses.length} courses`);
    res.json(courses);
  } catch (err) {
    console.error('Courses API error:', err);
    res.status(500).json({ error: 'Could not load courses' });
  }
});

app.get('/api/professors', requireLogin, async (req, res) => {
  console.log('Professors API accessed by user:', req.session.userId);
  try {
    const [professors] = await db.query(
      'SELECT name, department FROM professors ORDER BY name'
    );
    console.log(`Found ${professors.length} professors`);
    res.json(professors);
  } catch (err) {
    console.error('Professors API error:', err);
    res.status(500).json({ error: 'Could not load professors' });
  }
});

app.get('/api/course/:code', requireLogin, async (req, res) => {
  try {
    const [course] = await db.query(
      'SELECT course_name FROM course_catalog WHERE course_code = ?',
      [req.params.code]
    );
    if (course.length > 0) {
      res.json({ course_name: course[0].course_name });
    } else {
      res.json({ course_name: '' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Could not load course info' });
  }
});

// Tutor dashboard
app.get('/api/tutor-bookings', requireLogin, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.id, b.course_code, b.scheduled_at, b.status, b.message,
             b.session_type, b.created_at, b.payment_status,
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
    const { reason } = req.body;

    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND tutor_id = ? AND status = 'pending'",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Booking not found.' });

    const [booking] = await db.query(
      'SELECT b.*, u.full_name AS tutor_name FROM bookings b JOIN users u ON u.id = b.tutor_id WHERE b.id = ?',
      [req.params.id]
    );

    if (booking.length > 0) {
      const bookingData = booking[0];

      await createNotification(bookingData.student_id, 'booking_declined', '❌ Booking Declined',
        `${bookingData.tutor_name} declined your session for ${bookingData.course_code}`);

      if (reason && reason.trim()) {
        await db.query(
          'INSERT INTO messages (booking_id, sender_id, content) VALUES (?, ?, ?)',
          [req.params.id, req.session.userId, ` Decline Reason: ${reason.trim()}`]
        );

        await createNotification(bookingData.student_id, 'new_message', '💬 Message from Tutor',
          `${bookingData.tutor_name} sent you a message about your ${bookingData.course_code} session`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Decline booking error:', err);
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

app.patch('/api/tutor-bookings/:id/cancel-confirmed', requireLogin, async (req, res) => {
  try {
    const { reason } = req.body;

    const [booking] = await db.query(
      "SELECT b.*, s.full_name AS student_name, s.email AS student_email, t.full_name AS tutor_name FROM bookings b JOIN users s ON s.id = b.student_id JOIN users t ON t.id = b.tutor_id WHERE b.id = ? AND b.tutor_id = ? AND b.status = 'confirmed'",
      [req.params.id, req.session.userId]
    );

    if (booking.length === 0) {
      return res.status(400).json({ error: 'Booking not found or not confirmed by you.' });
    }

    const bookingData = booking[0];

    const [result] = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND tutor_id = ? AND status = 'confirmed'",
      [req.params.id, req.session.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Could not cancel booking.' });
    }

    await createNotification(
      bookingData.student_id,
      'session_cancelled',
      '⚠️ Session Canceled by Tutor',
      `${bookingData.tutor_name} had to cancel your ${bookingData.course_code} session`
    );

    if (reason && reason.trim()) {
      await db.query(
        'INSERT INTO messages (booking_id, sender_id, content) VALUES (?, ?, ?)',
        [req.params.id, req.session.userId, `⚠️ Session Cancellation: ${reason.trim()}`]
      );

      await createNotification(
        bookingData.student_id,
        'new_message',
        '💬 Cancellation Message',
        `${bookingData.tutor_name} sent you a message about your ${bookingData.course_code} session cancellation`
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel confirmed booking error:', err);
    res.status(500).json({ error: 'Could not cancel session.' });
  }
});

// Reviews
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
      JOIN users u ON u.id = b.student_id
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

// Notifications
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

// Messages
app.get('/api/conversations', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [rows] = await db.query(`
      SELECT 
        b.id AS booking_id, 
        b.course_code, 
        b.status, 
        b.session_type,
        b.created_at,
        CASE WHEN b.student_id = ? THEN tutor.full_name ELSE student.full_name END AS other_name,
        CASE WHEN b.student_id = ? THEN b.tutor_id ELSE b.student_id END AS other_id,
        CASE WHEN b.student_id = ? THEN tutor.full_name ELSE student.full_name END AS tutor_name,
        CASE WHEN b.student_id = ? THEN student.full_name ELSE tutor.full_name END AS student_name,
        (SELECT content FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM messages WHERE booking_id = b.id AND sender_id != ? AND read_at IS NULL) AS unread_count
      FROM bookings b
      JOIN users student ON student.id = b.student_id
      JOIN users tutor ON tutor.id = b.tutor_id
      WHERE (b.student_id = ? OR b.tutor_id = ?) 
        AND (
          b.status IN ('confirmed', 'completed') 
          OR (b.status = 'cancelled' AND EXISTS (SELECT 1 FROM messages WHERE booking_id = b.id))
        )
      ORDER BY 
        COALESCE(last_message_at, b.created_at) DESC
    `, [userId, userId, userId, userId, userId, userId, userId]);

    console.log(`Conversations for user ${userId}:`, rows);
    res.json(rows);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

app.get('/api/conversations/:bookingId/messages', requireLogin, async (req, res) => {
  try {
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND (student_id = ? OR tutor_id = ?)',
      [req.params.bookingId, req.session.userId, req.session.userId]
    );

    if (booking.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [messages] = await db.query(
      'SELECT * FROM messages WHERE booking_id = ? ORDER BY created_at ASC',
      [req.params.bookingId]
    );

    const [bookingDetails] = await db.query(`
      SELECT b.*, s.full_name as student_name, t.full_name as tutor_name
      FROM bookings b
      JOIN users s ON s.id = b.student_id
      JOIN users t ON t.id = b.tutor_id  
      WHERE b.id = ?
    `, [req.params.bookingId]);

    res.json({
      booking: bookingDetails[0],
      messages: messages
    });
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Could not load messages' });
  }
});

app.post('/api/conversations/send', requireLogin, async (req, res) => {
  try {
    const { booking_id, content } = req.body;

    if (!booking_id || !content || !content.trim()) {
      return res.status(400).json({ error: 'Missing booking_id or content' });
    }

    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND (student_id = ? OR tutor_id = ?)',
      [booking_id, req.session.userId, req.session.userId]
    );

    if (booking.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (booking_id, sender_id, content) VALUES (?, ?, ?)',
      [booking_id, req.session.userId, content.trim()]
    );

    const [newMessage] = await db.query(`
      SELECT m.*, u.full_name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `, [result.insertId]);

    const bookingData = booking[0];
    const recipientId = req.session.userId === bookingData.student_id ? bookingData.tutor_id : bookingData.student_id;

    if (io) {
      io.to(`user_${recipientId}`).emit('new_message', {
        booking_id: booking_id,
        message: newMessage[0]
      });
    }

    const [sender] = await db.query('SELECT full_name FROM users WHERE id = ?', [req.session.userId]);
    await createNotification(
      recipientId,
      'new_message',
      '💬 New Message',
      `${sender[0].full_name} sent you a message`,
      booking_id
    );

    res.json({ success: true, message: newMessage[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Could not send message' });
  }
});

app.post('/api/conversations/:bookingId/read', requireLogin, async (req, res) => {
  try {
    await db.query(
      'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND sender_id != ? AND read_at IS NULL',
      [req.params.bookingId, req.session.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Could not mark as read' });
  }
});

// Google OAuth helpers
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
        access_token = VALUES(access_token),
        refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
        expiry_date = VALUES(expiry_date)
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
           t.full_name AS tutor_name, t.email AS tutor_email
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
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const startTime = new Date(bk.scheduled_at);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  const sessionLabel = { one_on_one: '1-on-1 Session', group: 'Group Session', resources: 'Resources Session' }[bk.session_type] || 'Session';
  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `TutorMatch — ${bk.course_code} ${sessionLabel}`,
      description: `Tutoring session via TutorMatch.\nTutor: ${bk.tutor_name}\nStudent: ${bk.student_name}\nCourse: ${bk.course_code}`,
      start: { dateTime: startTime.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: endTime.toISOString(), timeZone: 'America/New_York' },
      attendees: [{ email: bk.student_email }, { email: bk.tutor_email }],
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] }
    }
  });
}

// STAGE 9: STRIPE PAYMENT MOCK
app.post('/api/payments/process', requireLogin, async (req, res) => {
  const { booking_id, payment_method, amount } = req.body;

  if (!booking_id || !payment_method || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [bookings] = await db.query(`
      SELECT b.*, s.full_name AS student_name, s.email AS student_email,
             t.full_name AS tutor_name, t.email AS tutor_email, tp.hourly_rate
      FROM bookings b
      JOIN users s ON s.id = b.student_id  
      JOIN users t ON t.id = b.tutor_id
      JOIN tutor_profiles tp ON tp.user_id = b.tutor_id
      WHERE b.id = ? AND b.student_id = ? AND b.status = 'confirmed'
    `, [booking_id, req.session.userId]);

    if (bookings.length === 0) {
      return res.status(400).json({ error: 'Booking not found or not confirmed' });
    }

    const booking = bookings[0];

    await new Promise(resolve => setTimeout(resolve, 1500));

    const shouldFail = Math.random() < 0.05;

    if (shouldFail) {
      return res.status(400).json({
        error: 'Payment failed',
        code: 'card_declined',
        message: 'Your card was declined. Please try a different payment method.'
      });
    }

    const paymentId = `pay_mock_${crypto.randomBytes(12).toString('hex')}`;

    await db.query(`
      INSERT INTO payments (booking_id, student_id, tutor_id, amount, stripe_payment_id, status, payment_method_last4)
      VALUES (?, ?, ?, ?, ?, 'paid', ?)
    `, [booking_id, req.session.userId, booking.tutor_id, amount, paymentId, payment_method.last4]);

    await db.query(
      "UPDATE bookings SET payment_status = 'paid' WHERE id = ?",
      [booking_id]
    );

    await sendPaymentReceipt(booking, amount, paymentId);

    await createNotification(
      booking.tutor_id,
      'payment_received',
      '💰 Payment Received',
      `${booking.student_name} paid $${amount} for ${booking.course_code} session`
    );

    res.json({
      success: true,
      payment_id: paymentId,
      amount: amount
    });

  } catch (err) {
    console.error('Payment processing error:', err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

app.get('/api/payments', requireLogin, async (req, res) => {
  try {
    const [payments] = await db.query(`
      SELECT p.*, b.course_code, b.scheduled_at,
             CASE 
               WHEN p.student_id = ? THEN t.full_name
               ELSE s.full_name 
             END AS other_party_name
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      JOIN users s ON s.id = p.student_id
      JOIN users t ON t.id = p.tutor_id
      WHERE p.student_id = ? OR p.tutor_id = ?
      ORDER BY p.created_at DESC
    `, [req.session.userId, req.session.userId, req.session.userId]);

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Could not load payments' });
  }
});

async function sendPaymentReceipt(booking, amount, paymentId) {
  try {
    await transporter.sendMail({
      from: `"TutorMatch" <${process.env.MAIL_USER}>`,
      to: booking.student_email,
      subject: `Payment Receipt - ${booking.course_code} Session`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1428;color:#e8eaf6;border-radius:16px;padding:32px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h2 style="color:#F76900;margin:0;">TutorMatch</h2>
            <p style="color:#6b7499;font-size:0.85rem;margin:4px 0 0;">Payment Receipt</p>
          </div>
          
          <div style="background:rgba(247,105,0,0.1);border:1px solid rgba(247,105,0,0.3);border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="color:#F76900;margin:0 0 12px;">✅ Payment Successful</h3>
            <p style="color:#aaa;margin:0;">Your payment has been processed successfully.</p>
          </div>

          <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:20px;">
            <h4 style="color:#fff;margin:0 0 16px;">Session Details</h4>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#aaa;">Course:</span>
              <span style="color:#F76900;font-weight:600;">${booking.course_code}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#aaa;">Tutor:</span>
              <span style="color:#fff;">${booking.tutor_name}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#aaa;">Date:</span>
              <span style="color:#fff;">${new Date(booking.scheduled_at).toLocaleDateString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#aaa;">Time:</span>
              <span style="color:#fff;">${new Date(booking.scheduled_at).toLocaleTimeString()}</span>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:24px;">
            <h4 style="color:#fff;margin:0 0 16px;">Payment Summary</h4>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#aaa;">Session fee:</span>
              <span style="color:#fff;">$${amount}</span>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:12px;display:flex;justify-content:space-between;">
              <span style="color:#fff;font-weight:600;">Total paid:</span>
              <span style="color:#F76900;font-weight:700;font-size:1.1rem;">$${amount}</span>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:24px;">
            <p style="color:#6b7499;font-size:0.8rem;margin:0;">
              <strong style="color:#aaa;">Payment ID:</strong> ${paymentId}<br>
              <strong style="color:#aaa;">Date:</strong> ${new Date().toLocaleDateString()}
            </p>
          </div>

          <div style="text-align:center;">
            <p style="color:#6b7499;font-size:0.85rem;margin-bottom:16px;">
              Your session is now fully confirmed. Check your calendar or chat with your tutor!
            </p>
            <a href="http://localhost:3000/bookings" 
               style="background:#F76900;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:0.9rem;display:inline-block;">
              View My Bookings
            </a>
          </div>

          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
          <p style="color:#6b7499;font-size:0.75rem;text-align:center;">
            TutorMatch · Syracuse University · #OrangeNation
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error('Receipt email error:', err);
  }
}

// Socket.io
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('join_user', (userId) => socket.join(`user_${userId}`));
  socket.on('join_booking', (bookingId) => socket.join(`booking_${bookingId}`));
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

  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

// Start
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 TutorMatch running on http://localhost:${PORT}`);
  console.log(`Session secret configured: ${process.env.SESSION_SECRET ? 'YES' : 'NO (using fallback)'}`);
  console.log(`Email configured: ${process.env.MAIL_USER ? 'YES' : 'NO'}`);
  console.log(`Database connection: Check startup logs above`);
});