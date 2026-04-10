const ROLES = {
  ADMIN: 'admin',
  COUNSELOR: 'counselor'
};

const ENQUIRY_STATUSES = {
  NEW: 'New',
  ATTEMPTED: 'Attempted',
  CONNECTED: 'Connected',
  INTERESTED: 'Interested',
  FOLLOW_UP: 'Follow-up',
  CONVERTED: 'Converted',
  LOST: 'Lost'
};

const STATUS_LIST = Object.values(ENQUIRY_STATUSES);

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

const JWT_CONFIG = {
  EXPIRE: process.env.JWT_EXPIRE || '7d',
  SECRET: process.env.JWT_SECRET
};

const BCRYPT_CONFIG = {
  SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
};

module.exports = {
  ROLES,
  ENQUIRY_STATUSES,
  STATUS_LIST,
  PAGINATION,
  JWT_CONFIG,
  BCRYPT_CONFIG
};
