/**
 * SSSAM Academy - Smart CRM Notification Messages
 * Playful, short, and friendly Hinglish messages addressing users as 'Name ji'
 */

/**
 * Helper to format name with "ji" (uses first name if available)
 */
function formatName(name) {
  if (!name) return 'ji';
  const firstName = name.trim().split(' ')[0];
  return `${firstName} ji`;
}

/**
 * Get Punch In reminder message
 */
function getPunchInMessage(name) {
  const addressedName = formatName(name);
  return `Suniye na ${addressedName}, aapne abhi tak punch in nahi kiya hai. Ek baar mark kar dijiye na. 💼`;
}

/**
 * Get Punch Out reminder message
 */
function getPunchOutMessage(name) {
  const addressedName = formatName(name);
  return `Suniye na ${addressedName}, punch out nahi kiya hai aapne. Kar lijiye na jaane se pehle. 🚪`;
}

/**
 * Get Work Update message (used at 11 AM, 3 PM, 5 PM)
 */
function getWorkUpdateMessage(name, todayCount, overdueCount) {
  const addressedName = formatName(name);
  return `Suniye na ${addressedName}, aaj aapke ${todayCount} follow-ups aur ${overdueCount} pending follow-ups hain. 📋`;
}

/**
 * Get Fees Due Today message
 */
function getFeesDueTodayMessage(name, student, amount) {
  const addressedName = formatName(name);
  return `Suniye na ${addressedName}, aaj ${student} ki ₹${amount} fees aani hai. 💰`;
}

/**
 * Get Fees Overdue message
 */
function getFeesOverdueMessage(name, student, amount, dueDateStr) {
  const addressedName = formatName(name);
  return `Suniye na ${addressedName}, ${student} ki ₹${amount} fees nahi aayi hai jo ${dueDateStr} ko aani thi. ⚠️`;
}

module.exports = {
  getPunchInMessage,
  getPunchOutMessage,
  getWorkUpdateMessage,
  getFeesDueTodayMessage,
  getFeesOverdueMessage
};
