const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Generic batch update utility for processing large collections
 * @param {string} collectionName - Firestore collection name
 * @param {Object} queryParams - Query parameters {field, operator, value}
 * @param {Object} updateData - Data to update each document with
 * @param {number} batchSize - Number of documents per batch (default: 500)
 * @param {string} logPrefix - Prefix for console logs
 * @returns {Promise<number>} - Number of documents updated
 */
async function batchUpdateDocuments(collectionName, queryParams, updateData, batchSize = 500, logPrefix = 'BatchUpdate') {
  let lastDoc = null;
  let totalUpdated = 0;

  console.log(`[${logPrefix}] Starting batch update for collection: ${collectionName}`);
  console.log(`[${logPrefix}] Query: ${queryParams.field} ${queryParams.operator} ${queryParams.value}`);
  console.log(`[${logPrefix}] Update data:`, JSON.stringify(updateData, null, 2));

  do {
    // Build query with pagination
    let query = db.collection(collectionName)
      .where(queryParams.field, queryParams.operator, queryParams.value)
      .limit(batchSize);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`[${logPrefix}] No more documents to process`);
      break;
    }

    // Prepare batch update
    const batch = db.batch();
    let batchUpdateCount = 0;

    snapshot.docs.forEach(doc => {
      // Add server timestamp to update data if not already present
      const finalUpdateData = {
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.update(doc.ref, finalUpdateData);
      batchUpdateCount++;
    });

    // Commit the batch
    if (batchUpdateCount > 0) {
      await batch.commit();
      totalUpdated += batchUpdateCount;
      console.log(`[${logPrefix}] Updated ${batchUpdateCount} documents in this batch`);
    }

    // Update pagination cursor
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

  } while (lastDoc);

  console.log(`[${logPrefix}] Total documents updated: ${totalUpdated}`);
  return totalUpdated;
}

/**
 * Batch query documents with pagination (for read-only operations)
 * @param {string} collectionName - Firestore collection name
 * @param {Object} queryParams - Query parameters {field, operator, value}
 * @param {Function} processDoc - Function to process each document
 * @param {number} batchSize - Number of documents per batch (default: 500)
 * @param {string} logPrefix - Prefix for console logs
 * @returns {Promise<number>} - Number of documents processed
 */
async function batchQueryDocuments(collectionName, queryParams, processDoc, batchSize = 500, logPrefix = 'BatchQuery') {
  let lastDoc = null;
  let totalProcessed = 0;

  console.log(`[${logPrefix}] Starting batch query for collection: ${collectionName}`);

  do {
    // Build query with pagination
    let query = db.collection(collectionName)
      .where(queryParams.field, queryParams.operator, queryParams.value)
      .limit(batchSize);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`[${logPrefix}] No more documents to process`);
      break;
    }

    // Process each document
    for (const doc of snapshot.docs) {
      await processDoc(doc);
      totalProcessed++;
    }

    console.log(`[${logPrefix}] Processed ${snapshot.docs.length} documents in this batch`);

    // Update pagination cursor
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

  } while (lastDoc);

  console.log(`[${logPrefix}] Total documents processed: ${totalProcessed}`);
  return totalProcessed;
}

/**
 * Check if a document exists
 * @param {string} collectionName - Firestore collection name
 * @param {string} documentId - Document ID
 * @returns {Promise<boolean>} - Whether the document exists
 */
async function documentExists(collectionName, documentId) {
  const docRef = db.collection(collectionName).doc(documentId);
  const docSnap = await docRef.get();
  return docSnap.exists;
}

/**
 * Get document count for a query
 * @param {string} collectionName - Firestore collection name
 * @param {Object} queryParams - Query parameters {field, operator, value}
 * @returns {Promise<number>} - Number of documents matching the query
 */
async function getDocumentCount(collectionName, queryParams) {
  const query = db.collection(collectionName)
    .where(queryParams.field, queryParams.operator, queryParams.value);
  
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

module.exports = {
  batchUpdateDocuments,
  batchQueryDocuments,
  documentExists,
  getDocumentCount
}; 