const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Transaction support options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB Connected', { host: conn.connection.host });
    
    // Check if replica set is enabled for transactions
    if (conn.connection.client.topology?.description?.type === 'ReplicaSetWithPrimary') {
      logger.info('Replica set enabled - Transactions supported');
    } else {
      logger.warn('Running without replica set - Transactions disabled');
      logger.warn('For production, configure MongoDB with replica set for transaction support');
    }
  } catch (error) {
    logger.error('Database connection error', { error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
