/**
 * Case-insensitive username lookup utility
 * Handles the complexity of finding users regardless of case
 */

/**
 * Performs a case-insensitive username lookup in Firestore
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User data or null if not found
 */
async function findUserByUsername(db, username) {
  try {
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required and must be a string');
    }

    const usersRef = db.collection('users');
    const normalizedUsername = username.toLowerCase().trim();
    
    console.log(`[UsernameLookup] Searching for: "${username}" (normalized: "${normalizedUsername}")`);
    
    // First try exact match with normalized username (most efficient)
    let snapshot = await usersRef.where('username', '==', normalizedUsername).get();
    
    if (!snapshot.empty) {
      console.log(`[UsernameLookup] Found exact match for normalized username`);
      return {
        id: snapshot.docs[0].id,
        data: snapshot.docs[0].data()
      };
    }
    
    // If no exact match found, try case-insensitive search
    console.log('[UsernameLookup] No exact match found, trying case-insensitive search...');
    
    // For better performance, we could add a lowercase username field to users
    // For now, we'll do a full scan (not ideal for large datasets)
    const allUsersSnapshot = await usersRef.get();
    
    const matchingDoc = allUsersSnapshot.docs.find(doc => {
      const userData = doc.data();
      return userData.username && userData.username.toLowerCase().trim() === normalizedUsername;
    });
    
    if (matchingDoc) {
      console.log(`[UsernameLookup] Found case-insensitive match: "${matchingDoc.data().username}"`);
      return {
        id: matchingDoc.id,
        data: matchingDoc.data()
      };
    }
    
    console.log(`[UsernameLookup] No user found for username: ${username}`);
    return null;
    
  } catch (error) {
    console.error('[UsernameLookup] Error:', error);
    throw error;
  }
}

/**
 * Normalizes a username for consistent storage and comparison
 * @param {string} username - Raw username input
 * @returns {string} Normalized username
 */
function normalizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return '';
  }
  return username.toLowerCase().trim();
}

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid format
 */
function isValidUsernameFormat(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  const normalized = normalizeUsername(username);
  
  // Username should be 3-30 characters, alphanumeric plus dots and underscores
  const usernameRegex = /^[a-z0-9._]{3,30}$/;
  return usernameRegex.test(normalized);
}

module.exports = {
  findUserByUsername,
  normalizeUsername,
  isValidUsernameFormat
}; 