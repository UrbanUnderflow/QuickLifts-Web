export const convertFirestoreTimestamp = (
  timestamp: number | string | Date | null | undefined
): Date => {
  // If null or undefined, return the current date.
  if (timestamp == null) return new Date();

  // If it's already a Date, return it.
  if (timestamp instanceof Date) return timestamp;

  // Convert to number if it's a string (using parseFloat preserves decimals).
  const numTimestamp =
    typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

  // If the timestamp looks like seconds (less than 10 billion), convert to milliseconds.
  if (numTimestamp < 10000000000) {
    return new Date(numTimestamp * 1000);
  }

  // Otherwise, assume it's in milliseconds.
  return new Date(numTimestamp);
};

  export const dateToUnixTimestamp = (date: Date): number => {
    return Math.floor(date.getTime() / 1000);
  };