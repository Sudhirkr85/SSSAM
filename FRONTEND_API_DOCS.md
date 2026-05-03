# Frontend API Documentation

## Authentication Headers
All API calls (except login) require:
```javascript
headers: {
  'Authorization': 'Bearer JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## ENQUIRY APIs

### 1. Create Enquiry
**POST** `/api/enquiries`

**Request Body:**
```javascript
{
  "name": "Ram Kumar",
  "email": "ram@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "source": "website",
  "referenceName": null,
  "referenceContact": null,
  "walkInBroughtBy": null,
  "status": "NEW",
  "note": "Interested in web development",
  "followUpDate": "2026-05-15T10:00:00Z",
  "assignedTo": "counselorId" // Optional - auto-assigned if not provided
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiry created successfully",
  "data": {
    "enquiry": {
      "_id": "64f1234567890abcdef12345",
      "name": "Ram Kumar",
      "email": "ram@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "source": "website",
      "referenceName": null,
      "referenceContact": null,
      "walkInBroughtBy": null,
      "status": "NEW",
      "note": "Interested in web development",
      "followUpDate": "2026-05-15T10:00:00Z",
      "assignedTo": "64f1234567890abcdef12346",
      "statusHistory": [
        {
          "status": "NEW",
          "note": "Enquiry created",
          "changedBy": "64f1234567890abcdef12347",
          "changedAt": "2026-05-02T12:00:00Z"
        }
      ],
      "createdBy": "64f1234567890abcdef12347",
      "createdAt": "2026-05-02T12:00:00Z",
      "updatedAt": "2026-05-02T12:00:00Z",
      "__v": 0
    }
  }
}
```

---

### 2. List Enquiries
**GET** `/api/enquiries`

**Query Parameters:**
```javascript
// Optional filters
{
  page: 1,                    // Pagination
  limit: 10,
  status: "NEW,CONTACTED",    // Multiple statuses separated by comma
  search: "Ram",              // Search by name, email, mobile, course
  assignedTo: "me",          // "me" for current user, "null" for unassigned
  followUpToday: true,       // Boolean
  followUpOverdue: true,      // Boolean
  followUpDate: "2026-05-15", // Specific date
  view: "default",            // Default view
  dateFrom: "2026-05-01",     // Date range
  dateTo: "2026-05-31"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiries retrieved successfully",
  "data": {
    "enquiries": [
      {
        "_id": "64f1234567890abcdef12345",
        "name": "Ram Kumar",
        "email": "ram@example.com",
        "mobile": "9876543210",
        "course": "Full Stack Development",
        "status": "NEW",
        "followUpDate": "2026-05-15T10:00:00Z",
        "assignedTo": {
          "_id": "64f1234567890abcdef12346",
          "name": "John Counselor",
          "email": "john@example.com"
        },
        "createdBy": {
          "_id": "64f1234567890abcdef12347",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "isUnassigned": false,
        "isOverdue": false,
        "createdAt": "2026-05-02T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 3. Get Single Enquiry
**GET** `/api/enquiries/:id`

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiry retrieved successfully",
  "data": {
    "enquiry": {
      "_id": "64f1234567890abcdef12345",
      "name": "Ram Kumar",
      "email": "ram@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "source": "website",
      "status": "NEW",
      "note": "Interested in web development",
      "followUpDate": "2026-05-15T10:00:00Z",
      "assignedTo": {
        "_id": "64f1234567890abcdef12346",
        "name": "John Counselor",
        "email": "john@example.com"
      },
      "statusHistory": [
        {
          "status": "NEW",
          "note": "Enquiry created",
          "changedBy": "64f1234567890abcdef12347",
          "changedAt": "2026-05-02T12:00:00Z"
        }
      ],
      "createdBy": {
        "_id": "64f1234567890abcdef12347",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2026-05-02T12:00:00Z",
      "updatedAt": "2026-05-02T12:00:00Z"
    }
  }
}
```

---

### 4. Update Enquiry (Full Update)
**PUT** `/api/enquiries/:id`

**Request Body (Any field can be updated):**
```javascript
{
  "name": "Ram Kumar Sharma",
  "email": "ram.sharma@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "source": "walk_in",
  "referenceName": "Sita",
  "referenceContact": "9876543211",
  "walkInBroughtBy": "Friend",
  "status": "FOLLOW_UP",
  "note": "Called and interested, will visit tomorrow",
  "followUpDate": "2026-05-16T14:00:00Z",
  "assignedTo": "64f1234567890abcdef12348"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiry updated successfully",
  "data": {
    "enquiry": {
      "_id": "64f1234567890abcdef12345",
      "name": "Ram Kumar Sharma",
      "email": "ram.sharma@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "source": "walk_in",
      "referenceName": "Sita",
      "referenceContact": "9876543211",
      "walkInBroughtBy": "Friend",
      "status": "FOLLOW_UP",
      "note": "Called and interested, will visit tomorrow",
      "followUpDate": "2026-05-16T14:00:00Z",
      "assignedTo": "64f1234567890abcdef12348",
      "statusHistory": [
        {
          "status": "NEW",
          "note": "Enquiry created",
          "changedBy": "64f1234567890abcdef12347",
          "changedAt": "2026-05-02T12:00:00Z"
        },
        {
          "status": "FOLLOW_UP",
          "note": "Called and interested, will visit tomorrow",
          "changedBy": "64f1234567890abcdef12347",
          "changedAt": "2026-05-02T13:00:00Z"
        }
      ],
      "createdAt": "2026-05-02T12:00:00Z",
      "updatedAt": "2026-05-02T13:00:00Z"
    }
  }
}
```

---

### 5. Assign Enquiry (Admin Only)
**PUT** `/api/enquiries/:id/assign`

**Request Body:**
```javascript
{
  "counselorId": "64f1234567890abcdef12348"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiry assigned to counselor successfully",
  "data": {
    "enquiry": {
      "_id": "64f1234567890abcdef12345",
      "name": "Ram Kumar",
      "email": "ram@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "status": "NEW",
      "assignedTo": "64f1234567890abcdef12348",
      "createdAt": "2026-05-02T12:00:00Z",
      "updatedAt": "2026-05-02T13:00:00Z"
    }
  }
}
```

---

### 6. Public Enquiry (No Auth Required)
**POST** `/api/enquiries/public`

**Request Body:**
```javascript
{
  "name": "Public User",
  "email": "public@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "note": "Interested from website"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Enquiry submitted successfully",
  "data": {
    "enquiry": {
      "_id": "64f1234567890abcdef12349",
      "name": "Public User",
      "email": "public@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "note": "Interested from website",
      "status": "NEW",
      "assignedTo": null,
      "statusHistory": [
        {
          "status": "NEW",
          "note": "Enquiry created",
          "changedBy": "64f1234567890abcdef12347",
          "changedAt": "2026-05-02T14:00:00Z"
        }
      ],
      "createdAt": "2026-05-02T14:00:00Z",
      "updatedAt": "2026-05-02T14:00:00Z"
    }
  }
}
```

---

## ADMISSION APIs

### 1. Create Admission
**POST** `/api/admissions`

**Request Body:**
```javascript
{
  "name": "Ram Kumar",
  "email": "ram@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "admissionDate": "2026-05-02T10:00:00Z",
  "totalFees": 50000,
  "registrationAmount": 5000,
  "paymentMode": "CASH",
  "installments": [
    {
      "amount": 15000,
      "dueDate": "2026-06-01T10:00:00Z",
      "note": "First installment"
    },
    {
      "amount": 15000,
      "dueDate": "2026-07-01T10:00:00Z",
      "note": "Second installment"
    },
    {
      "amount": 15000,
      "dueDate": "2026-08-01T10:00:00Z",
      "note": "Third installment"
    }
  ]
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Admission created successfully",
  "data": {
    "admission": {
      "_id": "64f1234567890abcdef12350",
      "name": "Ram Kumar",
      "email": "ram@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "admissionDate": "2026-05-02T10:00:00Z",
      "totalFees": 50000,
      "registrationAmount": 5000,
      "installments": [
        {
          "_id": "64f1234567890abcdef12351",
          "amount": 15000,
          "dueDate": "2026-06-01T10:00:00Z",
          "note": "First installment",
          "status": "PENDING"
        },
        {
          "_id": "64f1234567890abcdef12352",
          "amount": 15000,
          "dueDate": "2026-07-01T10:00:00Z",
          "note": "Second installment",
          "status": "PENDING"
        },
        {
          "_id": "64f1234567890abcdef12353",
          "amount": 15000,
          "dueDate": "2026-08-01T10:00:00Z",
          "note": "Third installment",
          "status": "PENDING"
        }
      ],
      "status": "active",
      "counselorId": "64f1234567890abcdef12347",
      "isDefaulted": false,
      "writeOffAmount": null,
      "totalPaid": 5000,
      "remainingAmount": 45000,
      "upcomingInstallment": {
        "_id": "64f1234567890abcdef12351",
        "amount": 15000,
        "dueDate": "2026-06-01T10:00:00Z",
        "note": "First installment",
        "status": "PENDING"
      },
      "createdBy": "64f1234567890abcdef12347",
      "createdAt": "2026-05-02T10:00:00Z",
      "updatedAt": "2026-05-02T10:00:00Z"
    }
  }
}
```

---

### 2. List Admissions
**GET** `/api/admissions`

**Query Parameters:**
```javascript
{
  page: 1,
  limit: 10,
  status: "active",
  course: "Full Stack",
  search: "Ram",
  sortBy: "upcomingInstallment" // Sort by nearest upcoming installment
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Admissions retrieved successfully",
  "data": {
    "admissions": [
      {
        "_id": "64f1234567890abcdef12350",
        "name": "Ram Kumar",
        "email": "ram@example.com",
        "mobile": "9876543210",
        "course": "Full Stack Development",
        "admissionDate": "2026-05-02T10:00:00Z",
        "totalFees": 50000,
        "registrationAmount": 5000,
        "installments": [
          {
            "_id": "64f1234567890abcdef12351",
            "amount": 15000,
            "dueDate": "2026-06-01T10:00:00Z",
            "note": "First installment",
            "status": "PENDING"
          }
        ],
        "status": "active",
        "counselorId": {
          "_id": "64f1234567890abcdef12347",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "totalPaid": 5000,
        "remainingAmount": 45000,
        "upcomingInstallment": {
          "_id": "64f1234567890abcdef12351",
          "amount": 15000,
          "dueDate": "2026-06-01T10:00:00Z",
          "note": "First installment",
          "status": "PENDING"
        },
        "nextDueDate": "2026-06-01T10:00:00Z",
        "createdAt": "2026-05-02T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 15,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 3. Get Single Admission
**GET** `/api/admissions/:id`

**Response:**
```javascript
{
  "success": true,
  "message": "Admission retrieved successfully",
  "data": {
    "admission": {
      "_id": "64f1234567890abcdef12350",
      "name": "Ram Kumar",
      "email": "ram@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "admissionDate": "2026-05-02T10:00:00Z",
      "totalFees": 50000,
      "registrationAmount": 5000,
      "installments": [
        {
          "_id": "64f1234567890abcdef12351",
          "amount": 15000,
          "dueDate": "2026-06-01T10:00:00Z",
          "note": "First installment",
          "status": "PENDING"
        },
        {
          "_id": "64f1234567890abcdef12352",
          "amount": 15000,
          "dueDate": "2026-07-01T10:00:00Z",
          "note": "Second installment",
          "status": "PENDING"
        },
        {
          "_id": "64f1234567890abcdef12353",
          "amount": 15000,
          "dueDate": "2026-08-01T10:00:00Z",
          "note": "Third installment",
          "status": "PENDING"
        }
      ],
      "status": "active",
      "counselorId": {
        "_id": "64f1234567890abcdef12347",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "isDefaulted": false,
      "writeOffAmount": null,
      "totalPaid": 5000,
      "remainingAmount": 45000,
      "upcomingInstallment": {
        "_id": "64f1234567890abcdef12351",
        "amount": 15000,
        "dueDate": "2026-06-01T10:00:00Z",
        "note": "First installment",
        "status": "PENDING"
      },
      "createdAt": "2026-05-02T10:00:00Z",
      "updatedAt": "2026-05-02T10:00:00Z"
    }
  }
}
```

---

### 4. Update Admission (Full Update)
**PUT** `/api/admissions/:id`

**Request Body (Any field can be updated):**
```javascript
{
  "name": "Ram Kumar Sharma",
  "email": "ram.sharma@example.com",
  "mobile": "9876543210",
  "course": "Full Stack Development",
  "admissionDate": "2026-05-01T10:00:00Z",
  "totalFees": 55000,
  "registrationAmount": 5000,
  "status": "active",
  "installments": [
    {
      "amount": 16667,
      "dueDate": "2026-06-01T10:00:00Z",
      "note": "Updated first installment",
      "status": "PENDING"
    },
    {
      "amount": 16667,
      "dueDate": "2026-07-01T10:00:00Z",
      "note": "Updated second installment",
      "status": "PENDING"
    },
    {
      "amount": 16666,
      "dueDate": "2026-08-01T10:00:00Z",
      "note": "Updated third installment",
      "status": "PENDING"
    }
  ],
  "isDefaulted": false,
  "writeOffAmount": null
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Admission updated successfully",
  "data": {
    "admission": {
      "_id": "64f1234567890abcdef12350",
      "name": "Ram Kumar Sharma",
      "email": "ram.sharma@example.com",
      "mobile": "9876543210",
      "course": "Full Stack Development",
      "admissionDate": "2026-05-01T10:00:00Z",
      "totalFees": 55000,
      "registrationAmount": 5000,
      "installments": [
        // Updated installments array
      ],
      "status": "active",
      "counselorId": {
        "_id": "64f1234567890abcdef12347",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "totalPaid": 5000,
      "remainingAmount": 50000,
      "upcomingInstallment": {
        // Next upcoming installment
      },
      "updatedAt": "2026-05-02T11:00:00Z"
    }
  }
}
```

---

### 5. Record Payment
**POST** `/api/admissions/:id/payments`

**Request Body:**
```javascript
{
  "amount": 15000,
  "paymentMode": "CASH",
  "paymentDate": "2026-06-01T10:00:00Z",
  "note": "First installment payment"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "_id": "64f1234567890abcdef12354",
      "admissionId": "64f1234567890abcdef12350",
      "amount": 15000,
      "paymentMode": "CASH",
      "paymentDate": "2026-06-01T10:00:00Z",
      "note": "First installment payment",
      "createdBy": {
        "_id": "64f1234567890abcdef12347",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2026-05-02T11:00:00Z",
      "updatedAt": "2026-05-02T11:00:00Z"
    },
    "admission": {
      "_id": "64f1234567890abcdef12350",
      "name": "Ram Kumar",
      "course": "Full Stack Development",
      "totalFees": 50000,
      "totalPaid": 20000,
      "remainingAmount": 30000,
      "installments": [
        {
          "_id": "64f1234567890abcdef12351",
          "amount": 15000,
          "dueDate": "2026-06-01T10:00:00Z",
          "note": "First installment",
          "status": "PAID" // Status updated to PAID
        },
        // Other installments remain PENDING
      ],
      "upcomingInstallment": {
        // Next upcoming installment
      }
    }
  }
}
```

---

### 6. List Payments for Admission
**GET** `/api/admissions/:id/payments`

**Response:**
```javascript
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "payments": [
      {
        "_id": "64f1234567890abcdef12355",
        "admissionId": "64f1234567890abcdef12350",
        "amount": 5000,
        "paymentMode": "CASH",
        "paymentDate": "2026-05-02T10:00:00Z",
        "note": "Registration amount",
        "createdBy": {
          "_id": "64f1234567890abcdef12347",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-05-02T10:00:00Z",
        "updatedAt": "2026-05-02T10:00:00Z"
      },
      {
        "_id": "64f1234567890abcdef12354",
        "admissionId": "64f1234567890abcdef12350",
        "amount": 15000,
        "paymentMode": "CASH",
        "paymentDate": "2026-06-01T10:00:00Z",
        "note": "First installment payment",
        "createdBy": {
          "_id": "64f1234567890abcdef12347",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-05-02T11:00:00Z",
        "updatedAt": "2026-05-02T11:00:00Z"
      }
    ]
  }
}
```

---

## PAYMENT APIs

### 1. List All Payments (Global)
**GET** `/api/payments`

**Query Parameters:**
```javascript
{
  page: 1,
  limit: 10,
  admissionId: "64f1234567890abcdef12350",
  dateFrom: "2026-05-01",
  dateTo: "2026-05-31",
  search: "Ram"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "payments": [
      {
        "_id": "64f1234567890abcdef12354",
        "admissionId": "64f1234567890abcdef12350",
        "amount": 15000,
        "paymentMode": "CASH",
        "paymentDate": "2026-06-01T10:00:00Z",
        "note": "First installment payment",
        "studentName": "Ram Kumar",
        "studentMobile": "9876543210",
        "course": "Full Stack Development",
        "createdBy": {
          "_id": "64f1234567890abcdef12347",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-05-02T11:00:00Z",
        "updatedAt": "2026-05-02T11:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 2. Check Overdue Installments
**POST** `/api/payments/check-overdue`

**Response:**
```javascript
{
  "success": true,
  "message": "Overdue installments check completed",
  "data": {
    "checkedAdmissions": 15,
    "updatedAdmissions": 3,
    "overdueCount": 5,
    "overdueInstallments": [
      {
        "admissionId": "64f1234567890abcdef12350",
        "installmentId": "64f1234567890abcdef12352",
        "amount": 15000,
        "dueDate": "2026-05-01T10:00:00Z",
        "studentName": "Ram Kumar",
        "course": "Full Stack Development"
      }
    ]
  }
}
```

---

## ERROR RESPONSES

All APIs return errors in this format:
```javascript
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Please provide a valid email address"
      }
    ]
  },
  "statusCode": 400
}
```

Common status codes:
- `400` - Bad Request (Validation errors)
- `401` - Unauthorized (No token)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## FRONTEND IMPLEMENTATION TIPS

### 1. API Client Setup
```javascript
const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = {
  get: async (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },
  
  post: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  put: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

### 2. Example Usage
```javascript
// Create enquiry
const createEnquiry = async (enquiryData) => {
  try {
    const result = await apiClient.post('/enquiries', enquiryData);
    if (result.success) {
      console.log('Enquiry created:', result.data.enquiry);
      return result.data.enquiry;
    } else {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('API Error:', error);
  }
};

// List enquiries with filters
const listEnquiries = async (filters) => {
  const result = await apiClient.get('/enquiries', filters);
  return result.data;
};

// Update enquiry
const updateEnquiry = async (id, updateData) => {
  const result = await apiClient.put(`/enquiries/${id}`, updateData);
  return result.data.enquiry;
};
```

### 3. Date Handling
```javascript
// Format dates for API
const formatDateForAPI = (date) => {
  return new Date(date).toISOString();
};

// Format dates for display
const formatDateForDisplay = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN');
};
```

### 4. Error Handling
```javascript
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    console.error(`API Error ${status}:`, data.error);
    
    if (status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
  } else {
    // Network error
    console.error('Network Error:', error);
  }
};
```

---

## SUMMARY

**Total APIs:**
- **Enquiry**: 7 APIs (Create, List, Get, Update, Assign, Public, Bulk Upload)
- **Admission**: 6 APIs (Create, List, Get, Update, Record Payment, List Payments)
- **Payment**: 2 APIs (List All, Check Overdue)

**Key Features:**
- ✅ No restrictions on updates
- ✅ Full history tracking
- ✅ Installment management
- ✅ Upcoming installment sorting
- ✅ Simple payment recording
- ✅ Comprehensive search & filtering

**Ready for frontend implementation!** 🚀
