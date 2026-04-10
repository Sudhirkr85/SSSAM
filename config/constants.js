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

const PAYMENT_TYPES = {
  ONE_TIME: 'ONE_TIME',
  INSTALLMENT: 'INSTALLMENT'
};

const TIMELINE_TYPES = {
  CREATED: 'created',
  STATUS_CHANGE: 'status_change',
  NOTE: 'note',
  FOLLOWUP: 'followup',
  CONVERTED: 'converted',
  PAYMENT: 'payment',
  LOCKED: 'locked',
  FEES_UPDATED: 'fees_updated',
  PAYMENT_PLAN_SET: 'payment_plan_set',
  INSTALLMENT_CREATED: 'installment_created',
  INSTALLMENT_PAID: 'installment_paid',
  FULL_PAYMENT_COMPLETED: 'full_payment_completed'
};

module.exports = {
  ROLES,
  ENQUIRY_STATUSES,
  STATUS_LIST,
  PAGINATION,
  JWT_CONFIG,
  BCRYPT_CONFIG,
  PAYMENT_TYPES,
  TIMELINE_TYPES
};
