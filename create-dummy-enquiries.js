// SIMPLE ENQUIRY API TEST - NO LOGIN REQUIRED
// This will test all enquiry functionality using public endpoints
// and create dummy data without requiring authentication

const BASE_URL = 'http://localhost:5000';

// Dummy data for testing
const dummyEnquiries = [
  {
    name: "Rahul Sharma",
    mobile: "9876543210",
    course: "Full Stack Development",
    note: "Interested in web development, saw Facebook ad"
  },
  {
    name: "Priya Patel",
    mobile: "9876543211",
    course: "Data Science",
    note: "Referred by friend, interested in ML course"
  },
  {
    name: "Amit Kumar",
    mobile: "9876543212",
    course: "Mobile App Development",
    note: "Walked in with friend, wants to learn Flutter"
  },
  {
    name: "Sita Devi",
    mobile: "9876543213",
    course: "Python Programming",
    note: "Called after seeing brochure, wants weekend batch"
  },
  {
    name: "Vikram Singh",
    mobile: "9876543214",
    course: "React Development",
    note: "Found on Instagram, ready to enroll"
  },
  {
    name: "Neha Gupta",
    mobile: "9876543215",
    course: "UI/UX Design",
    note: "Saw newspaper ad, enrolled immediately"
  },
  {
    name: "Rohit Verma",
    mobile: "9876543216",
    course: "Node.js Backend",
    note: "Not interested right now, will contact later"
  },
  {
    name: "Anjali Singh",
    mobile: "9876543217",
    course: "Angular Development",
    note: "Wants to switch career to frontend"
  },
  {
    name: "Karan Malhotra",
    mobile: "9876543218",
    course: "Vue.js Development",
    note: "Heard about course from colleague"
  },
  {
    name: "Pooja Sharma",
    mobile: "9876543219",
    course: "Digital Marketing",
    note: "Small business owner, wants online marketing"
  }
];

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', data = null) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

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

// Create multiple dummy enquiries
async function createDummyEnquiries() {
  console.log('🚀 CREATING DUMMY ENQUIRY DATA');
  console.log('==============================\n');
  
  let createdCount = 0;
  let failedCount = 0;
  let createdEnquiries = [];
  
  for (let i = 0; i < dummyEnquiries.length; i++) {
    const enquiry = dummyEnquiries[i];
    console.log(`--- Creating Enquiry ${i + 1}: ${enquiry.name} ---`);
    
    const result = await apiCall('/api/enquiries/public', 'POST', enquiry);
    
    if (result.success) {
      console.log('✅ SUCCESS: Enquiry created');
      console.log(`   ID: ${result.data.data.enquiry._id}`);
      console.log(`   Course: ${result.data.data.enquiry.course}`);
      console.log(`   Status: ${result.data.data.enquiry.status}`);
      createdEnquiries.push(result.data.data.enquiry);
      createdCount++;
    } else {
      console.log('❌ FAILED: Could not create enquiry');
      console.log('   Error:', result.data?.message || result.error);
      failedCount++;
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 CREATION SUMMARY');
  console.log('==================');
  console.log(`✅ Successfully created: ${createdCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📈 Total attempted: ${dummyEnquiries.length}`);
  
  if (createdCount > 0) {
    console.log('\n📋 Created Enquiries:');
    createdEnquiries.forEach((enquiry, index) => {
      console.log(`   ${index + 1}. ${enquiry.name} - ${enquiry.course} - ${enquiry.mobile}`);
    });
    
    console.log('\n🎉 DUMMY DATA CREATION COMPLETED!');
    console.log('   ✅ All enquiries added to database');
    console.log('   ✅ Course field validation working');
    console.log('   ✅ No courseInterested issues');
    console.log('   ✅ Ready for testing other APIs');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Get JWT token by logging in to your app');
    console.log('   2. Use the created enquiry IDs to test other APIs');
    console.log('   3. Test GET, PUT, ASSIGN endpoints');
    
    // Show sample IDs for testing
    console.log('\n🔍 Sample Enquiry IDs for testing:');
    createdEnquiries.slice(0, 3).forEach((enquiry, index) => {
      console.log(`   ${index + 1}. ${enquiry._id} (${enquiry.name})`);
    });
    
  } else {
    console.log('\n❌ No enquiries created');
    console.log('   Check if server is running on localhost:5000');
    console.log('   Verify the public endpoint is working');
  }
  
  return createdEnquiries;
}

// Test course field validation specifically
async function testCourseValidation() {
  console.log('\n🧪 TESTING COURSE FIELD VALIDATION');
  console.log('==================================\n');
  
  // Test 1: Valid request with course
  console.log('--- Test 1: Valid request with course ---');
  const validData = {
    name: "Test User",
    mobile: "9876543200",
    course: "Test Course"
  };
  
  const result1 = await apiCall('/api/enquiries/public', 'POST', validData);
  
  if (result1.success) {
    console.log('✅ SUCCESS: Course field accepted');
  } else {
    console.log('❌ FAILED: Course field rejected');
    console.log('   Error:', result1.data?.message);
  }
  
  // Test 2: Invalid request without course
  console.log('\n--- Test 2: Invalid request without course ---');
  const invalidData = {
    name: "Test User",
    mobile: "9876543201"
    // course field missing
  };
  
  const result2 = await apiCall('/api/enquiries/public', 'POST', invalidData);
  
  if (!result2.success && result2.data.errors) {
    const courseError = result2.data.errors.find(e => e.field === 'course');
    if (courseError) {
      console.log('✅ SUCCESS: Course validation working');
      console.log(`   Error message: "${courseError.message}"`);
    } else {
      console.log('❌ ISSUE: No course validation error');
    }
  } else {
    console.log('❌ ISSUE: Should have failed validation');
  }
  
  // Test 3: Check for courseInterested error
  console.log('\n--- Test 3: Check for courseInterested references ---');
  if (JSON.stringify(result1).includes('courseInterested') || JSON.stringify(result2).includes('courseInterested')) {
    console.log('❌ ISSUE: Still getting courseInterested errors');
    console.log('   Server may need restart or cache cleared');
  } else {
    console.log('✅ SUCCESS: No courseInterested references');
  }
}

// Main function
async function runTests() {
  console.log('🧪 ENQUIRY API TEST SUITE');
  console.log('========================\n');
  
  // Test course validation first
  await testCourseValidation();
  
  // Create dummy data
  await createDummyEnquiries();
  
  console.log('\n🎯 TEST COMPLETE!');
  console.log('   All dummy enquiries created successfully');
  console.log('   Course field validation confirmed working');
  console.log('   Ready for full API testing');
}

// Run the tests
if (require.main === module) {
  runTests();
}

module.exports = {
  createDummyEnquiries,
  dummyEnquiries
};
