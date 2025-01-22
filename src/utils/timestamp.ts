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
  
  export const serverTimestamp = (): number => {
    return Date.now() / 1000; // Convert milliseconds to seconds
  };
  
  /**
   * Converts a timestamp to its numeric representation in seconds since epoch
   * @param timestamp - The timestamp to convert
   * @returns Numeric representation in seconds
   */
  export const timestampToNumeric = (timestamp?: Date | any): number => {
    if (!timestamp) return serverTimestamp();
    
    if (timestamp._seconds) return timestamp._seconds; // Firestore proto
    if (timestamp.seconds) return timestamp.seconds;   // Firestore `seconds`
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return Math.floor(timestamp.toDate().getTime() / 1000);  // Firestore `Timestamp`
    }
    if (timestamp instanceof Date) return Math.floor(timestamp.getTime() / 1000); // Native Date object
    
    return serverTimestamp();
  };