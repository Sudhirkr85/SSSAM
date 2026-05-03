#!/usr/bin/env node

// FIX AND TEST SCRIPT
// This script will help identify and fix the courseInterested validation issue

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 ENQUIRY API FIX SCRIPT');
console.log('=====================================\n');

// Step 1: Check all validation files for courseInterested
console.log('📋 STEP 1: Checking validation files...');
const validationDir = path.join(__dirname, 'validations');

function checkValidationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasCourseInterested = content.includes('courseInterested');
    const hasCourse = content.includes("body('course')");
    
    console.log(`   ${path.basename(filePath)}:`);
    console.log(`     - Contains 'courseInterested': ${hasCourseInterested ? '❌ YES' : '✅ NO'}`);
    console.log(`     - Contains 'course': ${hasCourse ? '✅ YES' : '❌ NO'}`);
    
    if (hasCourseInterested) {
      console.log(`     ⚠️  ISSUE FOUND: This file still has 'courseInterested'`);
      return false;
    }
    
    return hasCourse;
  } catch (error) {
    console.log(`     ⚠️  Could not read file: ${error.message}`);
    return false;
  }
}

try {
  const files = fs.readdirSync(validationDir);
  let allValidationsCorrect = true;
  
  files.forEach(file => {
    if (file.endsWith('.validation.js')) {
      const filePath = path.join(validationDir, file);
      const isCorrect = checkValidationFile(filePath);
      if (!isCorrect) allValidationsCorrect = false;
    }
  });
  
  if (allValidationsCorrect) {
    console.log('\n✅ All validation files appear to be correct');
  } else {
    console.log('\n❌ Issues found in validation files');
  }
} catch (error) {
  console.log('❌ Could not read validation directory:', error.message);
}

// Step 2: Check controllers
console.log('\n📋 STEP 2: Checking controllers...');
const controllerDir = path.join(__dirname, 'controllers');

try {
  const enquiryControllerPath = path.join(controllerDir, 'enquiry.controller.js');
  const controllerContent = fs.readFileSync(enquiryControllerPath, 'utf8');
  const hasCourseInterested = controllerContent.includes('courseInterested');
  
  console.log(`   enquiry.controller.js:`);
  console.log(`     - Contains 'courseInterested': ${hasCourseInterested ? '❌ YES' : '✅ NO'}`);
  
  if (hasCourseInterested) {
    console.log('     ⚠️  ISSUE: Controller still has courseInterested references');
  }
} catch (error) {
  console.log('   ⚠️  Could not read enquiry controller:', error.message);
}

// Step 3: Check services
console.log('\n📋 STEP 3: Checking services...');
const serviceDir = path.join(__dirname, 'services');

try {
  const enquiryServicePath = path.join(serviceDir, 'enquiry.service.js');
  const serviceContent = fs.readFileSync(enquiryServicePath, 'utf8');
  const hasCourseInterested = serviceContent.includes('courseInterested');
  
  console.log(`   enquiry.service.js:`);
  console.log(`     - Contains 'courseInterested': ${hasCourseInterested ? '❌ YES' : '✅ NO'}`);
  
  if (hasCourseInterested) {
    console.log('     ⚠️  ISSUE: Service still has courseInterested references');
  }
} catch (error) {
  console.log('   ⚠️  Could not read enquiry service:', error.message);
}

// Step 4: Check models
console.log('\n📋 STEP 4: Checking models...');
const modelDir = path.join(__dirname, 'models');

try {
  const enquiryModelPath = path.join(modelDir, 'Enquiry.js');
  const modelContent = fs.readFileSync(enquiryModelPath, 'utf8');
  const hasCourseInterested = modelContent.includes('courseInterested');
  const hasCourse = modelContent.includes('course:');
  
  console.log(`   Enquiry.js:`);
  console.log(`     - Contains 'courseInterested': ${hasCourseInterested ? '❌ YES' : '✅ NO'}`);
  console.log(`     - Contains 'course:': ${hasCourse ? '✅ YES' : '❌ NO'}`);
  
  if (hasCourseInterested) {
    console.log('     ⚠️  ISSUE: Model still has courseInterested field');
  }
} catch (error) {
  console.log('   ⚠️  Could not read Enquiry model:', error.message);
}

// Step 5: Provide fix recommendations
console.log('\n🔧 STEP 5: Fix Recommendations');
console.log('=====================================');

console.log('\nIf you are still getting "courseInterested" validation errors:');
console.log('\n1. 🔄 RESTART THE SERVER');
console.log('   - Stop the current server (Ctrl+C)');
console.log('   - Run: npm start or node server.js');
console.log('   - This clears any cached validation rules\n');

console.log('2. 🧹 CLEAR NODE MODULES CACHE');
console.log('   - Run: rm -rf node_modules');
console.log('   - Run: npm install');
console.log('   - Run: npm start\n');

console.log('3. 🌐 CLEAR BROWSER CACHE');
console.log('   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)');
console.log('   - Clear browser cache and cookies');
console.log('   - Try incognito mode\n');

console.log('4. 📝 CHECK FOR MULTIPLE VALIDATION FILES');
console.log('   - Search entire project for "courseInterested"');
console.log('   - Ensure all references are changed to "course"');
console.log('   - Check for backup files or duplicate files\n');

console.log('5. 🧪 TEST WITH SIMPLE CURL');
console.log('   curl -X POST http://localhost:5000/api/enquiries \\');
console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"name":"Test","mobile":"9876543210","course":"Test Course"}\'\n');

// Step 6: Create a simple test
console.log('\n🧪 STEP 6: Creating Simple Test');
console.log('=====================================');

const simpleTest = `
// Simple test to verify course field works
const test = async () => {
  const response = await fetch('http://localhost:5000/api/enquiries', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test User',
      mobile: '9876543210',
      course: 'Test Course'
    })
  });
  
  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', result);
  
  if (result.errors && result.errors.find(e => e.field === 'courseInterested')) {
    console.log('❌ ISSUE: Still getting courseInterested error');
  } else {
    console.log('✅ SUCCESS: Course field works correctly');
  }
};

test();
`;

fs.writeFileSync(path.join(__dirname, 'simple-course-test.js'), simpleTest);
console.log('✅ Created: simple-course-test.js');
console.log('   Run: node simple-course-test.js (after setting YOUR_TOKEN)');

console.log('\n🎯 FINAL CHECKLIST:');
console.log('==================');
console.log('□ Server restarted after changes');
console.log('□ All validation files checked');
console.log('□ Browser cache cleared');
console.log('□ Test with curl/simple script');
console.log('□ Check for multiple validation files');
console.log('□ Verify JWT token is valid');

console.log('\n🚀 If all checks pass and issue persists:');
console.log('   1. Check if there are multiple servers running');
console.log('   2. Verify you are hitting the correct server');
console.log('   3. Check for proxy or load balancer issues');
console.log('   4. Look for environment-specific validation files');

console.log('\n✨ Fix script completed!');
console.log('   Follow the steps above to resolve the courseInterested validation issue.\n');
