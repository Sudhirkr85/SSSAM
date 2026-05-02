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
  totalFees, registrationAmount, status,
  createdBy, updatedBy, createdAt, updatedAt,
  counselorId, isDefaulted, writeOffAmount
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
- **Single Update API**: All fields in one PUT request
- **Follow-up Management**: Today and overdue follow-up tracking
- **Admission & Payment Tracking**: Full financial management
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

### Admissions & Payments

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/admissions` | Admin, Counselor | Create admission |
| GET | `/api/admissions` | Admin | List all admissions |
| GET | `/api/admissions/:id` | Admin, Counselor | Get admission |
| PUT | `/api/admissions/:id/fees` | Admin | Update total fees |
| POST | `/api/admissions/:id/payment-plan` | Admin, Counselor | Set payment plan |
| POST | `/api/payments` | Admin, Counselor | Record payment |
| GET | `/api/payments/admission/:admissionId` | Admin, Counselor | Get payments by admission |

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

6. **Payment** (Simplified):
   - Simple payment record with amount, mode, date, note
   - No payment types, statuses, refund tracking
   - Notes can describe payment type ("initial", "full", "refund")
