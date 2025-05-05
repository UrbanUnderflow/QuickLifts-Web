import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { admin, db, headers } from './config/firebase'; 
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// Import the shared core logic function
import { runKpiGeneration } from './generateKpiSnapshot'; 
// Remove model imports if not directly used here, they are handled by runKpiGeneration
// import { KpiSnapshot } from './models/kpiSnapshot'; 
// import { FunctionMetadata } from './models/functionMetadata';
// import { v4 as uuidv4 } from 'uuid';

// Ensure Firebase Admin SDK is initialized 
if (admin.apps.length === 0) {
  admin.initializeApp();
  console.log("Firebase Admin SDK initialized by triggerGenerateKpiSnapshot.");
} else {
  console.log("Using existing Firebase Admin SDK instance in triggerGenerateKpiSnapshot.");
}

// Interfaces (copy from generateKpiSnapshot or import if shared)
interface WorkoutSummary {
  duration?: number; 
  startTime?: Timestamp | Date;
  completedAt?: Timestamp | Date;
}

// Helper function to get midnight timestamp 
const getStartOfDay = (date: Date): Timestamp => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(start);
};

// --- Calculation Functions (Copied from generateKpiSnapshot.ts) ---
async function calculateTotalUsers(db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db.collection('users').count().get();
  return snapshot.data().count;
}

async function calculateNewUsersToday(db: FirebaseFirestore.Firestore, todayStart: Timestamp): Promise<number> {
  const snapshot = await db.collection('users').where('createdAt', '>=', todayStart).count().get();
  return snapshot.data().count;
}

async function calculateTotalCompletedWorkouts(db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db.collection('workout-summaries').where('isCompleted', '==', true).count().get();
  return snapshot.data().count;
}

async function calculateCompletedWorkoutsToday(db: FirebaseFirestore.Firestore, todayStart: Timestamp): Promise<number> {
  const snapshot = await db.collection('workout-summaries').where('isCompleted', '==', true).where('completedAt', '>=', todayStart).count().get();
  return snapshot.data().count;
}

async function calculateAverageDuration(db: FirebaseFirestore.Firestore): Promise<number> {
  let totalDuration = 0;
  let count = 0;
  const snapshot = await db.collection('workout-summaries').where('isCompleted', '==', true).get();
  snapshot.forEach(doc => {
      const data = doc.data() as WorkoutSummary;
      if (data.duration && typeof data.duration === 'number' && data.duration > 0) {
          totalDuration += Math.min(data.duration, 120);
          count++;
      }
  });
  return count > 0 ? totalDuration / count : 0;
}

// --- Update Metadata Function (Modify to be specific for manual trigger, or reuse if structure allows) ---
// Option 1: Reuse if generateKpiSnapshot's metadata is sufficient
// async function updateFunctionMetadata(...) { ... } 

// Option 2: Keep separate metadata for manual runs (as currently implemented)
async function updateManualTriggerMetadata(functionName: string, status: 'success' | 'error', error?: string, resultId?: string) {
  const metadataRef = db.collection('functionMetadata').doc(functionName); // Use generateKpiSnapshot as the key?
  const dataToUpdate: any = {
    lastManualRunAt: Timestamp.now(), 
    lastManualRunStatus: status,
    manualRunCount: FieldValue.increment(1)
  };
  if (status === 'success') {
    dataToUpdate.lastManualRunError = FieldValue.delete();
    if (resultId) {
      dataToUpdate.lastManualRunResultId = resultId;
    }
  } else if (status === 'error') {
    dataToUpdate.lastManualRunError = error || 'Unknown error';
  }
  try {
    await metadataRef.set(dataToUpdate, { merge: true });
    console.log(`Manual trigger metadata updated for ${functionName}: ${status}`);
  } catch (metaError) {
    console.error(`Failed to update manual trigger metadata for ${functionName}:`, metaError);
  }
}

// --- HTTP Handler --- 
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS preflight handling 
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, 
      headers: headers, 
      body: ''
    };
  }

  // POST method check
  if (event.httpMethod !== 'POST') {
     return {
      statusCode: 405, 
      headers: headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' })
    };
  }
  
  const functionToTrigger = 'generateKpiSnapshot'; 
  console.log(`triggerGenerateKpiSnapshot function started via HTTP at: ${new Date().toISOString()}`);

  try {
    // *** Call the shared core logic function ***
    const result = await runKpiGeneration();

    if (result.success) {
      // Update specific manual trigger metadata on success
      await updateManualTriggerMetadata(functionToTrigger, 'success', undefined, result.snapshotId);

      // --- Return Success HTTP response --- 
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" }, 
        body: JSON.stringify({
          success: true,
          message: `KPI snapshot generated successfully for ${result.snapshotId}.`,
          snapshotId: result.snapshotId,
          kpiData: result.kpiData 
        }),
      };
    } else { 
      // --- Core logic returned failure ---
      console.error(`Core KPI generation logic failed: ${result.error}`);
      await updateManualTriggerMetadata(functionToTrigger, 'error', result.error);
      
      return {
          statusCode: 500, // Internal Server Error from the logic function
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
              success: false,
              error: result.error || `Core KPI generation failed during manual trigger of ${functionToTrigger}.`,
          }),
      };
    }

  } catch (error) { 
    // --- Catch unexpected errors during the trigger function execution itself ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error in triggerGenerateKpiSnapshot handler:`, errorMessage);
    // Attempt to update metadata even for unexpected errors
    await updateManualTriggerMetadata(functionToTrigger, 'error', `Trigger Handler Error: ${errorMessage}`);

    // --- Return Generic Error HTTP response --- 
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: `An unexpected error occurred in the trigger function: ${errorMessage}`,
      }),
    };
  } 
};

export { handler }; 