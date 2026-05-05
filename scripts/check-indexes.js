const mongoose = require('mongoose');
require('dotenv').config();

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/institute_crm');
    
    const db = mongoose.connection.db;
    const admissionsCollection = db.collection('admissions');
    
    // List all indexes
    const indexes = await admissionsCollection.listIndexes();
    console.log('Current indexes on admissions collection:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)} (unique: ${index.unique || false})`);
    });
    
    // Check if there are any documents with enquiryId
    const count = await admissionsCollection.countDocuments({ enquiryId: { $exists: true } });
    console.log(`\nDocuments with enquiryId field: ${count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkIndexes();
