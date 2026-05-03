// COMPLETE ENQUIRY API TEST WITH DUMMY DATA
// This script will test all 7 enquiry APIs and add dummy data
// Run: node test-all-enquiry-apis.js

const BASE_URL = 'http://localhost:5000';

// Dummy data for testing
const dummyEnquiries = [
  {
    name: "Rahul Sharma",
    email: "rahul.sharma@gmail.com",
    mobile: "9876543210",
    course: "Full Stack Development",
    source: "website",
    status: "NEW",
    note: "Interested in web development, saw Facebook ad",
    followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days from now
  },
  {
    name: "Priya Patel",
    email: "priya.patel@yahoo.com",
    mobile: "9876543211",
    course: "Data Science",
    source: "referral",
    referenceName: "Amit Kumar",
    referenceContact: "9876543212",
    status: "CONTACTED",
    note: "Referred by friend, interested in ML course",
    followUpDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day from now
  },
  {
    name: "Amit Kumar",
    mobile: "9876543213",
    course: "Mobile App Development",
    source: "walk_in",
    walkInBroughtBy: "Friend",
    status: "FOLLOW_UP",
    note: "Walked in with friend, wants to learn Flutter",
    followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days from now
  },
  {
    name: "Sita Devi",
    email: "sita.devi@hotmail.com",
    mobile: "9876543214",
    course: "Python Programming",
    source: "phone_call",
    status: "INTERESTED",
    note: "Called after seeing brochure, wants weekend batch",
    followUpDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days from now
  },
  {
    name: "Vikram Singh",
    email: "vikram.singh@gmail.com",
    mobile: "9876543215",
    course: "React Development",
    source: "social_media",
    status: "ADMISSION_PROCESS",
    note: "Found on Instagram, ready to enroll",
    followUpDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day from now
  },
  {
    name: "Neha Gupta",
    mobile: "9876543216",
    course: "UI/UX Design",
    source: "advertisement",
    status: "CONVERTED",
    note: "Saw newspaper ad, enrolled immediately",
    followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
  },
  {
    name: "Rohit Verma",
    email: "rohit.verma@outlook.com",
    mobile: "9876543217",
    course: "Node.js Backend",
    source: "other",
    status: "NOT_INTERESTED",
    note: "Not interested right now, will contact later",
    followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  }
];

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
    
    return {
      success: response.ok,
      status: response.status,
      data: result,
      endpoint: `${method} ${endpoint}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      endpoint: `${method} ${endpoint}`
    };
  }
}

// Test all enquiry APIs
async function testAllEnquiryAPIs() {
  console.log('🚀 TESTING ALL ENQUIRY APIs WITH DUMMY DATA');
  console.log('==========================================\n');
  
  const JWT_TOKEN = 'YOUR_JWT_TOKEN'; // <-- REPLACE THIS
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN') {
    console.log('❌ Please set JWT_TOKEN variable first');
    console.log('   1. Login to get token');
    console.log('   2. Replace YOUR_JWT_TOKEN above');
    console.log('   3. Run this script again\n');
    
    console.log('🔄 Testing PUBLIC API only (no auth required)...\n');
    await testPublicAPIOnly();
    return;
  }
  
  let createdEnquiries = [];
  let testResults = [];
  
  // TEST 1: Create Enquiries (POST /api/enquiries)
  console.log('📝 TEST 1: CREATE ENQUIRIES');
  console.log('========================');
  
  for (let i = 0; i < dummyEnquiries.length; i++) {
    const enquiry = dummyEnquiries[i];
    console.log(`\n--- Creating Enquiry ${i + 1}: ${enquiry.name} ---`);
    
    const result = await apiCall('/api/enquiries', 'POST', enquiry, JWT_TOKEN);
    testResults.push(result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Enquiry created');
      console.log(`   ID: ${result.data.data.enquiry._id}`);
      console.log(`   Status: ${result.data.data.enquiry.status}`);
      console.log(`   Course: ${result.data.data.enquiry.course}`);
      createdEnquiries.push(result.data.data.enquiry);
    } else {
      console.log('❌ FAILED: Could not create enquiry');
      console.log('   Error:', result.data?.message || result.error);
    }
  }
  
  if (createdEnquiries.length === 0) {
    console.log('\n❌ No enquiries created, cannot continue with other tests');
    return;
  }
  
  // TEST 2: List Enquiries (GET /api/enquiries)
  console.log('\n📋 TEST 2: LIST ENQUIRIES');
  console.log('========================');
  
  const listResult = await apiCall('/api/enquiries', 'GET', null, JWT_TOKEN);
  testResults.push(listResult);
  
  if (listResult.success) {
    console.log('✅ SUCCESS: Enquiries listed');
    console.log(`   Total: ${listResult.data.data.pagination.totalCount}`);
    console.log(`   Page: ${listResult.data.data.pagination.page}`);
    console.log(`   Has next: ${listResult.data.data.pagination.hasNextPage}`);
  } else {
    console.log('❌ FAILED: Could not list enquiries');
    console.log('   Error:', listResult.data?.message || listResult.error);
  }
  
  // TEST 3: Get Single Enquiry (GET /api/enquiries/:id)
  console.log('\n🔍 TEST 3: GET SINGLE ENQUIRY');
  console.log('==========================');
  
  const firstEnquiry = createdEnquiries[0];
  const getResult = await apiCall(`/api/enquiries/${firstEnquiry._id}`, 'GET', null, JWT_TOKEN);
  testResults.push(getResult);
  
  if (getResult.success) {
    console.log('✅ SUCCESS: Single enquiry retrieved');
    console.log(`   Name: ${getResult.data.data.enquiry.name}`);
    console.log(`   Mobile: ${getResult.data.data.enquiry.mobile}`);
    console.log(`   Status: ${getResult.data.data.enquiry.status}`);
    console.log(`   Status History: ${getResult.data.data.enquiry.statusHistory.length} entries`);
  } else {
    console.log('❌ FAILED: Could not get single enquiry');
    console.log('   Error:', getResult.data?.message || getResult.error);
  }
  
  // TEST 4: Update Enquiry (PUT /api/enquiries/:id)
  console.log('\n✏️  TEST 4: UPDATE ENQUIRY');
  console.log('========================');
  
  const updateData = {
    name: `${firstEnquiry.name} (Updated)`,
    email: firstEnquiry.email ? firstEnquiry.email.replace('@', '.updated@') : 'updated@example.com',
    status: "FOLLOW_UP",
    note: "Updated via API test - interested and ready to proceed",
    followUpDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const updateResult = await apiCall(`/api/enquiries/${firstEnquiry._id}`, 'PUT', updateData, JWT_TOKEN);
  testResults.push(updateResult);
  
  if (updateResult.success) {
    console.log('✅ SUCCESS: Enquiry updated');
    console.log(`   Updated name: ${updateResult.data.data.enquiry.name}`);
    console.log(`   Updated status: ${updateResult.data.data.enquiry.status}`);
    console.log(`   Status History: ${updateResult.data.data.enquiry.statusHistory.length} entries`);
  } else {
    console.log('❌ FAILED: Could not update enquiry');
    console.log('   Error:', updateResult.data?.message || updateResult.error);
  }
  
  // TEST 5: Assign Enquiry (PUT /api/enquiries/:id/assign)
  console.log('\n👤 TEST 5: ASSIGN ENQUIRY');
  console.log('========================');
  
  // Note: This requires a valid counselor ID - for testing we'll use the current user's ID
  const assignData = {
    counselorId: JWT_TOKEN ? "CURRENT_USER_ID" : null // You may need to update this
  };
  
  const assignResult = await apiCall(`/api/enquiries/${firstEnquiry._id}/assign`, 'PUT', assignData, JWT_TOKEN);
  testResults.push(assignResult);
  
  if (assignResult.success) {
    console.log('✅ SUCCESS: Enquiry assigned');
    console.log(`   Assigned to: ${assignResult.data.data.enquiry.assignedTo?.name || 'Unknown'}`);
  } else {
    console.log('❌ FAILED: Could not assign enquiry');
    console.log('   Error:', assignResult.data?.message || assignResult.error);
    console.log('   (This may fail if counselorId is invalid)');
  }
  
  // TEST 6: List with Filters (GET /api/enquiries with filters)
  console.log('\n🔍 TEST 6: LIST WITH FILTERS');
  console.log('==========================');
  
  const filterTests = [
    { status: 'NEW', description: 'Status NEW' },
    { search: 'Rahul', description: 'Search by name' },
    { course: 'Full Stack', description: 'Course filter' },
    { page: 1, limit: 5, description: 'Pagination' }
  ];
  
  for (const filter of filterTests) {
    console.log(`\n--- Filter: ${filter.description} ---`);
    const filterResult = await apiCall('/api/enquiries', 'GET', filter, JWT_TOKEN);
    testResults.push(filterResult);
    
    if (filterResult.success) {
      console.log('✅ SUCCESS: Filter applied');
      console.log(`   Results: ${filterResult.data.data.enquiries.length} enquiries`);
    } else {
      console.log('❌ FAILED: Filter failed');
      console.log('   Error:', filterResult.data?.message || filterResult.error);
    }
  }
  
  // TEST 7: Public Enquiry (POST /api/enquiries/public)
  console.log('\n🌐 TEST 7: PUBLIC ENQUIRY');
  console.log('========================');
  
  const publicEnquiry = {
    name: "Public User",
    mobile: "9876543299",
    course: "Web Development Basics",
    note: "Public enquiry from website"
  };
  
  const publicResult = await apiCall('/api/enquiries/public', 'POST', publicEnquiry);
  testResults.push(publicResult);
  
  if (publicResult.success) {
    console.log('✅ SUCCESS: Public enquiry created');
    console.log(`   Name: ${publicResult.data.data.enquiry.name}`);
    console.log(`   Status: ${publicResult.data.data.enquiry.status}`);
  } else {
    console.log('❌ FAILED: Could not create public enquiry');
    console.log('   Error:', publicResult.data?.message || publicResult.error);
  }
  
  // SUMMARY
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${testResults.length}`);
  console.log(`❌ Failed: ${failed}/${testResults.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(r => !r.success).forEach(result => {
      console.log(`   ${result.endpoint}: ${result.data?.message || result.error}`);
    });
  }
  
  console.log('\n📋 Created Enquiries Summary:');
  createdEnquiries.forEach((enquiry, index) => {
    console.log(`   ${index + 1}. ${enquiry.name} - ${enquiry.course} - ${enquiry.status}`);
  });
  
  console.log('\n🎉 ENQUIRY API TESTING COMPLETED!');
  console.log('   All dummy data added successfully');
  console.log('   Check your database for the new enquiries');
}

// Test public API only (no auth required)
async function testPublicAPIOnly() {
  console.log('🌐 TESTING PUBLIC ENQUIRY API ONLY');
  console.log('===================================\n');
  
  const publicEnquiry = {
    name: "Public Test User",
    mobile: "9876543288",
    course: "JavaScript Basics",
    note: "Testing public API"
  };
  
  const result = await apiCall('/api/enquiries/public', 'POST', publicEnquiry);
  
  if (result.success) {
    console.log('✅ SUCCESS: Public enquiry created');
    console.log(`   Name: ${result.data.data.enquiry.name}`);
    console.log(`   Course: ${result.data.data.enquiry.course}`);
    console.log(`   Status: ${result.data.data.enquiry.status}`);
  } else {
    console.log('❌ FAILED: Could not create public enquiry');
    console.log('   Error:', result.data?.message || result.error);
  }
  
  console.log('\n💡 To test all APIs, get a JWT token and update the JWT_TOKEN variable');
}

// Run the tests
if (require.main === module) {
  testAllEnquiryAPIs();
}

module.exports = {
  testAllEnquiryAPIs,
  dummyEnquiries
};
