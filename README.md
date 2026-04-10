# Institute Enquiry Management System

A production-ready CRM backend for managing institute enquiries, admissions, and payments.

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- Bcrypt for password hashing
- Clean MVC Architecture

## Features

- Role-based access control (Admin & Counselor)
- Auto-assignment logic for enquiries
- Search, filter, and pagination
- Payment tracking
- Follow-up management

## Installation

```bash
npm install
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

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

- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register user (Admin only)

### Enquiries

- `POST /api/enquiries` - Create enquiry
- `GET /api/enquiries` - List enquiries (with search, filter, pagination)
- `GET /api/enquiries/:id` - Get single enquiry
- `PUT /api/enquiries/:id/status` - Update status (triggers auto-assignment)
- `POST /api/enquiries/:id/notes` - Add note (triggers auto-assignment)
- `PUT /api/enquiries/:id/followup` - Set follow-up date
- `DELETE /api/enquiries/:id` - Delete enquiry (Admin only)

## User Roles

1. **Admin**: Full access to all resources
2. **Counselor**: Can create enquiries, assigned enquiries are locked to them

## Auto-Assignment Logic

- New enquiries start with `assignedTo: null`
- First action (status update or note) by a counselor auto-assigns the enquiry
- Once assigned, only the assigned counselor can modify it
- Admin can always access and modify any enquiry
