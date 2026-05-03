// Simple test to check course field validation issue
// Run: node test-course-field.js

const BASE_URL = 'http://localhost:5000';

async function testCourseField() {
  console.log('🧪 Testing Course Field Validation...\n');
  
  const JWT_TOKEN = 'YOUR_JWT_TOKEN'; // <-- REPLACE THIS
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN') {
    console.log('❌ Please set JWT_TOKEN variable first');
    console.log('   Get token by logging in first');
    return;
  }
  
  // Test 1: Valid request with 'course' field
  console.log('=== TEST 1: Valid request with "course" field ===');
  const validPayload = {
    name: "Test User",
    mobile: "9876543210",
    course: "Full Stack Development"
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validPayload)
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCCESS: Course field works correctly');
    } else {
      console.log('❌ FAILED: Course field validation failed');
      
      // Check if error mentions courseInterested
      if (JSON.stringify(result).includes('courseInterested')) {
        console.log('🔍 ISSUE DETECTED: Error mentions "courseInterested" instead of "course"');
        console.log('   This suggests there might be:');
        console.log('   1. Cached validation rules');
        console.log('   2. Server needs restart');
        console.log('   3. Multiple validation files');
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
  
  // Test 2: Invalid request with missing course
  console.log('\n=== TEST 2: Invalid request - missing course ===');
  const invalidPayload = {
    name: "Test User",
    mobile: "9876543210"
    // course field missing
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
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
  
  // Test 3: Check validation files
  console.log('\n=== TEST 3: Checking validation files ===');
  const fs = require('fs');
  const path = require('path');
  
  try {
    const validationPath = path.join(__dirname, 'validations', 'enquiry.validation.js');
    const validationContent = fs.readFileSync(validationPath, 'utf8');
    
    if (validationContent.includes('courseInterested')) {
      console.log('❌ ISSUE: validation file still contains "courseInterested"');
      console.log('   File:', validationPath);
    } else if (validationContent.includes("body('course')")) {
      console.log('✅ SUCCESS: validation file uses "course" field');
    } else {
      console.log('⚠️  WARNING: Could not find course validation in file');
    }
  } catch (error) {
    console.log('⚠️  Could not read validation file:', error.message);
  }
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('1. Restart the server to clear any cached validation rules');
  console.log('2. Check if there are multiple validation files');
  console.log('3. Verify the server is using the updated validation file');
  console.log('4. Check browser cache if testing from frontend');
}

// Run the test
testCourseField();
