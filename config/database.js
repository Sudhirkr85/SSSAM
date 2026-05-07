const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Transaction support options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB Connected', { host: conn.connection.host });
    
    // Check if replica set is enabled for transactions
    if (conn.connection.client.topology?.description?.type === 'ReplicaSetWithPrimary') {
      console.log('Replica set enabled - Transactions supported');
    } else {
      console.warn('Running without replica set - Transactions disabled');
      console.warn('For production, configure MongoDB with replica set for transaction support');
    }
  } catch (error) {
    console.error('Database connection error', { error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
