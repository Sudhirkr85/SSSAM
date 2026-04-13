# Institute Enquiry Management System

A production-ready CRM backend for managing institute enquiries, admissions, and payments with strict ownership, clean architecture, and scalable design.

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- Bcrypt for password hashing
- Clean Architecture (Controllers, Services, Models, Middlewares, Utils)
- Transaction Support (with fallback)

## Features

- **Role-based access control**: Admin (full access) & Counselor (restricted access)
- **Strict Ownership**: Counselors can only access their assigned + unassigned enquiries
- **Auto-assignment logic**: First action auto-assigns unassigned enquiries
- **Combined Update API**: Status + Note + FollowUpDate in ONE request
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

### Enquiries

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/enquiries` | Admin, Counselor | Create enquiry |
| GET | `/api/enquiries` | Admin, Counselor | List enquiries (counselor: assigned + unassigned only) |
| GET | `/api/enquiries/all` | Admin, Counselor | List ALL enquiries (read-only for counselor) |
| GET | `/api/enquiries/:id` | Admin, Counselor | Get single enquiry |
| PUT | `/api/enquiries/:id/update` | Admin, Counselor | **Combined API**: Update status + note + followUpDate |
| DELETE | `/api/enquiries/:id` | Admin only | Delete enquiry |

**Combined Update API (PUT /api/enquiries/:id/update)**:
```json
{
  "status": "FOLLOW_UP",
  "note": "Called the student, will follow up tomorrow",
  "followUpDate": "2026-04-15"
}
```
**Rules**:
- Note is required when updating status
- `followUpDate` is required when status is `FOLLOW_UP`
- Converted enquiries are locked (admin can still edit)

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
- Can access: unassigned enquiries + their assigned enquiries
- **Cannot**: Edit other counselors' enquiries, delete enquiries
- First action on unassigned enquiry auto-assigns it
- Cannot edit converted enquiries

## Critical Business Rules

1. **Assignment Logic**:
   - Admin-created enquiry → `assignedTo: null`
   - Counselor-created enquiry → Auto assigned to counselor
   - First counselor action on unassigned → Auto assigned

2. **Access Control**:
   - Counselor can access if: `enquiry.assignedTo === null` OR `enquiry.assignedTo === user.id`
   - Others are blocked with 403

3. **Status Update Rules**:
   - Every status update MUST include a note
   - `FOLLOW_UP` status requires `followUpDate`
   - `CONVERTED` enquiries are locked (only admin can edit)

4. **Follow-up Logic**:
   - Today follow-ups: `followUpDate === today`
   - Overdue: `followUpDate < today` AND not converted
   - Default view: today + overdue follow-ups

5. **Admission Conversion**:
   - Requires: course, total fees, installment plan
   - Creates Admission record linked to enquiry
   - Counselor can add payments and modify installments
   - Admin has full financial control
