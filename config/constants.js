const ROLES = {
  ADMIN: 'admin',
  COUNSELOR: 'counselor',
  EMPLOYEE: 'employee'
};

const ENQUIRY_STATUSES = {
  CONTACTED: 'CONTACTED',
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  ADMITTED: 'ADMITTED'
};

const ENQUIRY_SOURCES = {
  WEBSITE: 'website',
  WALK_IN: 'walk_in',
  REFERRAL: 'referral',
  PHONE_CALL: 'phone_call',
  SOCIAL_MEDIA: 'social_media',
  ADVERTISEMENT: 'advertisement',
  OTHER: 'other'
};

const STATUS_LIST = [...Object.values(ENQUIRY_STATUSES), null];

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

const PAYMENT_RECORD_TYPES = {
  REGISTRATION: 'REGISTRATION',
  INSTALLMENT: 'INSTALLMENT',
  INITIAL: 'initial',
  FULL: 'full',
  REFUND: 'refund'
};

const PAYMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  VOIDED: 'VOIDED',
  SUCCESS: 'success',
  PENDING: 'pending',
  FAILED: 'failed'
};

const ADMISSION_STATUSES = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  DROPPED: 'dropped',
  WRITE_OFF: 'write_off'
};

const PAYMENT_MODES = {
  CASH: 'CASH',
  CARD: 'CARD',
  ONLINE: 'ONLINE',
  UPI: 'UPI',
  CHEQUE: 'CHEQUE',
  BANK_TRANSFER: 'BANK_TRANSFER'
};

const INSTALLMENT_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE'
};

const TIMELINE_TYPES = {
  CREATED: 'created',
  STATUS_CHANGE: 'status_change',
  NOTE: 'note',
  FOLLOWUP: 'followup',
  CONVERTED: 'converted',
  PAYMENT: 'payment',
  PAYMENT_UPDATED: 'payment_updated',
  PAYMENT_RECEIVED: 'payment_received',
  LOCKED: 'locked',
  FEES_UPDATED: 'fees_updated',
  PAYMENT_PLAN_SET: 'payment_plan_set',
  INSTALLMENT_CREATED: 'installment_created',
  INSTALLMENT_PAID: 'installment_paid',
  FULL_PAYMENT_COMPLETED: 'full_payment_completed',
  DROPPED: 'dropped'
};

module.exports = {
  ROLES,
  ENQUIRY_STATUSES,
  ENQUIRY_SOURCES,
  STATUS_LIST,
  PAGINATION,
  JWT_CONFIG,
  BCRYPT_CONFIG,
  PAYMENT_TYPES,
  PAYMENT_RECORD_TYPES,
  PAYMENT_STATUSES,
  ADMISSION_STATUSES,
  PAYMENT_MODES,
  INSTALLMENT_STATUSES,
  TIMELINE_TYPES
};
