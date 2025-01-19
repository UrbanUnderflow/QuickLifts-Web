export const convertFirestoreTimestamp = (timestamp: number | string | Date | null | undefined): Date => {
    // If null or undefined, return current date
    if (timestamp == null) return new Date();
  
    // If already a Date object, return it
    if (timestamp instanceof Date) return timestamp;
  
    // Convert to number if it's a string
    const numTimestamp = typeof timestamp === 'string' 
      ? parseInt(timestamp, 10) 
      : timestamp;
  
    // If the timestamp looks like seconds (less than current millisecond timestamp)
    if (numTimestamp < 10000000000) {
      return new Date(numTimestamp * 1000);
    }
  
    // If it looks like milliseconds
    return new Date(numTimestamp);
  };