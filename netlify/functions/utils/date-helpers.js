/**
 * Converts a JavaScript Date object to Unix timestamp (seconds since epoch)
 * @param {Date} date - JavaScript Date object
 * @returns {number} Unix timestamp in seconds
 */
const toUnixTimestamp = (date) => {
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
};

/**
 * Converts a Unix timestamp to ISO string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} ISO string
 */
const fromUnixTimestamp = (timestamp) => {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
};

module.exports = {
  toUnixTimestamp,
  fromUnixTimestamp
}; 