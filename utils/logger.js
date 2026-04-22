const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry);
  }

  log(level, message, meta = {}) {
    const logString = this.formatLog(level, message, meta);
    
    // Console output with color coding
    const colors = {
      INFO: '\x1b[36m',    // Cyan
      WARN: '\x1b[33m',    // Yellow
      ERROR: '\x1b[31m',   // Red
      DEBUG: '\x1b[90m'    // Gray
    };
    const reset = '\x1b[0m';
    
    console.log(`${colors[level] || ''}[${level}]${reset} ${message}`, Object.keys(meta).length > 0 ? meta : '');

    // Write to file
    try {
      const logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, logString + '\n');
    } catch (err) {
      // Silently fail if file write fails to avoid disrupting app
    }
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  debug(message, meta = {}) {
    // Only log debug in development or if DEBUG env var is set
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      this.log('DEBUG', message, meta);
    }
  }
}

module.exports = new Logger();
