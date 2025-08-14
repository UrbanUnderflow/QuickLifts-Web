const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    console.log('[CleanupDuplicatePrizeRecords] Starting cleanup of duplicate prize records...');
    
    // Get all prize records, grouped by challengeId + userId + placement
    const allRecordsSnapshot = await db.collection('prizeRecords').get();
    
    if (allRecordsSnapshot.empty) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No prize records found',
          duplicatesRemoved: 0
        })
      };
    }
    
    // Group records by unique combination
    const recordGroups = {};
    const allRecords = [];
    
    allRecordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const record = { id: doc.id, ...data };
      allRecords.push(record);
      
      const key = `${data.challengeId}_${data.userId}_${data.placement}`;
      if (!recordGroups[key]) {
        recordGroups[key] = [];
      }
      recordGroups[key].push(record);
    });
    
    console.log(`[CleanupDuplicatePrizeRecords] Found ${allRecords.length} total records in ${Object.keys(recordGroups).length} groups`);
    
    let duplicatesRemoved = 0;
    const duplicateGroups = [];
    
    // Find groups with duplicates
    for (const [key, records] of Object.entries(recordGroups)) {
      if (records.length > 1) {
        duplicateGroups.push({ key, records });
        console.log(`[CleanupDuplicatePrizeRecords] Found ${records.length} duplicates for ${key}`);
      }
    }
    
    if (duplicateGroups.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No duplicate records found',
          duplicatesRemoved: 0
        })
      };
    }
    
    // For each group with duplicates, keep the best record and remove others
    const batch = db.batch();
    
    for (const group of duplicateGroups) {
      const { key, records } = group;
      
      // Sort records to determine which to keep:
      // 1. Paid records first (highest priority)
      // 2. Then by creation date (oldest first)
      records.sort((a, b) => {
        // Paid status takes priority
        if (a.status === 'paid' && b.status !== 'paid') return -1;
        if (b.status === 'paid' && a.status !== 'paid') return 1;
        
        // If both paid or both not paid, prefer older record
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return aTime.getTime() - bTime.getTime();
      });
      
      const keepRecord = records[0];
      const removeRecords = records.slice(1);
      
      console.log(`[CleanupDuplicatePrizeRecords] For ${key}: keeping ${keepRecord.id} (${keepRecord.status}), removing ${removeRecords.length} duplicates`);
      
      // Remove duplicate records
      removeRecords.forEach(record => {
        batch.delete(db.collection('prizeRecords').doc(record.id));
        duplicatesRemoved++;
      });
    }
    
    // Commit all deletions
    await batch.commit();
    
    console.log(`[CleanupDuplicatePrizeRecords] Cleanup complete. Removed ${duplicatesRemoved} duplicate records.`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully cleaned up duplicate prize records`,
        duplicatesRemoved,
        duplicateGroups: duplicateGroups.length,
        details: duplicateGroups.map(g => ({
          key: g.key,
          duplicateCount: g.records.length - 1,
          keptRecord: g.records[0].id,
          removedRecords: g.records.slice(1).map(r => r.id)
        }))
      })
    };
    
  } catch (error) {
    console.error('[CleanupDuplicatePrizeRecords] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler };
