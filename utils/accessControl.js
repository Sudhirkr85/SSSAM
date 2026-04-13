const { ROLES } = require('../config/constants');

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
 * - Counselor: can modify only assigned (and not converted)
 */
function canModifyEnquiry(user, enquiry) {
  if (user.role === ROLES.ADMIN) return true;

  const assignedToId = enquiry.assignedTo?.toString();
  const userId = user.id?.toString();

  // Must be assigned to this counselor
  return assignedToId === userId;
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
