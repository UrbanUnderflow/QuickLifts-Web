// Function to repair prize assignments that have been distributed but don't have proper funding status
const { db, admin, headers } = require('./config/firebase');

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Firebase database not available'
        })
      };
    }

    console.log('[RepairPrizeFundingStatus] Starting repair process...');

    // Get all prize assignments
    const prizeAssignmentsSnapshot = await db.collection('challenge-prizes').get();
    
    const repairResults = [];

    for (const doc of prizeAssignmentsSnapshot.docs) {
      const data = doc.data();
      const assignmentId = doc.id;
      
      // Check if this assignment needs repair
      if ((data.distributionStatus === 'distributed' || data.distributionStatus === 'partially_distributed') &&
          (!data.fundingStatus || data.fundingStatus === 'pending' || !data.escrowRecordId)) {
        
        console.log(`[RepairPrizeFundingStatus] Found assignment needing repair: ${assignmentId}`);
        
        // Look for escrow record
        // First try by prizeAssignmentId
        let escrowQuery = await db.collection('prize-escrow')
          .where('prizeAssignmentId', '==', assignmentId)
          .get();
        
        let escrowRecord = null;
        
        if (escrowQuery.empty) {
          // Try by challengeId and check if it has been distributed
          console.log(`[RepairPrizeFundingStatus] No escrow by assignmentId, trying by challengeId...`);
          escrowQuery = await db.collection('prize-escrow')
            .where('challengeId', '==', data.challengeId)
            .get();
          
          // Find escrow that has been distributed
          for (const escrowDoc of escrowQuery.docs) {
            const escrowData = escrowDoc.data();
            if (escrowData.distributedTo && escrowData.distributedTo.length > 0) {
              escrowRecord = { id: escrowDoc.id, ...escrowData };
              break;
            }
          }
        } else {
          escrowRecord = { id: escrowQuery.docs[0].id, ...escrowQuery.docs[0].data() };
        }
        
        if (escrowRecord) {
          console.log(`[RepairPrizeFundingStatus] Found matching escrow: ${escrowRecord.id}`);
          
          // Update the prize assignment with proper funding status
          const updateData = {
            fundingStatus: 'funded',
            escrowRecordId: escrowRecord.id,
            depositedAmount: escrowRecord.amount || data.prizeAmount * 100, // Escrow stores in cents
            totalAmountCharged: escrowRecord.totalAmountCharged || escrowRecord.amount,
            platformFeeCollected: escrowRecord.metadata?.platformFee || 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          if (escrowRecord.createdAt) {
            updateData.depositedAt = escrowRecord.createdAt;
          }
          
          if (escrowRecord.depositedBy) {
            updateData.depositedBy = escrowRecord.depositedBy;
          }
          
          await doc.ref.update(updateData);
          
          repairResults.push({
            assignmentId,
            challengeId: data.challengeId,
            status: 'repaired',
            escrowRecordId: escrowRecord.id,
            depositedAmount: updateData.depositedAmount
          });
          
          console.log(`[RepairPrizeFundingStatus] Successfully repaired assignment ${assignmentId}`);
        } else {
          console.warn(`[RepairPrizeFundingStatus] No escrow found for distributed assignment ${assignmentId}`);
          repairResults.push({
            assignmentId,
            challengeId: data.challengeId,
            status: 'no_escrow_found',
            error: 'Distributed but no escrow record found'
          });
        }
      }
    }

    console.log(`[RepairPrizeFundingStatus] Repair complete. Processed ${repairResults.length} assignments`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Repaired ${repairResults.filter(r => r.status === 'repaired').length} assignments`,
        results: repairResults
      })
    };

  } catch (error) {
    console.error('[RepairPrizeFundingStatus] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler };
