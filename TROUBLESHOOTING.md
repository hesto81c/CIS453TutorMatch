# 🔧 TutorMatch — Troubleshooting Guide

Comprehensive troubleshooting guide for common issues when running TutorMatch on Windows with Node.js + MySQL.

---

## 📋 Table of Contents

1. [Server won't start](#1-server-wont-start)
2. [MySQL / database errors](#2-mysql--database-errors)
3. [Login and session errors](#3-login-and-session-errors)
4. [Search returns no results](#4-search-returns-no-results)
5. [Real-time chat not working](#5-real-time-chat-not-working)
6. [Notifications not appearing](#6-notifications-not-appearing)
7. [Port 3000 issues](#7-port-3000-issues)
8. [node_modules errors](#8-node_modules-errors)
9. [Environment variables not loading](#9-environment-variables-not-loading)
10. [Visual issues / CSS not loading](#10-visual-issues--css-not-loading)
11. [Payment system issues](#11-payment-system-issues)
12. [Google Calendar integration problems](#12-google-calendar-integration-problems)
13. [Email system not working](#13-email-system-not-working)
14. [Messages and chat problems](#14-messages-and-chat-problems)
15. [How to view server logs](#15-how-to-view-server-logs)
16. [Useful diagnostic commands](#16-useful-diagnostic-commands)

---

## 1. Server won't start

### ❌ Error: `Cannot find module 'express'`

**Cause:** The `node_modules` folder doesn't exist or is incomplete (happens after formatting PC or cloning the repository).

**Solution:**
```powershell
cd D:\tutormatch
npm install
```

---

### ❌ Error: `Cannot find module './db'`

**Cause:** The `db.js` file doesn't exist in the project root.

**Solution:** Verify that `D:\tutormatch\db.js` exists. Correct content:

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
```

---

### ❌ Error: `Error: listen EADDRINUSE :::3000`

**Cause:** Port 3000 is already being used by another process (a previous server instance that didn't close properly).

**Solution A — Kill the process on port 3000:**
```powershell
netstat -ano | findstr :3000
# Note the PID from the result (last number)
taskkill /PID <pid_number> /F
```

**Solution B — Change the port in `.env`:**
```env
PORT=3001
```
Then open `http://localhost:3001`.

---

### ❌ Error: `SyntaxError: Unexpected token`

**Cause:** There's a syntax error in `server.js` or another JS file.

**Solution:** Read the error message — it tells you exactly the file and line. Look for a missing comma, unclosed parenthesis, or misplaced quote.

---

### ❌ Server starts but browser shows "This site can't be reached"

**Cause:** The server isn't running, or it's on a different port.

**Solution:**
1. Verify the terminal shows `🚀 TutorMatch running on http://localhost:3000`
2. If it doesn't show this, the server didn't start — read the error in the terminal
3. Make sure to open `http://localhost:3000` (not `https://`)

---

## 2. MySQL / database errors

### ❌ Error: `Access denied for user 'root'@'localhost'`

**Cause:** The MySQL password in `.env` is incorrect.

**Solution:**
1. Verify your password by opening MySQL manually:
```powershell
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
.\mysql.exe -u root -p
# Enter your password
```
2. If it connects, update `.env` with the correct password:
```env
DB_PASSWORD="your_correct_password"
```

---

### ❌ Error: `Unknown database 'tutormatch'`

**Cause:** The `tutormatch` database wasn't created in MySQL.

**Solution:**
```powershell
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
.\mysql.exe -u root -p
```
```sql
CREATE DATABASE tutormatch;
exit;
```
Then run the table creation script from the README again.

---

### ❌ Error: `Table 'tutormatch.notifications' doesn't exist`

**Cause:** The notifications table wasn't created (added in Stage 6c).

**Solution:**
```sql
USE tutormatch;
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT DEFAULT 0,
  booking_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

---

### ❌ Error: `Table 'tutormatch.payments' doesn't exist`

**Cause:** The payment system tables weren't created (added in Stage 9).

**Solution:**
```sql
USE tutormatch;

-- Add payment status to bookings
ALTER TABLE bookings ADD COLUMN payment_status ENUM('pending','paid','failed') DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN hourly_rate DECIMAL(6,2) DEFAULT 25.00;

-- Create payments table
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(8,2) NOT NULL,
  payment_method_type ENUM('credit-card','google-pay','apple-pay','paypal') NOT NULL,
  payment_method_last4 VARCHAR(4),
  payment_method_name VARCHAR(100),
  status ENUM('pending','completed','failed') DEFAULT 'pending',
  stripe_payment_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

---

### ❌ Error: `ECONNREFUSED` when connecting to MySQL

**Cause:** The MySQL service isn't running in Windows.

**Solution:**
1. Press `Win + R` → type `services.msc` → Enter
2. Find **MySQL80** in the list
3. Right-click → **Start**
4. Restart the Node server: `Ctrl + C` → `nodemon server.js`

Or from PowerShell (as Administrator):
```powershell
net start MySQL80
```

---

### ❌ Error: `ER_NOT_SUPPORTED_AUTH_MODE`

**Cause:** MySQL 8 uses a different authentication method that mysql2 sometimes doesn't support.

**Solution:** In MySQL, execute:
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

---

### ❌ Want to see what's in the database

```powershell
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
.\mysql.exe -u root -p tutormatch
```
```sql
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM bookings;
SELECT * FROM notifications;
SELECT * FROM payments;
```

---

## 3. Login and session errors

### ❌ Login says "Invalid email or password" but credentials are correct

**Cause A:** The user doesn't exist in the database.

**Solution:** Check in MySQL:
```sql
SELECT email, role FROM users;
```
If it doesn't appear, register at `/register`.

**Cause B:** The password was hashed with a different version of bcrypt.

**Solution:** Create the user again from the registration form.

---

### ❌ After login, redirects back to login (loop)

**Cause:** The session isn't being saved (problem with `SESSION_SECRET` or cookie configuration).

**Solution:**
1. Verify that `SESSION_SECRET` is defined in `.env`
2. Verify that `server.js` has the correct session configuration:
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));
```
3. Make sure `app.use(session(...))` is **before** the routes.

---

### ❌ Session is lost when refreshing the page

**Cause:** `nodemon` restarted the server (it does this automatically when saving files), which clears all in-memory sessions.

**Solution:** This is normal in development. Just login again. In production, a persistent session store would be used.

---

## 4. Search returns no results

### ❌ I search for "CSE 274" and nothing appears

**Cause A:** There are no tutors with that course in the database.

**Solution:** Login as a tutor (alexa@syr.edu / tutor123), go to **My Profile** and add the course CSE 274.

**Cause B:** Search requires minimum 2 characters.

**Solution:** Type at least 2 letters before searching.

**Cause C:** The tutor doesn't have a `tutor_profile` in the database.

**Solution:**
```sql
SELECT u.email, tp.id FROM users u
LEFT JOIN tutor_profiles tp ON tp.user_id = u.id
WHERE u.role = 'tutor';
```
If `tp.id` is NULL for a tutor, insert manually:
```sql
INSERT INTO tutor_profiles (user_id, bio, hourly_rate)
SELECT id, '', 25.00 FROM users WHERE email = 'alexa@syr.edu';
```

---

## 5. Real-time chat not working

### ❌ Messages don't appear without refreshing the page

**Cause A:** Socket.io isn't loading in the browser.

**Solution:** Open DevTools (F12) → Console. If you see `socket is not defined` or a 404 error for `/socket.io/socket.io.js`, the server isn't serving Socket.io correctly.

Verify that in `server.js` the HTTP server is configured like this:
```javascript
const http        = require('http');
const { Server }  = require('socket.io');
const httpServer  = http.createServer(app);
const io          = new Server(httpServer);
// ...
httpServer.listen(PORT, ...);  // ← NOT app.listen()
```

**Cause B:** Chat only works for bookings with status `confirmed`, `completed`, or `cancelled` (with messages). If the booking is in `pending`, it won't appear in Messages.

**Solution:** Login as a tutor in Tutor Dashboard and confirm the booking.

---

### ❌ Socket connects but messages don't reach the other user

**Cause:** The user didn't join the booking room (`join_booking`).

**Solution:** Make sure `messages.js` emits `join_booking` when opening a chat:
```javascript
socket.emit('join_booking', bookingId);
```

---

## 6. Notifications not appearing

### ❌ Notification badge always shows 0

**Cause A:** The `notifications` table doesn't exist.

**Solution:** Execute in MySQL:
```sql
SHOW TABLES LIKE 'notifications';
```
If it doesn't appear, create it (see section 2).

**Cause B:** Notifications aren't being created when confirming bookings.

**Solution:** Verify in `server.js` that the `createNotification()` function is being called within the confirm/decline/complete routes.

---

### ❌ Notifications appear on the page but badge doesn't update

**Cause:** The badge refreshes every 30 seconds + real-time via socket. If the socket isn't connected, it only updates by polling.

**Solution:** Open DevTools → Network → look for WebSocket connection to `socket.io`. If it doesn't exist, there's a Socket.io problem (see section 5).

---

## 7. Port 3000 issues

### ❌ Port 3000 occupied at startup

```powershell
# See what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace XXXX with the PID)
taskkill /PID XXXX /F
```

### ❌ I want to use another port

In `.env`:
```env
PORT=3001
```
Access at `http://localhost:3001`.

---

## 8. node_modules errors

### ❌ `npm install` fails or gives permission errors

**Solution:** Run PowerShell **as Administrator**:
```powershell
cd D:\tutormatch
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

---

### ❌ `npm install` gives Node version error

**Solution:** Check your Node version:
```powershell
node --version
```
You need v18 or higher. Download the LTS version from [nodejs.org](https://nodejs.org).

---

### ❌ bcrypt gives compilation error on install (native compilation error)

**Cause:** bcrypt requires native compilation on Windows.

**Solution:**
```powershell
npm install --global --production windows-build-tools
npm install bcrypt
```
Or use `bcryptjs` (no native compilation) as alternative:
```powershell
npm uninstall bcrypt
npm install bcryptjs
```
And in `server.js` change:
```javascript
const bcrypt = require('bcryptjs');  // instead of 'bcrypt'
```

---

## 9. Environment variables not loading

### ❌ Environment variables are `undefined`

**Cause A:** The `.env` file isn't in the project root (`D:\tutormatch\.env`), not inside any subfolder.

**Cause B:** `require('dotenv').config()` isn't at the beginning of `server.js`.

**Solution:** Verify that `server.js` begins with:
```javascript
require('dotenv').config();
```
This line must be the **first** or second in the file, before using any `process.env`.

**Cause C:** The file is named `.env.txt` instead of `.env` (Windows hides extensions by default).

**Solution:** In VS Code, the file should appear as `.env` with no visible extension. In Windows Explorer, enable "Show file name extensions".

---

## 10. Visual issues / CSS not loading

### ❌ Page looks unstyled (plain text only)

**Cause:** CSS files aren't in `public/css/` or Express isn't serving the `public` folder.

**Solution:** Verify in `server.js`:
```javascript
app.use(express.static('public'));
```
This line must be **before** the routes.

---

### ❌ I changed CSS but changes don't show

**Cause:** The browser has cached CSS.

**Solution:** Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac).

---

### ❌ Logo doesn't appear

**Cause:** The `logo.png` file isn't at `D:\tutormatch\public\logo.png`.

**Solution:** Copy your logo file there. It must be named exactly `logo.png`.

---

## 11. Payment system issues

### ❌ "Pay Now" button doesn't appear on confirmed sessions

**Cause A:** The payment modal container doesn't exist in the HTML.

**Solution:** Verify that `bookings.html` has:
```html
<!-- Before </body> -->
<div id="payment-modal-container"></div>
```

**Cause B:** The booking doesn't have `payment_status = 'pending'`.

**Solution:** Check in MySQL:
```sql
SELECT id, status, payment_status FROM bookings WHERE status = 'confirmed';
```
If `payment_status` is NULL or 'paid', the button won't show.

---

### ❌ Error "payment-modal-container not found"

**Cause:** JavaScript can't find the modal container.

**Solution:** Make sure the container is **after** the main content and **before** the script tag:
```html
  </main>
</div>

<!-- Payment Modal Container -->
<div id="payment-modal-container"></div>

<script src="/js/bookings.js"></script>
```

---

### ❌ Payment logos don't load

**Cause:** CDN logos are blocked or slow to load.

**Solution:** The modal includes fallback handling. If a logo fails, it shows the payment method name instead. Check DevTools → Network for 404 errors on image URLs.

---

### ❌ NY tax calculation is wrong

**Cause:** Tax is hardcoded as 8.25% for NY residents.

**Solution:** The tax calculation is:
```javascript
const nyTax = subtotal * 0.0825; // 8.25% NY tax
```
Example: $25.00 + $2.06 (tax) = $27.06 total.

---

## 12. Google Calendar integration problems

### ❌ Error "Google Calendar not configured"

**Cause:** Google OAuth credentials aren't set in `.env`.

**Solution:** Add to `.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```
Get these from [Google Cloud Console](https://console.cloud.google.com/).

---

### ❌ OAuth redirect error "redirect_uri_mismatch"

**Cause:** The redirect URI in Google Console doesn't match the one in `.env`.

**Solution:** In Google Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Add URI:
```
http://localhost:3000/auth/google/callback
```

---

### ❌ Error "insufficient_scope" when adding calendar events

**Cause:** The OAuth scope doesn't include calendar write permissions.

**Solution:** Verify in `server.js`:
```javascript
const scopes = ['https://www.googleapis.com/auth/calendar'];
```

---

## 13. Email system not working

### ❌ Error "Invalid login" when sending emails

**Cause A:** Gmail credentials in `.env` are incorrect.

**Solution:** Verify your Gmail and App Password:
1. Go to Gmail → Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP
2. Go to Google Account → Security → 2-Step Verification → App passwords
3. Generate a new app password and use it in `.env`:
```env
MAIL_USER=your.email@gmail.com
MAIL_PASS=your-16-character-app-password
```

**Cause B:** Gmail account has 2FA disabled.

**Solution:** Enable 2-Factor Authentication in your Google Account, then generate an App Password.

---

### ❌ Password reset emails aren't arriving

**Cause:** Emails might be going to spam folder.

**Solution:**
1. Check the spam/junk folder
2. Add your app email to the address book
3. Check server logs for SMTP errors

---

## 14. Messages and chat problems

### ❌ Decline/cancel messages don't appear in chat

**Cause:** The conversations endpoint isn't including cancelled sessions with messages.

**Solution:** Verify the `/api/conversations` endpoint includes:
```sql
WHERE (b.student_id = ? OR b.tutor_id = ?) 
  AND (
    b.status IN ('confirmed', 'completed') 
    OR (b.status = 'cancelled' AND EXISTS (SELECT 1 FROM messages WHERE booking_id = b.id))
  )
```

---

### ❌ Messages show as unread even after opening

**Cause:** The read status isn't being updated.

**Solution:** Check if the `messages` table has the `read_at` column:
```sql
ALTER TABLE messages ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL;
```

---

### ❌ Chat doesn't scroll to latest message

**Cause:** JavaScript scroll function isn't working.

**Solution:** Check `messages.js` has:
```javascript
const messagesContainer = document.getElementById('chatMessages');
messagesContainer.scrollTop = messagesContainer.scrollHeight;
```

---

## 15. How to view server logs

The server prints useful information in the VS Code terminal:

```
🚀 TutorMatch running on http://localhost:3000   ← Started successfully
🔌 Socket connected: abc123                       ← User connected via socket
📧 Password reset email sent to user@email.com   ← Email sent
💳 Payment processed: booking_id=6, amount=$27.06 ← Payment completed
```

If there's an error in an API route, it will appear in the terminal with the complete stack trace.

To see **browser** errors (frontend):
1. Open DevTools with `F12`
2. Go to **Console** tab
3. Red errors are from frontend JavaScript

To see HTTP requests:
1. DevTools → **Network** tab
2. Filter by **Fetch/XHR** to see API calls

---

## 16. Useful diagnostic commands

### Verify Node is installed
```powershell
node --version
npm --version
```

### Verify MySQL is running
```powershell
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
.\mysql.exe -u root -p -e "SHOW DATABASES;"
```

### View all database tables
```sql
USE tutormatch;
SHOW TABLES;
```

### View all registered users
```sql
SELECT id, full_name, email, role FROM users;
```

### View all bookings with status
```sql
SELECT b.id, u_s.email AS student, u_t.email AS tutor, b.status, b.payment_status, b.course_code
FROM bookings b
JOIN users u_s ON u_s.id = b.student_id
JOIN users u_t ON u_t.id = b.tutor_id;
```

### View recent messages
```sql
SELECT m.content, u.email AS sender, b.course_code, m.created_at
FROM messages m
JOIN users u ON u.id = m.sender_id
JOIN bookings b ON b.id = m.booking_id
ORDER BY m.created_at DESC
LIMIT 10;
```

### View payment records
```sql
SELECT p.id, b.course_code, p.amount, p.payment_method_type, p.status, p.created_at
FROM payments p
JOIN bookings b ON b.id = p.booking_id
ORDER BY p.created_at DESC;
```

### Clear all notifications (for testing)
```sql
DELETE FROM notifications;
```

### Reset a user's password (for testing)
```sql
-- Set password to 'password123'
UPDATE users SET password_hash = '$2b$10$K9lHjKZGqPY2aB3R4N6F7uOqXwR5S8TvUgHnPmNyJsL6VxCzBnMoK' WHERE email = 'student@syr.edu';
```

### Restart the server (in VS Code terminal)
```
Ctrl + C     ← Stop
nodemon server.js   ← Start again
```

### See what process is using port 3000
```powershell
netstat -ano | findstr :3000
```

### Kill a process by PID
```powershell
taskkill /PID <number> /F
```

### Reinstall all dependencies from scratch
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Check Google Calendar API quota
```sql
SELECT user_id, COUNT(*) as events_created 
FROM google_tokens 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY user_id;
```

### View email logs (if implemented)
```sql
SELECT * FROM password_resets WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

---

## 🆘 If nothing works

1. **Read the complete error** — the error message always says exactly what failed and on which line.
2. **Check the `.env`** — 80% of connection problems are incorrect password or missing variable.
3. **Verify MySQL is running** — `services.msc` → MySQL80 → Start.
4. **Delete `node_modules` and reinstall** — `npm install` from scratch.
5. **Hard refresh the browser** — `Ctrl + Shift + R`.
6. **Check the server logs** — VS Code terminal shows all backend errors.
7. **Check browser console** — F12 → Console shows all frontend errors.

---

## 🐛 Common Error Patterns

### "Cannot read property 'X' of null"
**Cause:** DOM element not found  
**Solution:** Check element ID/class name, ensure HTML is loaded

### "fetch is not defined"
**Cause:** Using fetch in Node.js (server-side)  
**Solution:** Use axios or node-fetch for server-side HTTP requests

### "Headers already sent"
**Cause:** Sending response twice in Express route  
**Solution:** Check for multiple `res.send()` or `res.json()` calls

### "JSON.parse unexpected token"
**Cause:** Trying to parse non-JSON string  
**Solution:** Check API response format, add error handling

### "CORS error"
**Cause:** Cross-origin request blocked  
**Solution:** Add CORS middleware or ensure same origin

---

*TutorMatch · CIS 453 · Syracuse University · Spring 2026 · #OrangeNation 🍊*