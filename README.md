# Institute Enquiry Management System

A production-ready CRM backend for managing institute enquiries, admissions, and payments.

## Updated Model Structure (May 2026)

### Enquiry Model
```javascript
{
  name, email, mobile, course,
  source, referenceName, referenceContact, walkInBroughtBy,
  status, assignedTo, followUpDate,
  statusHistory: [{ status, note, changedBy, changedAt }],
  createdBy, createdAt, updatedAt
}
```

### Admission Model (Independent - No Enquiry Link)
```javascript
{
  name, email, mobile, course, admissionDate,
  totalFees, registrationAmount,
  installments: [{ amount, dueDate, note, status }],
  status, counselorId, isDefaulted, writeOffAmount,
  createdBy, updatedBy, createdAt, updatedAt
}
```

### Payment Model (Simplified)
```javascript
{
  admissionId, amount, paymentMode, paymentDate, note,
  createdBy, createdAt, updatedAt
}
```

## Key Changes (May 2026)
- **Enquiry simplified**: No access restrictions, no delete, single PUT for all updates
- **Enquiry & Admission are independent** (no enquiryId reference)
- **No restrictions** on status changes (no CONVERTED lock, no note requirement)
- **No soft delete** - removed isDeleted fields
- **Simplified Payment** - removed type, status, refund fields, cancellation fields
- Admission can be edited **anytime** by anyone (no isLocked)

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- Bcrypt for password hashing
- Clean Architecture (Controllers, Services, Models, Middlewares, Utils)

## Features

- **Role-based access control**: Admin (full access) & Counselor (restricted access)
- **No Ownership Restrictions**: Anyone can access/update any enquiry
- **Auto-assignment logic**: First action auto-assigns unassigned enquiries
- **Single Update API**: All fields in one PUT request (Enquiry & Admission)
- **Follow-up Management**: Today and overdue follow-up tracking
- **Admission & Payment Tracking**: Full financial management with installments
- **Dashboard APIs**: Revenue, enquiries, and follow-up statistics
- **Search, filter, and pagination**

## Installation

```bash
npm install
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- `JWT_EXPIRE` - JWT expiration (e.g., '7d')
- `PORT` - Server port (default: 5000)

## Running the Application

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Documentation

### Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | Login user |
| POST | `/api/auth/register` | Admin only | Register new user |

### Enquiries (Simplified - No Restrictions)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/enquiries` | Admin, Counselor | Create enquiry |
| GET | `/api/enquiries` | Admin, Counselor | List all enquiries |
| GET | `/api/enquiries/:id` | Admin, Counselor | Get single enquiry |
| PUT | `/api/enquiries/:id` | Admin, Counselor | **Full Update** - Any field, anytime, no restrictions |
| POST | `/api/bulk-upload/enquiries` | Admin | Bulk upload from Excel |
| POST | `/api/enquiries/public` | Public | Website enquiry form |
| PUT | `/api/enquiries/:id/assign` | Admin only | Assign to counselor |

**Full Update API (PUT /api/enquiries/:id)**:
```json
{
  "name": "Ram Kumar",
  "email": "ram@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "status": "FOLLOW_UP",
  "note": "Called the student",
  "followUpDate": "2026-04-15",
  "assignedTo": "counselorId"
}
```
**Rules**:
- **No restrictions** - Any field can be updated anytime by anyone
- Note is **optional** for status changes
- History automatically saved with `changedBy` user info
- `followUpDate` required only when status is `FOLLOW_UP`

**Status Enum**:
- `NEW`, `CONTACTED`, `NO_RESPONSE`, `FOLLOW_UP`, `INTERESTED`, `NOT_INTERESTED`, `ADMISSION_PROCESS`, `CONVERTED`

### Dashboard

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/dashboard` | Admin, Counselor | Full dashboard stats |
| GET | `/api/dashboard/revenue` | Admin | Revenue stats (today, weekly, monthly, yearly) |
| GET | `/api/dashboard/enquiries` | Admin | Enquiry stats (today, weekly, monthly, yearly) |
| GET | `/api/dashboard/followups` | Admin, Counselor | Follow-up statistics |
| GET | `/api/dashboard/counselor` | Counselor | Counselor-specific dashboard |

### Admissions (Independent - No Enquiry Link)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/admissions` | Admin, Counselor | Create admission |
| GET | `/api/admissions` | Admin, Counselor | List admissions (sorted by upcoming installment) |
| GET | `/api/admissions/:id` | Admin, Counselor | Get single admission |
| PUT | `/api/admissions/:id` | Admin, Counselor | **Full Update** - Any field, anytime, no restrictions |
| POST | `/api/admissions/:id/payments` | Admin, Counselor | Record payment |
| GET | `/api/admissions/:id/payments` | Admin, Counselor | List payments for admission |

