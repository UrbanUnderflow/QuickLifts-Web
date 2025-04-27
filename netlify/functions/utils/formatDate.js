/**
 * Converts a JavaScript Date object to a Unix timestamp (seconds since epoch).
 * @param {Date} date The Date object to convert.
 * @returns {number | null} The Unix timestamp in seconds, or null if input is invalid.
 */
const dateToUnixTimestamp = (date) => {
  if (date instanceof Date && !isNaN(date)) {
    return Math.floor(date.getTime() / 1000);
  }
  // Return null or throw an error for invalid dates, depending on desired handling
  console.warn("[formatDate] Invalid date passed to dateToUnixTimestamp:", date);
  return null;
};

module.exports = {
  dateToUnixTimestamp,
}; 