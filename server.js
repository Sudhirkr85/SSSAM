require('dotenv').config();

const connectDB = require('./config/database');
const app = require('./app');
const http = require('http');
const { initializeFirebase } = require('./config/firebase');
const SchedulerService = require('./services/schedulerService');
const schedulerService = new SchedulerService();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Firebase Admin SDK
initializeFirebase();

const startServer = async () => {
  try {
    await connectDB();
    
    // Start scheduler for notifications
    schedulerService.start();
    
    server.listen(PORT, () => {
      console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`, { port: PORT, env: NODE_ENV });
      console.log(`API available at http://localhost:${PORT}/api`, { url: `http://localhost:${PORT}/api` });
      console.log(`Firebase notifications initialized`);
      console.log(`Scheduler service started - Daily notifications at 6:00 AM (funny wake-up), 10:00 AM (office start), hourly random pending work (10 AM-6 PM), 10:00 PM (funny sleep)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.name, err.message);
  console.error('Shutting down gracefully...');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.name, err.message);
  console.error('Shutting down gracefully...');
  process.exit(1);
});

startServer();