**Full Update API (PUT /api/admissions/:id)**:
```json
{
  "name": "Ram Kumar",
  "email": "ram@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "totalFees": 50000,
  "registrationAmount": 5000,
  "installments": [
    { "amount": 15000, "dueDate": "2026-05-15", "note": "First installment" },
    { "amount": 15000, "dueDate": "2026-06-15", "note": "Second installment" },
    { "amount": 15000, "dueDate": "2026-07-15", "note": "Third installment" }
  ],
  "status": "active"
}
```
**Rules**:
- **No restrictions** - Any field can be updated anytime by anyone
- Installments can be added/modified/removed
- History automatically saved with `updatedBy` user info

### Payments (Simplified)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/payments` | Admin, Counselor | List all payments (global) |
| POST | `/api/payments/check-overdue` | Admin | Check overdue installments |

**Installment Status Enum**:
- `PENDING`, `PAID`, `OVERDUE`

### Reports

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/reports/admissions` | Admin | Admissions report |
| GET | `/api/reports/fees` | Admin | Fees collection report |
| GET | `/api/reports/installments/alerts` | Admin, Counselor | Installment alerts |

### Bulk Upload

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/bulk-upload/enquiries` | Admin | Bulk upload enquiries from Excel |

## User Roles

### Admin
- Full CRUD access to all resources
- Can override data and delete any enquiry
- Can access all dashboard statistics

### Counselor
- Can create enquiries (auto-assigned to them)
- Can access all enquiries (no restrictions)
- Can edit any enquiry including converted ones
- Cannot delete enquiries (no delete API)

## Critical Business Rules

1. **Assignment Logic**:
   - Admin-created enquiry → `assignedTo: null`
   - Counselor-created enquiry → Auto assigned to counselor
   - First counselor action on unassigned → Auto assigned

2. **Access Control**:
   - No access restrictions - anyone can view/update any enquiry
   - History tracking shows who made changes (`changedBy` field)

3. **Status Update Rules** (No Restrictions):
   - Status can be changed **anytime** by anyone
   - Note is **optional** for status changes
   - No lock on `CONVERTED` enquiries
   - `FOLLOW_UP` status requires `followUpDate`

4. **Follow-up Logic**:
   - Today follow-ups: `followUpDate === today`
   - Overdue: `followUpDate < today` AND not converted
   - Default view: today + overdue follow-ups

5. **Admission** (Independent from Enquiry):
   - Admission has its own student data (name, email, mobile, course)
   - No link to Enquiry model
   - Can be edited **anytime** by anyone (no locks)
   - Same student can have multiple admissions for different courses
   - **Installments array** for payment tracking
   - **Upcoming installment sorting** for better management

6. **Admission Validation** (Course-Level Integrity):
   - **Core Rule**: Use (mobile + course) as unique identity for admission validation
   - **Mobile Number Normalization**:
     - All mobile numbers stored in format: `XXXXXXXXXX` (10 digits)
     - Automatic normalization applied during creation and updates
     - Supports various input formats: `9876543210`, `+919876543210`, `919876543210`
   - **Database-Level Protection**:
     - Compound unique index on `(mobile + course)` in Admission collection
     - Prevents duplicate admissions even if API validation fails
   - **Enquiry Update Restrictions**:
     - Cannot change course if admission exists for current course
     - Cannot change status if admission exists for current course
     - Safe fields (notes, etc.) can still be updated
     - Error message: "Cannot change course. Admission already exists for this course."
   - **Admission Creation Restrictions**:
     - Cannot create duplicate admission for same mobile + course
     - Error message: "Student already admitted in this course"
   - **Multiple Courses Supported**: Same student can have admissions for different courses
   - **Enquiry Locking**: Once admission exists for (mobile + course), enquiry becomes locked for critical changes

7. **Payment** (Simplified):
   - Simple payment record with amount, mode, date, note
   - No payment types, statuses, refund tracking
   - Notes can describe payment type ("initial", "full", "refund")
   - **Overdue installment checking** available

8. **Smart CRM Notification Engine (FCM & Schedulers)**:
   - **FCM Token Deduplication**: Enforces unique token association in the database by removing FCM registration keys from any old user profiles upon new registrations, preventing cross-profile duplicate delivery.
   - **Send-Time Deduplication**: Filters recipient FCM token arrays to ensure each push payload is sent exactly once per distinct device token in parallel streams.
   - **10:00 AM Daily Reminders**: Dispatches comprehensive alerts including today's follow-ups, payment due collections, overdue alerts, and stagnant enquiries.
   - **Hourly Counselor Reminders**: Sweeps and queries pending leads (`CONTACTED`, `INTERESTED` or `FOLLOW_UP` dates) and outstanding payment installments to generate high-priority dashboard notifications.
   - **Fun/Engaging Vibes**: Prompts users at 6:00 AM (funny wake-up), 10:00 AM (office startup), and 10:00 PM (funny sleep) with custom Hinglish templates.
