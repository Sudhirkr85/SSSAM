require('dotenv').config();

const connectDB = require('./config/database');
const app = require('./app');
const logger = require('./utils/logger');
const http = require('http');
const { initializeSocket } = require('./config/socket');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`, { port: PORT, env: NODE_ENV });
      logger.info(`API available at http://localhost:${PORT}/api`, { url: `http://localhost:${PORT}/api` });
      logger.info(`Socket.IO server initialized`, { socketPort: PORT });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
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
