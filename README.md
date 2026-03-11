# 🍊 TutorMatch

> **CIS 453 — Killer App Project · Syracuse University · Spring 2026**

TutorMatch is a web platform that connects Syracuse University students with tutors to book tutoring sessions, chat in real-time, and manage their classes.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript (Vanilla) |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Database | MySQL 8.0 |
| Authentication | express-session + bcrypt |
| Email | nodemailer + Gmail SMTP |
| Calendar | Google Calendar API (OAuth 2.0) |
| Payments | Stripe Mock (Multiple methods) |
| Config | dotenv |
| Dev server | nodemon |

---

## 📋 Prerequisites

Before running the project you need to have installed:

- [Node.js](https://nodejs.org/) v18 or higher
- [MySQL 8.0](https://dev.mysql.com/downloads/)
- [VS Code](https://code.visualstudio.com/) (recommended)

---

## ⚙️ Installation from scratch

### 1. Clone / open the project

```powershell
# If you have the files in D:\tutormatch, just open VS Code:
code D:\tutormatch

# Or if you use Git:
git clone <repo-url>
cd tutormatch
```

### 2. Install dependencies

```powershell
npm install
```

This installs: `express`, `express-session`, `bcrypt`, `mysql2`, `socket.io`, `dotenv`, `googleapis`, `nodemailer`.

### 3. Configure environment variables

Create the `.env` file in the project root with this content:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD="YOUR_MYSQL_PASSWORD"
DB_NAME=tutormatch

# App Configuration
SESSION_SECRET=tutormatch_secret_key_2024
PORT=3000

# Email Configuration (Gmail)
MAIL_USER=your.email@gmail.com
MAIL_PASS=your-app-password

# Google Calendar API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

> ⚠️ **Never upload the `.env` file to GitHub.** It's in the `.gitignore`.

### 4. Create the database in MySQL

Open MySQL in PowerShell:

```powershell
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
.\mysql.exe -u root -p
```

Then execute:

```sql
CREATE DATABASE tutormatch;
USE tutormatch;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'tutor') NOT NULL,
  university VARCHAR(100) DEFAULT 'Syracuse University',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tutor profiles
CREATE TABLE tutor_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  bio TEXT,
  hourly_rate DECIMAL(6,2) DEFAULT 25.00,
  is_verified TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tutor courses
CREATE TABLE tutor_courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tutor_id INT NOT NULL,
  course_code VARCHAR(20) NOT NULL,
  course_name VARCHAR(100) NOT NULL,
  professor VARCHAR(100),
  grade VARCHAR(5),
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bookings with payment support
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  tutor_id INT NOT NULL,
  course_code VARCHAR(20) NOT NULL,
  scheduled_at DATETIME,
  status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  message TEXT,
  session_type ENUM('one_on_one','group','resources') DEFAULT 'one_on_one',
  payment_status ENUM('pending','paid','failed') DEFAULT 'pending',
  hourly_rate DECIMAL(6,2) DEFAULT 25.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reviews
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Messages with read status
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications with booking reference
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

-- Payment system
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

-- Password reset system
CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  token VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Google Calendar integration
CREATE TABLE google_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

exit;
```

### 5. Install nodemon (recommended)

```powershell
npm install -g nodemon
```

### 6. Start the server

```powershell
nodemon server.js
```

Or without nodemon:

```powershell
node server.js
```

You should see:

```
🚀 TutorMatch running on http://localhost:3000
```

Open `http://localhost:3000` in the browser. ✅

---

## 👤 Test accounts

| Name | Email | Password | Role |
|---|---|---|---|
| Student Account | student@syr.edu | student123 | Student |
| Alexa Gramm | alexa@syr.edu | tutor123 | Tutor |
| Alex Johnson | alex@syr.edu | tutor123 | Tutor |

---

## 🎉 Completed Features

### ✅ **Stage 1-6c: Core Platform**
- User registration and login system
- Tutor search and booking system
- Real-time chat with Socket.io
- In-app notifications system
- Review and rating system
- Tutor dashboard with booking management

### ✅ **Stage 7: Google Calendar Integration**
- OAuth 2.0 authentication with Google
- Automatic event creation in Google Calendar
- Calendar sync for confirmed sessions
- Token management and refresh

### ✅ **Stage 8: Mobile Responsive Design**
- Responsive CSS with Syracuse University colors
- Mobile breakpoints (768px / 480px)
- Touch-friendly interface
- Orange (#F76900) and Navy (#000E54) branding

### ✅ **Stage 9: Payment System**
- Multiple payment methods (Google Pay, Apple Pay, PayPal, Cards)
- NY State Tax calculation (8.25%)
- Real company logos from CDN
- Stripe mock integration
- Payment status tracking

### ✅ **Advanced Features**
- **Forgot Password:** Email-based password reset with nodemailer
- **Messages System:** Real-time chat with decline reason messages
- **Cancel Confirmed Sessions:** Tutors can cancel confirmed bookings
- **Course Dropdowns:** Popular Syracuse courses pre-loaded
- **Recent Searches:** Personalized search history per user
- **Icon Standardization:** Consistent emoji icons across all pages

---

## 📁 Project structure

```
D:\tutormatch\
├── server.js                   ← Express server + Socket.io + all routes
├── db.js                       ← MySQL connection (pool)
├── .env                        ← Environment variables (DO NOT upload to Git)
├── package.json
├── public/
│   ├── logo.png
│   ├── css/
│   │   ├── styles.css          ← Global styles (navbar, sidebar, footer)
│   │   ├── dashboard.css       ← Search + tutor cards
│   │   ├── tutor.css           ← Tutor profile + booking modal
│   │   ├── bookings.css        ← Bookings list + payment modal + reviews
│   │   ├── profile.css         ← Profile editing (bio, courses)
│   │   ├── messages.css        ← Chat layout
│   │   ├── notifications.css   ← Notifications + badge
│   │   └── syracuse-background.css ← Syracuse University branding
│   └── js/
│       ├── login.js
│       ├── register.js
│       ├── dashboard.js        ← Tutor search with recent searches
│       ├── tutor.js            ← Tutor profile + booking modal
│       ├── bookings.js         ← Bookings + payment modal + reviews
│       ├── profile.js          ← Profile editing (tutor/student)
│       ├── tutor-dashboard.js  ← Tutor dashboard with cancel feature
│       ├── messages.js         ← Real-time chat with decline messages
│       └── notifications.js    ← Notifications page
└── views/
    ├── login.html              ← Login with forgot password
    ├── register.html
    ├── dashboard.html          ← Search with recent searches
    ├── tutor.html              ← Tutor profile with Google Calendar
    ├── bookings.html           ← Bookings with payment modal
    ├── profile.html            ← Profile editing
    ├── tutor-dashboard.html    ← Tutor dashboard with cancel
    ├── messages.html           ← Chat with decline messages
    └── notifications.html      ← Notifications
```

---

## 🗺️ API Routes

### Auth & Security
| Method | Route | Description |
|---|---|---|
| POST | `/api/register` | User registration |
| POST | `/api/login` | Login |
| GET | `/logout` | Logout |
| GET | `/api/me` | Current session user |
| POST | `/api/forgot-password` | Request password reset |
| POST | `/api/reset-password` | Reset password with token |

### Search and Tutors
| Method | Route | Description |
|---|---|---|
| GET | `/api/search?q=` | Search tutors by course/professor |
| GET | `/api/tutors/:id` | Complete tutor profile |
| GET | `/api/tutors/:id/reviews` | Tutor reviews |

### Bookings & Sessions
| Method | Route | Description |
|---|---|---|
| POST | `/api/bookings` | Create new booking |
| GET | `/api/bookings` | My bookings (student) |
| PATCH | `/api/bookings/:id/cancel` | Cancel booking |
| GET | `/api/tutor-bookings` | Received bookings (tutor) |
| PATCH | `/api/tutor-bookings/:id/confirm` | Confirm booking |
| PATCH | `/api/tutor-bookings/:id/decline` | Decline booking |
| PATCH | `/api/tutor-bookings/:id/complete` | Mark as completed |
| PATCH | `/api/bookings/:id/cancel-confirmed` | Cancel confirmed session |

### Profile Management
| Method | Route | Description |
|---|---|---|
| GET | `/api/profile` | View own profile |
| PUT | `/api/profile` | Update bio and rate |
| POST | `/api/profile/courses` | Add course |
| DELETE | `/api/profile/courses/:id` | Remove course |

### Payment System
| Method | Route | Description |
|---|---|---|
| POST | `/api/payments/process` | Process payment (mock) |
| GET | `/api/payments/:bookingId` | Payment status |

### Reviews
| Method | Route | Description |
|---|---|---|
| POST | `/api/reviews` | Leave review (completed sessions only) |

### Messages & Chat
| Method | Route | Description |
|---|---|---|
| GET | `/api/conversations` | Active conversations list |
| GET | `/api/conversations/:bookingId/messages` | Conversation messages |
| POST | `/api/conversations/send` | Send message |
| POST | `/api/conversations/:bookingId/read` | Mark as read |

### Notifications
| Method | Route | Description |
|---|---|---|
| GET | `/api/notifications` | All notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| PATCH | `/api/notifications/:id/read` | Mark one as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

### Google Calendar Integration
| Method | Route | Description |
|---|---|---|
| GET | `/auth/google` | Start OAuth flow |
| GET | `/auth/google/callback` | OAuth callback |
| POST | `/api/calendar/add-event` | Add session to calendar |
| GET | `/api/calendar/status` | Check connection status |

---

## ⚡ Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `join_user` | Client → Server | Join personal room (notifications) |
| `join_booking` | Client → Server | Join booking chat room |
| `leave_booking` | Client → Server | Leave chat room |
| `send_message` | Client → Server | Send message |
| `new_message` | Server → Client | Incoming real-time message |
| `new_notification` | Server → Client | Real-time notification |

---

## 🔔 Automatic notification types

| Type | Who receives | When |
|---|---|---|
| `booking_request` | Tutor | Student makes a booking |
| `booking_confirmed` | Student | Tutor confirms booking |
| `booking_declined` | Student | Tutor declines booking |
| `session_completed` | Student | Tutor marks session as completed |
| `session_cancelled` | Student | Tutor cancels confirmed session |
| `new_review` | Tutor | Student leaves a review |
| `new_message` | Other party | New chat message arrives |

---

## 💳 Payment System Features

### Supported Payment Methods
- **Google Pay** - Official logo from Google Developer
- **Apple Pay** - Official logo from Apple Developer  
- **PayPal** - Official logo from PayPal
- **Credit/Debit Cards** - Visa, Mastercard, American Express, Discover

### Tax Calculation
- **NY State Tax:** 8.25% automatically calculated
- **Example:** $25.00 session + $2.06 tax = $27.06 total

### Security Features
- 256-bit SSL encryption notice
- Auto-format card numbers (groups of 4)
- Auto-format expiry dates (MM/YY format)
- CVC validation (numbers only)

---

## 🛠️ Session types

| Type | Description |
|---|---|
| `one_on_one` | Private 1-on-1 session |
| `group` | Group session with other students |
| `resources` | Tutor shares study materials (no date required) |

---

## 🎨 Syracuse University Branding

- **Orange:** `#F76900` (Primary action color)
- **Navy:** `#000E54` (Text and headers)
- Logo at `/public/logo.png`
- Footer with `#OrangeNation` on all pages
- Consistent emoji icons across all features

---

## 📦 Dependencies (package.json)

```json
{
  "dependencies": {
    "bcrypt": "^5.x",
    "dotenv": "^16.x",
    "express": "^4.x",
    "express-session": "^1.x",
    "googleapis": "^130.x",
    "mysql2": "^3.x",
    "nodemailer": "^6.x",
    "socket.io": "^4.x"
  },
  "devDependencies": {
    "nodemon": "^3.x"
  }
}
```

---

## 🔧 Environment Variables Explained

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL server host | `localhost` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `your_password` |
| `DB_NAME` | Database name | `tutormatch` |
| `SESSION_SECRET` | Session encryption key | `random_secret_key` |
| `PORT` | Server port | `3000` |
| `MAIL_USER` | Gmail account for sending emails | `your.email@gmail.com` |
| `MAIL_PASS` | Gmail app password | `your-app-password` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | From Google Console |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/auth/google/callback` |

---

## 📱 Mobile Responsive Features

- **Breakpoints:** 768px (tablet) and 480px (mobile)
- **Touch-friendly buttons** with adequate spacing
- **Collapsible navigation** on small screens
- **iOS zoom prevention** with 16px font size on inputs
- **Payment modal optimization** for mobile devices

---

## 🔐 Security Features

### Password Security
- bcrypt hashing with salt
- Strong password requirements
- Email-based password reset

### Session Security
- express-session with secure cookies
- Session timeout and cleanup
- CSRF protection via session validation

### Input Validation
- SQL injection prevention with mysql2 prepared statements
- XSS protection with content escaping
- Email validation and sanitization

---

## 📊 Database Schema Overview

| Table | Purpose | Key Features |
|---|---|---|
| `users` | User accounts | Role-based (student/tutor) |
| `tutor_profiles` | Tutor details | Bio, hourly rate, verification |
| `tutor_courses` | Course offerings | Course code, name, professor, grade |
| `bookings` | Session bookings | Status tracking, payment integration |
| `messages` | Chat system | Read status, real-time updates |
| `notifications` | Alert system | Type-based, read tracking |
| `reviews` | Rating system | 1-5 stars, comments |
| `payments` | Payment tracking | Multiple methods, NY tax |
| `password_resets` | Security | Token-based, expiration |
| `google_tokens` | OAuth | Calendar integration |

---

## 🚀 Performance Features

### Real-time Updates
- Socket.io for instant messaging
- Live notification badges
- Real-time booking status updates

### Efficient Database Queries
- Connection pooling with mysql2
- Indexed foreign keys
- Optimized JOIN queries for search

### Responsive Design
- CSS Grid and Flexbox layouts
- Mobile-first approach
- Optimized image loading

---

## 📈 Analytics & Monitoring

### Available Data Points
- User registration trends
- Booking completion rates
- Payment success metrics
- Popular courses and tutors
- Chat message volume
- Review ratings distribution

### Logging
- Server startup and shutdown events
- Database connection status
- Payment processing results
- OAuth flow completion
- Error tracking with stack traces

---

## 🌟 Unique Features

### Personalized Experience
- **Recent searches** saved per user
- **Course recommendations** based on university catalog
- **Automatic tax calculation** for NY residents
- **Smart notification** grouping by type

### Syracuse University Integration
- **Course catalog** with real SU courses
- **Professor names** from actual departments
- **University branding** throughout
- **Campus-specific** terminology and features

---

## 👥 Team

**CIS 453 · Syracuse University · Spring 2026** · #OrangeNation 🍊

---

*This README reflects the complete implementation including all stages (1-9) plus additional features like Google Calendar integration, payment system, forgot password, advanced messaging, and mobile responsiveness.*