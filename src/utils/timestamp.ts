/**
 * Converts various timestamp formats to an ISO string.
 * @param timestamp - The timestamp to be converted.
 * @returns The ISO string representation of the date or `null` if invalid.
 */
export const convertTimestamp = (timestamp: any): string | null => {
    if (!timestamp) return null;
    if (timestamp._seconds) return new Date(timestamp._seconds * 1000).toISOString(); // Firestore proto
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toISOString();  // Firestore `seconds`
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString(); // Firestore `Timestamp`
    if (timestamp instanceof Date) return timestamp.toISOString(); // Native Date object
    return null;
  };
  