export const generateId = (prefix?: string): string => {
    // Generate random string
    const randomStr = Math.random().toString(36).substring(2, 15);
    
    // Get current timestamp
    const timestamp = Date.now().toString(36);
    
    // Combine with optional prefix
    const id = prefix ? `${prefix}-${timestamp}-${randomStr}` : `${timestamp}-${randomStr}`;
    
    return id;
  };