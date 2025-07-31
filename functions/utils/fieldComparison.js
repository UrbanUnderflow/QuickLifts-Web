/**
 * Utility functions for comparing field changes between documents
 */

/**
 * Deep comparison of two values (handles objects, arrays, primitives)
 * @param {*} value1 - First value to compare
 * @param {*} value2 - Second value to compare
 * @returns {boolean} - Whether the values are equal
 */
function deepEqual(value1, value2) {
  if (value1 === value2) {
    return true;
  }

  if (value1 == null || value2 == null) {
    return value1 === value2;
  }

  if (typeof value1 !== typeof value2) {
    return false;
  }

  // Handle Date objects
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }

  // Handle arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) {
      return false;
    }
    for (let i = 0; i < value1.length; i++) {
      if (!deepEqual(value1[i], value2[i])) {
        return false;
      }
    }
    return true;
  }

  // Handle objects
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    const keys1 = Object.keys(value1);
    const keys2 = Object.keys(value2);
    
    if (keys1.length !== keys2.length) {
      return false;
    }
    
    for (const key of keys1) {
      if (!keys2.includes(key) || !deepEqual(value1[key], value2[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Compare specific fields between two objects and return changed fields
 * @param {Object} beforeObj - Object before changes
 * @param {Object} afterObj - Object after changes
 * @param {string[]} fieldsToCheck - Array of field names to compare
 * @param {string} logPrefix - Prefix for console logs
 * @returns {Object} - Object containing changed fields and their before/after values
 */
function getChangedFields(beforeObj, afterObj, fieldsToCheck, logPrefix = 'FieldComparison') {
  const changes = {};
  
  if (!beforeObj || !afterObj) {
    console.log(`[${logPrefix}] Missing before or after object for comparison`);
    return changes;
  }

  for (const field of fieldsToCheck) {
    const beforeValue = beforeObj[field];
    const afterValue = afterObj[field];
    
    if (!deepEqual(beforeValue, afterValue)) {
      changes[field] = {
        before: beforeValue,
        after: afterValue
      };
      
      console.log(`[${logPrefix}] Field '${field}' changed:`, {
        before: beforeValue,
        after: afterValue
      });
    }
  }

  return changes;
}

/**
 * Check if any of the specified fields have changed between two objects
 * @param {Object} beforeObj - Object before changes
 * @param {Object} afterObj - Object after changes
 * @param {string[]} fieldsToCheck - Array of field names to compare
 * @param {string} logPrefix - Prefix for console logs
 * @returns {boolean} - Whether any relevant fields changed
 */
function hasAnyFieldChanged(beforeObj, afterObj, fieldsToCheck, logPrefix = 'FieldComparison') {
  const changes = getChangedFields(beforeObj, afterObj, fieldsToCheck, logPrefix);
  const hasChanges = Object.keys(changes).length > 0;
  
  if (hasChanges) {
    console.log(`[${logPrefix}] ${Object.keys(changes).length} field(s) changed:`, Object.keys(changes));
  } else {
    console.log(`[${logPrefix}] No relevant fields changed`);
  }
  
  return hasChanges;
}

/**
 * Extract only the changed field values for update operations
 * @param {Object} sourceObj - Object containing the new values
 * @param {Object} changes - Changes object from getChangedFields()
 * @returns {Object} - Object containing only the fields that changed
 */
function extractChangedValues(sourceObj, changes) {
  const updateData = {};
  
  for (const field of Object.keys(changes)) {
    if (sourceObj[field] !== undefined) {
      updateData[field] = sourceObj[field];
    }
  }
  
  return updateData;
}

/**
 * Challenge-specific field definitions for reuse across functions
 */
const CHALLENGE_SYNC_FIELDS = [
  'challengeType',
  'dailyStepGoal', 
  'totalStepGoal',
  'allowedMissedDays',
  'title',
  'subtitle', 
  'status',
  'startDate',
  'endDate',
  'updatedAt',
  'durationInDays',
  'isChallengeEnded'
];

const CHALLENGE_DISPLAY_FIELDS = [
  'title',
  'subtitle',
  'status',
  'startDate',
  'endDate'
];

const CHALLENGE_CORE_FIELDS = [
  'challengeType',
  'dailyStepGoal',
  'totalStepGoal',
  'allowedMissedDays'
];

module.exports = {
  deepEqual,
  getChangedFields,
  hasAnyFieldChanged,
  extractChangedValues,
  CHALLENGE_SYNC_FIELDS,
  CHALLENGE_DISPLAY_FIELDS,
  CHALLENGE_CORE_FIELDS
}; 