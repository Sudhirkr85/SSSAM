const { ROLES, ENQUIRY_STATUSES } = require('../config/constants');

/**
 * Check if user can VIEW an enquiry
 * - Admin: can view all
 * - Counselor: can view assigned + unassigned only
 */
function canAccessEnquiry(user, enquiry) {
  if (user.role === ROLES.ADMIN) return true;

  const assignedToId = enquiry.assignedTo?.toString();
  const userId = user.id?.toString();

  return assignedToId === null || assignedToId === undefined || assignedToId === userId;
}

/**
 * Check if user can MODIFY an enquiry
 * - Admin: can modify all (even converted)
 * - Counselor: can modify any enquiry (tracking in timeline)
 * - Only CONVERTED enquiries are restricted to admin
 */
function canModifyEnquiry(user, enquiry) {
  // Admin can modify everything including converted
  if (user.role === ROLES.ADMIN) return true;

  // Counselor can modify any enquiry except converted
  if (enquiry.status === ENQUIRY_STATUSES.CONVERTED) return false;

  // Counselor can modify any non-converted enquiry
  return true;
}

/**
 * Check if enquiry is locked (CONVERTED status)
 * Only admin can modify converted enquiries
 */
function isEnquiryLocked(enquiry) {
  return enquiry.status === 'CONVERTED';
}

module.exports = {
  canAccessEnquiry,
  canModifyEnquiry,
  isEnquiryLocked
};
