# 🎓 Institute CRM — Enquiry, Admission & Attendance Management System

A **production-ready, full-stack CRM** built for educational and training institutes. Covers the complete student lifecycle — from first enquiry to fee collection — plus employee attendance tracking with geofencing.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Complete Feature List](#complete-feature-list)
   - [Feature 1 — Authentication & Role-Based Access Control](#feature-1--authentication--role-based-access-control)
   - [Feature 2 — Enquiry Management](#feature-2--enquiry-management)
   - [Feature 3 — Admission Management](#feature-3--admission-management)
   - [Feature 4 — Fee & Payment Management](#feature-4--fee--payment-management)
   - [Feature 5 — Refund & Void System](#feature-5--refund--void-system)
   - [Feature 6 — Dashboard & Analytics](#feature-6--dashboard--analytics)
   - [Feature 7 — Reports Module](#feature-7--reports-module)
   - [Feature 8 — Notification Engine (FCM)](#feature-8--notification-engine-fcm)
   - [Feature 9 — Bulk Upload (Excel/CSV)](#feature-9--bulk-upload-excelcsv)
   - [Feature 10 — Employee Attendance Module](#feature-10--employee-attendance-module)
   - [Feature 11 — User Management (Add User)](#feature-11--user-management-add-user)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Installation & Setup](#installation--setup)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Business Rules & Logic](#business-rules--logic)
8. [Environment Variables](#environment-variables)

---

## System Architecture

```
Frontend (HTML/CSS/JS)
        │
        │ REST API / JSON
        ▼
  Express API Gateway (app.js)
        │
        ├── JWT Auth Middleware ──────────────────┐
        ├── Role Middleware (Admin/Counselor/Employee)│
        ├── Validation Middleware (express-validator)│
        │                                        │
        ▼                                        │
   Route Layer (11 route files)                  │
        │                                        │
        ▼                                        │
   Controller Layer (request/response handling)  │
        │                                        │
        ▼                                        │
   Service Layer (core business logic)           │
        │                                        │
        ▼                                        │
   Mongoose Models (MongoDB)  ◄──────────────────┘
        │
        ▼
     MongoDB Database
        
   Scheduler Service (node-cron)
        │
        ▼
   Firebase FCM (Push Notifications)
        │
        ▼
   Browser / Service Worker
```

---

## Complete Feature List

---

### Feature 1 — Authentication & Role-Based Access Control

**What it does:** Secure login system with JWT tokens and three user roles — each with different permissions.

#### Roles
| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Full system access | All features, reports, user creation, attendance admin |
| `counselor` | Sales/lead management | Enquiries (own leads), admissions, payments |
| `employee` | Field staff | Attendance punch only — no CRM data access |

#### How it works
- User logs in via `POST /api/auth/login` with email + password
- Server validates credentials, returns a **JWT token** (7-day expiry by default)
- Token is stored in `localStorage` on frontend
- Every subsequent API call sends `Authorization: Bearer <token>` header
- **Role redirect on login:**
  - `admin` → `dashboard.html`
  - `counselor` → `dashboard.html`
  - `employee` → `attendance.html` (blocked from all other pages)
- Password hashed with **bcrypt** (12 salt rounds)
- Token deduplication: if same user logs in on new device, old FCM tokens from the previous session are automatically cleaned up

#### Pages
- `index.html` — Login screen

#### API Endpoints
- `POST /api/auth/login` — Public
- `POST /api/auth/register` — **Admin only** (creates new users)
- `POST /api/auth/logout` — Protected (removes FCM token)

---

### Feature 2 — Enquiry Management

**What it does:** Complete CRM pipeline for tracking student leads — from first contact to conversion.

#### Sub-features
1. **Create Enquiry** — Name, mobile, email, course, source, counselor assignment, notes
2. **Search & Filter** — By status, source, counselor, date range, keyword
3. **Pagination** — Server-side with configurable page size
4. **Status Tracking** — 4 statuses: `CONTACTED`, `INTERESTED`, `NOT_INTERESTED`, `ADMITTED`
5. **Lead Sources** — Website, Walk-in, Referral, Phone Call, Social Media, Advertisement, Other
6. **Follow-up Scheduler** — Set follow-up date per enquiry
7. **Follow-up List View** — See today's + overdue follow-ups in one view
8. **Timeline / Activity Log** — Every status change, note, follow-up, and conversion is logged with timestamp
9. **Notes System** — Add internal notes to each enquiry
10. **Counselor Assignment** — Admin can assign/reassign leads; counselors auto-assigned on creation
11. **Walk-in Brought-by** — Track which staff member walked in the student
12. **Enquiry Detail Page** — Full view with timeline, notes, actions, and admission link
13. **Public Enquiry API** — Website form submissions (`POST /api/enquiries/public`) — no auth required
14. **Bulk Upload** — Upload multiple enquiries via Excel/CSV (Admin only)
15. **Duplicate Detection** — Mobile number checked for existing admission before allowing conversion

#### Auto-Assignment Rules
- Enquiry created by **Admin** → `assignedTo: null` (unassigned)
- Enquiry created by **Counselor** → auto-assigned to themselves
- First counselor to act on an unassigned enquiry → auto-assigned to them

#### Pages
- `enquiries.html` — Enquiry list, search, filters
- `enquiry-detail.html` — Single enquiry detail + timeline
- `example-enquiry-form.html` — Sample public-facing form

#### API Endpoints
- `POST /api/enquiries` — Create
- `GET /api/enquiries` — List (paginated, filterable)
- `GET /api/enquiries/:id` — Get single
- `PUT /api/enquiries/:id` — Update
- `GET /api/enquiries/walkin-brought-by` — Walk-in staff list
- `POST /api/enquiries/public` — Public website form (no auth)
- `POST /api/bulk-upload/enquiries` — Bulk Excel upload (Admin)

---

### Feature 3 — Admission Management

**What it does:** Convert enquiries to admissions and track the complete enrollment lifecycle.

#### Sub-features
1. **Create Admission** — Independent of enquiry; or linked from an enquiry's "Convert" action
2. **Student Profile** — Name, mobile, email, father's name, address, course, batch, joining date
3. **Fee Structure** — Total fees, registration amount, initial payment
4. **Payment Plan** — One-time or installment-based
5. **Installment Setup** — Set number, amounts, and due dates per installment
6. **Admission Status Tracking** — Active, Cancelled, Dropped, Write-off
7. **Drop Student** — Mark student as dropped with reason
8. **Counselor Attribution** — Track which counselor admitted the student
9. **Enquiry Lock** — Once an admission is created for a course, the linked enquiry's course+status is locked from editing
10. **Duplicate Prevention** — Unique compound index on `(mobile + course)` — same student can enroll in multiple courses but not duplicate
11. **Admission Detail Page** — Full view with payment history, installment tracker, and action buttons
12. **Counselor-wise Student View** — Counselors see only their own students

#### Pages
- `admissions.html` — Admission list with search/filter
- `admission-detail.html` — Full student + payment detail
- `counselor-students.html` — Counselor's personal student list

#### API Endpoints
- `POST /api/admissions` — Create
- `GET /api/admissions` — List (sorted by upcoming installment due date)
- `GET /api/admissions/:id` — Get single
- `PUT /api/admissions/:id` — Update
- `GET /api/admissions/:id/payments` — Payment history
- `POST /api/admissions/:id/payments` — Record new payment
- `PUT /api/admissions/:id/installments` — Update installment plan
- `POST /api/admissions/:id/drop` — Drop student

---

### Feature 4 — Fee & Payment Management

**What it does:** Full installment tracking system with overdue detection and payment history.

#### Sub-features
1. **Record Payment** — Amount, date, mode (Cash/Card/UPI/Online/Cheque/Bank Transfer), receipt number, notes
2. **Installment Plan** — Set fixed installments with custom due dates
3. **Installment Status** — Each installment tracked as `PENDING`, `PAID`, or `OVERDUE`
4. **Overdue Detection** — Automatic sweep marks past-due installments as OVERDUE
5. **Payment History** — Full log of all payments for a student
6. **Total Paid Calculation** — Sum of active (non-voided, non-refund) payments only
7. **Pending Balance** — Auto-calculated: Total Fees − Total Paid
8. **Global Payments List** — Admin view of all payments across all students
9. **Payment Modes** — Cash, Card, UPI, Online, Cheque, Bank Transfer
10. **Payment Types** — Registration, Installment, Initial, Full

#### Pages
- `payments.html` — Global payments list (Admin)
- `admission-detail.html` — Per-student payment history + installment tracker

#### API Endpoints
- `GET /api/payments` — All payments (Admin + Counselor)
- `POST /api/payments/check-overdue` — Trigger overdue sweep (Admin)

---

### Feature 5 — Refund & Void System

**What it does:** Admin can reverse or cancel payments with proper accounting.

#### Refund
- Creates a **new negative payment record** of type `refund` for the specified amount
- Original payment remains untouched in history
- `Total Paid` recalculates: only `ACTIVE` and non-`refund` type records are summed
- Installments automatically re-evaluated after refund
- A refunded payment **cannot be refunded again** (prevented at service layer)

#### Void
- Changes payment status from `ACTIVE` → `VOIDED`
- Voided payments are excluded from Total Paid calculation
- A voided payment **cannot be voided again**
- A refunded payment **cannot be voided** (prevents loophole)

#### Business Rules
- `Total Paid = SUM of payments where status=ACTIVE AND type≠refund` + `SUM of refund records (negative)`
- Refund entries show clearly in payment history with "Refund for payment #xyz" label
- Void/Refund action buttons do **not** appear on refund-type entries

#### API Endpoints
- `POST /api/payments/:id/refund` — Refund a payment (Admin)
- `POST /api/payments/:id/void` — Void a payment (Admin)

---

### Feature 6 — Dashboard & Analytics

**What it does:** Real-time overview of institute performance for Admin and Counselor.

#### Admin Dashboard Metrics
- Total Leads (all enquiries)
- Total Admissions
- Today's Follow-ups count
- Pending (overdue) Follow-ups count
- New Leads (fresh enquiries)
- Active Students
- Pending Payments (total outstanding revenue)
- Conversion Rate (Enquiries → Admissions %)
- Monthly Revenue Trend (Chart.js bar chart)
- Lead Source Breakdown (Chart.js pie chart)
- Conversion Funnel (Enquiries → Follow-ups → Hot Leads → Admissions)
- Course-wise Summary table (Enquiries, Admissions, Revenue, Conversion %)

#### Counselor Dashboard
- Personal metrics only (their own leads and conversions)
- No Revenue, no Reports card
- Personalized labels (e.g., "Leads" instead of "Total Leads")

#### Quick Actions (Admin)
- All Enquiries link
- Admissions link
- Reports link *(Admin only)*
- **Add User** button — opens inline modal *(Admin only)*

#### Page
- `dashboard.html`

#### API Endpoints
- `GET /api/dashboard` — Full dashboard data

---

### Feature 7 — Reports Module

**What it does:** Detailed analytics reports for Admin — exportable data views.

#### Reports Available
1. **Admissions Report** — Filter by date range; shows all admissions with fees/payments
2. **Fee Collection Report** — Revenue collected vs. pending, breakdown by course
3. **Course Performance Report** — Enquiry → Admission conversion per course
4. **Counselor Performance Report** — Lead count, admission count, conversion rate per counselor
5. **Summary Report** — High-level KPIs (total revenue, pending, conversion %)

#### Page
- `reports.html` — All reports in one page with date filter

#### API Endpoints
- `GET /api/reports/admissions` — Admissions report (Admin)
- `GET /api/reports/fees` — Fee collection report (Admin)
- `GET /api/reports/course-performance` — Course-wise performance (Admin)
- `GET /api/reports/counselor-performance` — Counselor-wise performance (Admin)
- `GET /api/reports/summary` — Summary metrics (Admin)

---

### Feature 8 — Notification Engine (FCM)

**What it does:** Firebase Cloud Messaging push notifications to browser/device via Service Worker.

#### Notification Types
1. **Today's Follow-ups** — Sent at 9:00 AM daily to remind about today's follow-ups
2. **Pending Leads Alert** — Sent at 11:00 AM if there are unassigned/not-yet-contacted leads
3. **Overdue Installments** — Sent at 10:00 AM daily for overdue fee installments
4. **Hinglish Fun Notifications** — Custom motivational/fun messages in Hinglish sent at specific times
5. **Evening Summary** — End-of-day digest notification

#### Technical Details
- Firebase Admin SDK on backend sends FCM payloads
- Service Worker (`firebase-messaging-sw.js`) handles background notifications
- FCM token stored per user per device in `User.fcmTokens[]` array
- **Token deduplication** — same FCM token cannot be registered twice
- **Token cleanup** — when user logs in on new device, old device tokens can be invalidated
- **Send-time deduplication** — prevents double-sending the same notification in one scheduler run

#### API Endpoints
- `POST /api/notifications/test` — Send test notification (Admin)
- `POST /api/notifications/scheduler/run` — Manually trigger scheduler (Admin)

---

### Feature 9 — Bulk Upload (Excel/CSV)

**What it does:** Admin can upload multiple enquiries at once from an Excel or CSV file.

#### How it works
1. Admin downloads the template format
2. Fills in student data in Excel/CSV
3. Uploads via the Bulk Upload button on Enquiries page
4. System validates each row and creates enquiries
5. Duplicate mobile numbers are flagged (not rejected) with a warning
6. Results returned: success count, failed rows with reason

#### Supported Columns
- Name, Mobile, Email, Course, Source, Status, Counselor, Notes, Follow-up Date

#### API Endpoint
- `POST /api/bulk-upload/enquiries` — Upload file (Admin, `multipart/form-data`)

---

### Feature 10 — Employee Attendance Module

**What it does:** Location-aware punch IN/OUT system for employees with admin reporting.

#### Sub-features
1. **Punch IN/OUT Toggle** — Single button switches between IN and OUT
2. **Geofence Validation** — Punch only allowed within defined radius of office location
3. **Haversine Distance Calculation** — Accurate real-world distance using lat/lng coordinates
4. **Personal History** — Employee can view their own attendance log
5. **Admin Attendance Report** — View all employees' attendance, filter by role and date range
6. **Monthly Summary** — Total days present, absent, working hours per employee
7. **Office Settings** — Admin sets office location (lat/lng) and allowed radius (meters) via interactive map
8. **Leaflet.js Map** — Free OpenStreetMap-based map (no API key required) for setting office location
9. **Role Filter** — Admin can filter attendance log by Admin / Counselor / Employee

#### Employee Access Control
- After login, `employee` role is redirected to `attendance.html` automatically
- Employees get **403 Forbidden** if they try to access any Enquiry/Admission/Payment API
- Employee pages have no sidebar links to CRM features

#### Geofencing Logic
```
Distance (meters) = Haversine(userLat, userLng, officeLat, officeLng)
If distance <= officeRadius → Punch allowed
If distance >  officeRadius → Punch rejected with "You are X meters away" message
```

#### Pages
- `attendance.html` — Employee punch console
- `admin-attendance.html` — Admin attendance report
- `office-settings.html` — Admin map + radius configuration

#### API Endpoints
- `POST /api/attendance/punch` — Punch IN or OUT (all authenticated users)
- `GET /api/attendance/personal-history` — Own attendance log (all authenticated users)
- `GET /api/attendance/admin-history` — All employees' log (Admin only)
- `GET /api/attendance/office-settings` — Get office location (all authenticated users)
- `PUT /api/attendance/office-settings` — Update office location/radius (Admin only)

---

### Feature 11 — User Management (Add User)

**What it does:** Admin can register new users (Counselor, Employee, Admin) directly from the Dashboard.

#### How it works
1. Admin clicks **"Add User"** quick action button on Dashboard
2. Modal opens with a form: Full Name, Email, Password, Role (dropdown)
3. Role options: **Counselor**, **Employee**, **Admin**
4. On submit, calls `POST /api/auth/register` (Admin-only protected)
5. Success → toast notification shown; form clears
6. Error → inline error message shown (e.g., duplicate email)

#### Security
- `/api/auth/register` is protected by both `authMiddleware` AND `roleMiddleware(ADMIN)`
- Only an authenticated Admin can create new accounts
- No self-registration is possible for the public

#### Login Routing After Creation
| Role Created | First Login Redirect |
|---|---|
| `admin` | `dashboard.html` |
| `counselor` | `dashboard.html` |
| `employee` | `attendance.html` |

#### Page
- `dashboard.html` (modal embedded)

---

## Technology Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js ≥18 | Runtime environment |
| Express.js | HTTP framework & routing |
| MongoDB + Mongoose | Database & ODM |
| JWT (`jsonwebtoken`) | Stateless authentication |
| bcrypt | Password hashing (12 rounds) |
| Firebase Admin SDK | FCM push notifications |
| `node-cron` | Scheduled notification jobs |
| `xlsx` + `csv-parser` | Excel/CSV bulk upload parsing |
| `multer` | File upload middleware |
| `express-validator` | Input validation |
| `cors` | Cross-origin request support |

### Frontend
| Technology | Purpose |
|---|---|
| Vanilla HTML5 | Page structure |
| Tailwind CSS (CDN) | Utility-first styling |
| Vanilla JavaScript (ES6) | Client logic & API calls |
| Axios | HTTP client (cleaner than fetch) |
| Lucide Icons | Icon library (SVG) |
| Chart.js | Dashboard charts |
| Leaflet.js + OpenStreetMap | Map for office location settings |
| Firebase JS SDK | FCM token registration |
| Service Worker | Background push notification handler |

---

## Project Structure

```
crm/
├── README.md
│
├── backend_crm/                    # Express API Server
│   ├── app.js                      # Express app setup, route mounting
│   ├── server.js                   # HTTP server + graceful shutdown
│   ├── package.json
│   │
│   ├── config/
│   │   ├── constants.js            # ROLES, STATUSES, PAYMENT_MODES, etc.
│   │   ├── database.js             # MongoDB connection
│   │   └── firebase-service-account.json  # (not in repo — add manually)
│   │
│   ├── models/
│   │   ├── User.js                 # Admin, Counselor, Employee accounts
│   │   ├── Enquiry.js              # Student leads + timeline + notes
│   │   ├── Admission.js            # Enrolled students + installments
│   │   ├── Payment.js              # Payment records (including refunds)
│   │   ├── Attendance.js           # Punch IN/OUT records
│   │   └── OfficeSettings.js       # Geofence config (lat/lng/radius)
│   │
│   ├── services/
│   │   ├── auth.service.js         # Login, token generation, user fetch
│   │   ├── enquiry.service.js      # Full enquiry CRUD + auto-assign logic
│   │   ├── admission.service.js    # Admission + installment logic
│   │   ├── payment.service.js      # Payment, refund, void, overdue logic
│   │   ├── attendance.service.js   # Punch + Haversine geofencing
│   │   ├── dashboard.service.js    # Metrics aggregation
│   │   ├── report.service.js       # Analytics reports
│   │   ├── firebaseService.js      # FCM send + token management
│   │   └── schedulerService.js     # Cron jobs for notifications
│   │
│   ├── controllers/                # Thin layer — calls service, sends response
│   │   ├── auth.controller.js
│   │   ├── enquiry.controller.js
│   │   ├── admission.controller.js
│   │   ├── payment.controller.js
│   │   ├── attendance.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── report.controller.js
│   │   └── notification.controller.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── enquiry.routes.js       # /api/enquiries/*
│   │   ├── admission.routes.js     # /api/admissions/*
│   │   ├── payment.routes.js       # /api/payments/*
│   │   ├── attendance.routes.js    # /api/attendance/*
│   │   ├── dashboard.routes.js     # /api/dashboard/*
│   │   ├── report.routes.js        # /api/reports/*
│   │   ├── notification.routes.js  # /api/notifications/*
│   │   ├── bulkUpload.routes.js    # /api/bulk-upload/*
│   │   └── user.routes.js          # /api/users/*
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT verification
│   │   ├── roleMiddleware.js       # Role-based authorization
│   │   ├── validateRequest.js      # express-validator error handler
│   │   └── errorHandler.js         # Global error handler
│   │
│   └── validations/
│       ├── auth.validation.js
│       ├── enquiry.validation.js
│       ├── admission.validation.js
│       ├── payment.validation.js
│       └── report.validation.js
│
└── frontend_crm/                   # Static Client Pages
    ├── index.html                  # Login page
    ├── dashboard.html              # Main dashboard + Add User modal
    ├── enquiries.html              # Enquiry list + bulk upload
    ├── enquiry-detail.html         # Single enquiry + timeline
    ├── admissions.html             # Admission list
    ├── admission-detail.html       # Student detail + payments + installments
    ├── payments.html               # Global payment list (Admin)
    ├── reports.html                # Analytics reports (Admin)
    ├── attendance.html             # Employee punch IN/OUT console
    ├── admin-attendance.html       # Admin attendance report
    ├── office-settings.html        # Office location map settings
    ├── counselor-students.html     # Counselor's student list
    ├── firebase-messaging-sw.js    # Service Worker for push notifications
    │
    ├── js/
    │   ├── api.js                  # Axios wrapper + all API endpoint helpers
    │   ├── auth.js                 # Login/logout + role-redirect + page guard
    │   ├── attendance.js           # Punch logic + personal history
    │   ├── admin-attendance.js     # Admin attendance report view
    │   └── office-settings.js      # Leaflet map + office config
    │
    └── css/
        ├── styles.css
        └── crm-ui.css
```

---

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) version ≥ 18.x
- [MongoDB](https://www.mongodb.com/) (local or MongoDB Atlas)
- Firebase Project (optional — for push notifications)

### Step 1 — Backend Setup

```bash
cd backend_crm
npm install
```

Create `.env` file:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/institute_crm
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
BCRYPT_SALT_ROUNDS=12
```

Start backend:
```bash
npm run dev
```

### Step 2 — Firebase Setup (Optional — for Push Notifications)
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Download the **Service Account JSON** key
3. Place it at `backend_crm/config/firebase-service-account.json`
4. Copy your Firebase Web Config into `frontend_crm/index.html` and `firebase-messaging-sw.js`

### Step 3 — Frontend Setup

Serve the `frontend_crm` folder with any static server:

```bash
# Option A — VS Code Live Server extension (recommended)
# Just open frontend_crm/index.html and click "Go Live"

# Option B — Python
cd frontend_crm
python -m http.server 3000

# Option C — Node http-server
npx http-server frontend_crm -p 3000
```

Open: `http://localhost:3000`

> **Important:** Make sure `BASE_URL` in `frontend_crm/js/api.js` matches your backend port (default: `http://localhost:5000/api`).

### Step 4 — Create First Admin User

Since registration requires an admin token, use this one-time script:

```bash
cd backend_crm
node scripts/createAdmin.js
```

Or directly via MongoDB:
```js
// In mongosh
use institute_crm
db.users.insertOne({
  name: "Admin",
  email: "admin@institute.com",
  password: "<bcrypt-hashed-password>",
  role: "admin"
})
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Login + get JWT token |
| POST | `/api/auth/register` | Admin | Create new user (any role) |
| POST | `/api/auth/logout` | Any | Remove FCM token |

### Enquiries
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/enquiries` | Any | List all (paginated, filterable) |
| POST | `/api/enquiries` | Any | Create new enquiry |
| GET | `/api/enquiries/:id` | Any | Get single enquiry |
| PUT | `/api/enquiries/:id` | Any | Update enquiry |
| POST | `/api/enquiries/public` | Public | Website form submission |
| GET | `/api/enquiries/walkin-brought-by` | Any | Walk-in staff list |
| POST | `/api/bulk-upload/enquiries` | Admin | Bulk Excel upload |

### Admissions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admissions` | Any | List admissions |
| POST | `/api/admissions` | Any | Create admission |
| GET | `/api/admissions/:id` | Any | Get single admission |
| PUT | `/api/admissions/:id` | Any | Update admission |
| POST | `/api/admissions/:id/payments` | Any | Record payment |
| GET | `/api/admissions/:id/payments` | Any | Payment history |
| PUT | `/api/admissions/:id/installments` | Any | Update installment plan |
| POST | `/api/admissions/:id/drop` | Admin | Drop student |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/payments` | Admin/Counselor | All payments list |
| POST | `/api/payments/check-overdue` | Admin | Trigger overdue sweep |
| POST | `/api/payments/:id/refund` | Admin | Refund a payment |
| POST | `/api/payments/:id/void` | Admin | Void a payment |

### Attendance
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/attendance/punch` | Any (logged in) | Punch IN or OUT |
| GET | `/api/attendance/personal-history` | Any (logged in) | Own punch history |
| GET | `/api/attendance/admin-history` | Admin | All employees' log |
| GET | `/api/attendance/office-settings` | Any (logged in) | Office location |
| PUT | `/api/attendance/office-settings` | Admin | Set office location/radius |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports/admissions` | Admin | Admissions report |
| GET | `/api/reports/fees` | Admin | Fee collection report |
| GET | `/api/reports/course-performance` | Admin | Course analytics |
| GET | `/api/reports/counselor-performance` | Admin | Counselor analytics |
| GET | `/api/reports/summary` | Admin | Summary KPIs |

### Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard` | Any | Dashboard metrics |

### Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notifications/test` | Admin | Send test push notification |
| POST | `/api/notifications/scheduler/run` | Admin | Manually run scheduler |

---

## Business Rules & Logic

### 1. Lead Auto-Assignment
- Admin creates enquiry → `assignedTo: null`
- Counselor creates enquiry → `assignedTo: counselor_id`
- First counselor to act on unassigned lead → auto-assigned to them

### 2. Admission Duplicate Prevention
- Unique compound index: `(mobile + course)`
- Same student can enroll in **multiple courses**
- Same student **cannot** enroll in the **same course twice**

### 3. Enquiry Locking
- Once an admission exists for `(mobile + course)`, the enquiry's `course` and `status` fields are locked

### 4. Total Paid Calculation
```
Total Paid = SUM(payments WHERE status='ACTIVE' AND type != 'refund')
           + SUM(refund payments — which are negative amounts)
```

### 5. Geofencing for Attendance
```
Distance = Haversine(userLat, userLng, officeLat, officeLng)
Allow punch if Distance ≤ officeRadius
```

### 6. Payment Status Rules
- `ACTIVE` payment → can be refunded or voided
- `VOIDED` payment → cannot be voided again; excluded from Total Paid
- `refund` type payment → cannot be refunded or voided again

### 7. Installment Status
- `PENDING` — not yet paid, not overdue
- `PAID` — payment recorded
- `OVERDUE` — due date has passed and still unpaid (set by `/check-overdue`)

---

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/institute_crm

# Auth
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
BCRYPT_SALT_ROUNDS=12

# Firebase (optional)
FIREBASE_PROJECT_ID=your-project-id
```

---

## License

MIT License — see `LICENSE` file for details.
