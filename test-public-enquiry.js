// Test without authentication - using public endpoint
// This will test if the course field validation is working correctly

const BASE_URL = 'http://localhost:5000';

async function testPublicEnquiry() {
  console.log('🧪 Testing Public Enquiry API (No Auth Required)\n');
  
  // Test 1: Valid request with course field
  console.log('=== TEST 1: Valid request with "course" field ===');
  const validPayload = {
    name: "Test User",
    mobile: "9876543210",
    course: "Full Stack Development"
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/enquiries/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validPayload)
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCCESS: Course field works correctly in public endpoint');
    } else {
      console.log('❌ FAILED: Course field validation failed');
      
      // Check if error mentions courseInterested
      if (JSON.stringify(result).includes('courseInterested')) {
        console.log('🔍 ISSUE DETECTED: Error mentions "courseInterested"');
        console.log('   This means server needs restart or there are cached validation rules');
        console.log('\n🔧 IMMEDIATE FIX:');
        console.log('   1. Stop server (Ctrl+C)');
        console.log('   2. Run: node server.js');
        console.log('   3. Try this test again');
      }
    }
  } catch (error) {
    console.error('Network error:', error);
    console.log('⚠️  Make sure server is running on http://localhost:5000');
  }
  
  // Test 2: Invalid request with missing course
  console.log('\n=== TEST 2: Invalid request - missing course ===');
  const invalidPayload = {
    name: "Test User",
    mobile: "9876543210"
    // course field missing
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/enquiries/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidPayload)
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (!response.ok && result.errors) {
      const courseError = result.errors.find(e => e.field === 'course');
      if (courseError) {
        console.log('✅ SUCCESS: Correctly validates missing "course" field');
        console.log(`   Error message: "${courseError.message}"`);
      } else {
        console.log('❌ ISSUE: No validation error for missing course field');
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Run the test
testPublicEnquiry();
