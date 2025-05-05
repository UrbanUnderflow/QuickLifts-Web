import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
// Revert to original firebase import method
import { admin, db, headers } from './config/firebase'; 
// Import necessary Firebase Admin types
import { Timestamp, FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { KpiSnapshot } from './models/kpiSnapshot'; // Keep existing model imports
import { FunctionMetadata } from './models/functionMetadata';
import { v4 as uuidv4 } from 'uuid';

// Check if Firebase Admin SDK is initialized correctly
if (admin.apps.length === 0) { // Check the apps array
  admin.initializeApp(); // Initialize if not already done
  console.log("Firebase Admin SDK initialized by generateKpiSnapshot.");
} else {
  console.log("Using existing Firebase Admin SDK instance in generateKpiSnapshot.");
}

// Interfaces (assuming these are used by the functions called within)
// Keep interfaces minimal if full logic is in imported functions
interface WorkoutSummary {
  duration?: number; 
  startTime?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  // ... other necessary fields used directly in this file
}

// Helper function to get midnight timestamp for a given date
const getStartOfDay = (date: Date): Timestamp => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(start);
};

// --- Placeholder/Simplified Calculation Functions ---
// Replace these with your actual logic or imports if they exist elsewhere

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

// --- End Placeholder Functions ---

// --- Core KPI Generation Logic Function ---
// This function contains the main logic and can be called by different handlers.
async function runKpiGeneration(): Promise<{ success: boolean; snapshotId?: string; kpiData?: any; error?: string }> {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  console.log(`Core KPI generation logic started at: ${now.toISOString()}`);

  try {
    const totalUsers = await calculateTotalUsers(db);
    const newUsersToday = await calculateNewUsersToday(db, todayStart);
    const totalWorkoutsCompleted = await calculateTotalCompletedWorkouts(db);
    const workoutsCompletedToday = await calculateCompletedWorkoutsToday(db, todayStart);
    const averageWorkoutDuration = await calculateAverageDuration(db);

    console.log(`Calculated KPIs: Users=${totalUsers}, NewToday=${newUsersToday}, Workouts=${totalWorkoutsCompleted}, WorkoutsToday=${workoutsCompletedToday}, AvgDuration=${averageWorkoutDuration.toFixed(2)}`);

    const snapshotDate = Timestamp.now();
    const snapshotId = snapshotDate.toDate().toISOString().split('T')[0]; // YYYY-MM-DD ID

    const kpiData = {
      date: snapshotDate,
      totalUsers,
      newUsersToday,
      totalWorkoutsCompleted,
      workoutsCompletedToday,
      averageWorkoutDuration: parseFloat(averageWorkoutDuration.toFixed(2)),
    };

    const snapshotRef = db.collection('kpiSnapshots').doc(snapshotId);
    await snapshotRef.set(kpiData, { merge: true });
    console.log(`KPI snapshot saved successfully with ID: ${snapshotId}`);

    // Note: Metadata update is handled by the CALLING function (handler or trigger)
    return { success: true, snapshotId, kpiData };

  } catch (error) {
    console.error("Error during core KPI generation logic:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// --- End Core Logic ---

// Function to update metadata (keep this logic)
async function updateFunctionMetadata(status: 'success' | 'error', error?: string, resultId?: string) {
  const metadataRef = db.collection('functionMetadata').doc('generateKpiSnapshot');
  const dataToUpdate: any = {
    lastRunAt: Timestamp.now(),
    lastRunStatus: status,
    runCount: FieldValue.increment(1)
  };
  if (status === 'success') {
    dataToUpdate.lastRunError = FieldValue.delete();
    if (resultId) {
      dataToUpdate.lastResultId = resultId;
    }
  } else if (status === 'error') {
    dataToUpdate.lastRunError = error || 'Unknown error';
  }
  try {
    await metadataRef.set(dataToUpdate, { merge: true });
    console.log(`Function metadata updated: ${status}`);
  } catch (metaError) {
    console.error(`Failed to update metadata with status ${status}:`, metaError);
  }
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const isHttpRequest = event.httpMethod && event.httpMethod !== '' && event.httpMethod !== 'OPTIONS';
  const functionName = 'generateKpiSnapshot'; // Keep track for metadata

  // Handle CORS preflight specifically for HTTP requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // No Content
      headers: headers, // Use imported headers
      body: ''
    };
  }

  console.log(`${functionName} handler started at: ${new Date().toISOString()}`);
  if (isHttpRequest) {
    console.log(`Function invoked via HTTP method: ${event.httpMethod}`);
  }

  // *** Call the core logic function ***
  const result = await runKpiGeneration();

  if (result.success) {
    await updateFunctionMetadata('success', undefined, result.snapshotId);

    // Return HTTP response if applicable
    if (isHttpRequest) {
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" }, // Merge CORS headers
        body: JSON.stringify({
          success: true,
          message: `KPI snapshot generated successfully for ${result.snapshotId}.`,
          snapshotId: result.snapshotId,
          kpiData: result.kpiData 
        }),
      };
    } else {
      // Return a simple success response for scheduled runs to satisfy types,
      // even though Netlify ignores it.
      return { 
          statusCode: 200, 
          body: "Scheduled execution successful (return value ignored)" 
      }; 
    }
  } else { // Core logic failed
    console.error(`Error in ${functionName} handler calling runKpiGeneration:`, result.error);
    await updateFunctionMetadata('error', result.error);

    // Return HTTP error response if applicable
    if (isHttpRequest) {
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" }, // Merge CORS headers
        body: JSON.stringify({
          success: false,
          error: result.error || `An unknown error occurred in ${functionName}.`,
        }),
      };
    } else {
      // For scheduled runs, re-throw the error so Netlify logs it as a failure.
      console.error("Re-throwing error for scheduled function failure logging.");
      throw new Error(result.error || `Unknown error in scheduled ${functionName}`); 
    }
  }
};

// Export both the handler and the core logic function
export { handler, runKpiGeneration }; 