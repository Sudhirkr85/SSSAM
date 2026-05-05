const mongoose = require('mongoose');
require('dotenv').config();

async function dropEnquiryIdIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/institute_crm');
    
    const db = mongoose.connection.db;
    const admissionsCollection = db.collection('admissions');
    
    // Drop the enquiryId index
    await admissionsCollection.dropIndex('enquiryId_1');
    console.log('✅ Successfully dropped enquiryId_1 index');
    
    // List remaining indexes to verify
    const indexes = await admissionsCollection.listIndexes();
    console.log('Current indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('✅ enquiryId_1 index does not exist (already dropped)');
    } else {
      console.error('❌ Error dropping index:', error);
    }
  } finally {
    await mongoose.disconnect();
  }
}

dropEnquiryIdIndex();
