const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const { Enquiry } = require('./models');
const enquiryService = require('./services/enquiry.service');

// Test data
const testUser = {
  id: new mongoose.Types.ObjectId(),
  role: 'COUNSELOR',
  name: 'Test User',
  email: 'test@example.com'
};

const testEnquiryData = {
  name: 'John Doe',
  mobile: '9876543210',
  email: 'john@example.com',
  course: 'Computer Science'
};

async function testDuplicateMobileDetection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/institute_crm');
    console.log('✅ Connected to MongoDB');

    // Clean up any existing test data
    await Enquiry.deleteMany({ mobile: testEnquiryData.mobile });
    console.log('🧹 Cleaned up existing test data');

    // Test 1: Create first enquiry (should succeed)
    console.log('\n📝 Test 1: Creating first enquiry...');
    try {
      const firstEnquiry = await enquiryService.createEnquiry(testEnquiryData, testUser);
      console.log('✅ First enquiry created successfully:', firstEnquiry._id);
    } catch (error) {
      console.log('❌ Failed to create first enquiry:', error.message);
      return;
    }

    // Test 2: Create duplicate enquiry (should fail and return existing data)
    console.log('\n📝 Test 2: Creating duplicate enquiry...');
    try {
      await enquiryService.createEnquiry(testEnquiryData, testUser);
      console.log('❌ Duplicate enquiry was created (this should not happen)');
    } catch (error) {
      if (error.statusCode === 409 && error.duplicate && error.existingEnquiry) {
        console.log('✅ Duplicate detection working!');
        console.log('📋 Existing enquiry data:');
        console.log('   ID:', error.existingEnquiry._id);
        console.log('   Name:', error.existingEnquiry.name);
        console.log('   Mobile:', error.existingEnquiry.mobile);
        console.log('   Course:', error.existingEnquiry.course);
        console.log('   Status:', error.existingEnquiry.status);
        console.log('   Created:', error.existingEnquiry.createdAt);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Test with different mobile (should succeed)
    console.log('\n📝 Test 3: Creating enquiry with different mobile...');
    try {
      const differentMobileData = {
        ...testEnquiryData,
        mobile: '9876543211'
      };
      const newEnquiry = await enquiryService.createEnquiry(differentMobileData, testUser);
      console.log('✅ Enquiry with different mobile created:', newEnquiry._id);
    } catch (error) {
      console.log('❌ Failed to create enquiry with different mobile:', error.message);
    }

    // Test 4: Test public enquiry duplicate detection
    console.log('\n📝 Test 4: Testing public enquiry duplicate detection...');
    try {
      await enquiryService.createPublicEnquiry(testEnquiryData);
      console.log('❌ Duplicate public enquiry was created (this should not happen)');
    } catch (error) {
      if (error.statusCode === 409 && error.duplicate && error.existingEnquiry) {
        console.log('✅ Public duplicate detection working!');
        console.log('📋 Existing enquiry returned for public endpoint');
      } else {
        console.log('❌ Unexpected error in public duplicate test:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test setup error:', error.message);
  } finally {
    // Clean up test data
    try {
      await Enquiry.deleteMany({ mobile: testEnquiryData.mobile });
      await Enquiry.deleteMany({ mobile: '9876543211' });
      console.log('\n🧹 Test data cleaned up');
    } catch (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError.message);
    }

    // Close connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testDuplicateMobileDetection();
