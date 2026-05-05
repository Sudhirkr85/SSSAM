const mongoose = require('mongoose');
require('dotenv').config();

async function checkEnquiryIdData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/institute_crm');
    
    const db = mongoose.connection.db;
    const admissionsCollection = db.collection('admissions');
    
    // Find all documents with enquiryId field
    const docs = await admissionsCollection.find({ enquiryId: { $exists: true } }).toArray();
    
    if (docs.length === 0) {
      console.log('✅ No documents with enquiryId field found');
    } else {
      console.log(`❌ Found ${docs.length} documents with enquiryId field:`);
      docs.forEach(doc => {
        console.log(`- ID: ${doc._id}, enquiryId: ${doc.enquiryId}, name: ${doc.name}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkEnquiryIdData();
