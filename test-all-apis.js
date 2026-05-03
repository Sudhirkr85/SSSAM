// API TEST FILE - Test All Endpoints
// Run with: node test-all-apis.js

const BASE_URL = 'http://localhost:5000';

// Test data
const testEnquiry = {
  name: "Test User",
  email: "test@example.com",
  mobile: "9876543210",
  course: "Full Stack Development",
  source: "website",
  status: "NEW",
  note: "Test enquiry"
};

const testAdmission = {
  name: "Test Student",
  email: "student@example.com",
  mobile: "9876543211",
  course: "Full Stack Development",
  admissionDate: new Date().toISOString(),
  totalFees: 50000,
  registrationAmount: 5000,
  paymentMode: "CASH",
  installments: [
    {
      amount: 15000,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      note: "First installment"
    },
    {
      amount: 15000,
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      note: "Second installment"
    },
    {
      amount: 15000,
      dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      note: "Third installment"
    }
  ]
};

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', data = null, token = null) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const result = await response.json();
    
    console.log(`\n${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    return { success: response.ok, data: result, status: response.status };
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
}

// Test function to check validation errors
async function testValidation(endpoint, data, token) {
  console.log(`\n=== TESTING VALIDATION FOR ${endpoint} ===`);
  
  // Test with missing required fields
  const invalidData = {};
  const result = await apiCall(endpoint, 'POST', invalidData, token);
  
  if (!result.success && result.data.errors) {
    console.log('❌ VALIDATION ERRORS FOUND:');
    result.data.errors.forEach(error => {
      console.log(`  Field: ${error.field}, Message: ${error.message}`);
    });
  }
  
  return result;
}

// Main test function
async function runAllTests() {
  console.log('🚀 STARTING API TESTS...\n');
  
  // You'll need to get a valid JWT token first
  console.log('⚠️  NOTE: You need to set a valid JWT token below');
  console.log('   1. Login to get token');
  console.log('   2. Replace YOUR_JWT_TOKEN below\n');
  
  const JWT_TOKEN = 'YOUR_JWT_TOKEN'; // <-- REPLACE THIS
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN') {
    console.log('❌ Please set JWT_TOKEN variable first');
    return;
  }
  
  // Test 1: Create Enquiry
  console.log('\n=== TEST 1: CREATE ENQUIRY ===');
  const createResult = await apiCall('/api/enquiries', 'POST', testEnquiry, JWT_TOKEN);
  
  if (createResult.success) {
    const enquiryId = createResult.data.data.enquiry._id;
    console.log('✅ Enquiry created successfully:', enquiryId);
    
    // Test 2: List Enquiries
    console.log('\n=== TEST 2: LIST ENQUIRIES ===');
    await apiCall('/api/enquiries', 'GET', null, JWT_TOKEN);
    
    // Test 3: Get Single Enquiry
    console.log('\n=== TEST 3: GET SINGLE ENQUIRY ===');
    await apiCall(`/api/enquiries/${enquiryId}`, 'GET', null, JWT_TOKEN);
    
    // Test 4: Update Enquiry
    console.log('\n=== TEST 4: UPDATE ENQUIRY ===');
    const updateData = {
      name: "Updated Test User",
      status: "CONTACTED",
      note: "Updated enquiry"
    };
    await apiCall(`/api/enquiries/${enquiryId}`, 'PUT', updateData, JWT_TOKEN);
    
    // Test 5: Create Admission
    console.log('\n=== TEST 5: CREATE ADMISSION ===');
    const admissionResult = await apiCall('/api/admissions', 'POST', testAdmission, JWT_TOKEN);
    
    if (admissionResult.success) {
      const admissionId = admissionResult.data.data.admission._id;
      console.log('✅ Admission created successfully:', admissionId);
      
      // Test 6: List Admissions
      console.log('\n=== TEST 6: LIST ADMISSIONS ===');
      await apiCall('/api/admissions', 'GET', null, JWT_TOKEN);
      
      // Test 7: Get Single Admission
      console.log('\n=== TEST 7: GET SINGLE ADMISSION ===');
      await apiCall(`/api/admissions/${admissionId}`, 'GET', null, JWT_TOKEN);
      
      // Test 8: Update Admission
      console.log('\n=== TEST 8: UPDATE ADMISSION ===');
      const updateAdmissionData = {
        name: "Updated Test Student",
        status: "active"
      };
      await apiCall(`/api/admissions/${admissionId}`, 'PUT', updateAdmissionData, JWT_TOKEN);
      
      // Test 9: Record Payment
      console.log('\n=== TEST 9: RECORD PAYMENT ===');
      const paymentData = {
        amount: 5000,
        paymentMode: "CASH",
        note: "Registration payment"
      };
      await apiCall(`/api/admissions/${admissionId}/payments`, 'POST', paymentData, JWT_TOKEN);
      
      // Test 10: List Payments for Admission
      console.log('\n=== TEST 10: LIST PAYMENTS FOR ADMISSION ===');
      await apiCall(`/api/admissions/${admissionId}/payments`, 'GET', null, JWT_TOKEN);
    }
    
    // Test 11: List All Payments
    console.log('\n=== TEST 11: LIST ALL PAYMENTS ===');
    await apiCall('/api/payments', 'GET', null, JWT_TOKEN);
    
    // Test 12: Check Overdue Installments
    console.log('\n=== TEST 12: CHECK OVERDUE INSTALLMENTS ===');
    await apiCall('/api/payments/check-overdue', 'POST', null, JWT_TOKEN);
    
  } else {
    console.log('❌ Failed to create enquiry');
    
    // Test validation errors
    await testValidation('/api/enquiries', {}, JWT_TOKEN);
  }
  
  // Test Public Enquiry (no auth required)
  console.log('\n=== TEST 13: PUBLIC ENQUIRY ===');
  const publicEnquiry = {
    name: "Public User",
    mobile: "9876543212",
    course: "Data Science",
    note: "Public enquiry test"
  };
  await apiCall('/api/enquiries/public', 'POST', publicEnquiry);
  
  console.log('\n🎉 API TESTS COMPLETED!');
  console.log('\n📋 SUMMARY:');
  console.log('   - Check above results for any errors');
  console.log('   - Look for validation errors');
  console.log('   - Verify all endpoints work correctly');
}

// Test specific validation issue
async function testCourseFieldValidation() {
  console.log('\n=== TESTING COURSE FIELD VALIDATION ===');
  
  const JWT_TOKEN = 'YOUR_JWT_TOKEN'; // <-- REPLACE THIS
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN') {
    console.log('❌ Please set JWT_TOKEN variable first');
    return;
  }
  
  // Test with old field name (should fail)
  console.log('\n--- Testing with courseInterested (old field) ---');
  const oldFieldData = {
    name: "Test User",
    mobile: "9876543210",
    courseInterested: "Full Stack Development" // OLD FIELD NAME
  };
  
  const result1 = await apiCall('/api/enquiries', 'POST', oldFieldData, JWT_TOKEN);
  
  // Test with new field name (should work)
  console.log('\n--- Testing with course (new field) ---');
  const newFieldData = {
    name: "Test User",
    mobile: "9876543210",
    course: "Full Stack Development" // NEW FIELD NAME
  };
  
  const result2 = await apiCall('/api/enquiries', 'POST', newFieldData, JWT_TOKEN);
  
  console.log('\n=== VALIDATION TEST RESULTS ===');
  console.log('Old field (courseInterested):', result1.success ? '✅ PASSED' : '❌ FAILED');
  console.log('New field (course):', result2.success ? '✅ PASSED' : '❌ FAILED');
  
  if (!result1.success && result2.success) {
    console.log('✅ Field name migration successful!');
  } else {
    console.log('❌ Issue with field name migration');
  }
}

// Run tests
if (require.main === module) {
  // Uncomment the test you want to run
  runAllTests();
  // testCourseFieldValidation();
}

module.exports = {
  apiCall,
  runAllTests,
  testCourseFieldValidation,
  testEnquiry,
  testAdmission
};
