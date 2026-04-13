const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Transaction support options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Check if replica set is enabled for transactions
    if (conn.connection.readyState === 1) {
      const admin = conn.connection.db.admin();
      try {
        const replSetStatus = await admin.command({ replSetGetStatus: 1 });
        console.log('Replica set enabled - Transactions supported');
      } catch (err) {
        console.log('Warning: Running without replica set - Transactions disabled');
        console.log('For production, configure MongoDB with replica set for transaction support');
      }
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
