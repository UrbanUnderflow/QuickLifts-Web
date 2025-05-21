export const convertFirestoreTimestamp = (
  timestamp: any
): Date => {
  // Check if it's a Firestore Timestamp object first
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // If null or undefined, return the current date.
  if (timestamp == null) return new Date();

  // If it's already a Date, return it.
  if (timestamp instanceof Date) return timestamp;

  // Convert to number if it's a string (using parseFloat preserves decimals).
  const numTimestamp =
    typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

  // Check if conversion resulted in a valid number
  if (typeof numTimestamp !== 'number' || isNaN(numTimestamp)) {
    console.warn('convertFirestoreTimestamp received an invalid non-numeric, non-date value:', timestamp);
    return new Date();
  }

  // If the timestamp looks like seconds (less than 10 billion), convert to milliseconds.
  if (numTimestamp < 10000000000) {
    return new Date(numTimestamp * 1000);
  }

  // Otherwise, assume it's in milliseconds.
  return new Date(numTimestamp);
};

export const dateToUnixTimestamp = (date: Date): number => {
  // Add a check for invalid date
  if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn('dateToUnixTimestamp received an invalid Date object');
      return Math.floor(Date.now() / 1000);
  }
  return Math.floor(date.getTime() / 1000);
};

/**
 * Format a date for display in the UI
 * @param date The date to format
 * @returns A string representation of the date (e.g., "Jan 1, 2023")
 */
export const formatDate = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('formatDate received an invalid Date object');
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};