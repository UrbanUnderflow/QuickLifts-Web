import { Handler } from '@netlify/functions';
import { admin, db, headers } from './config/firebase';
import { KpiSnapshot } from './models/kpiSnapshot';
import { FunctionMetadata } from './models/functionMetadata';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a KPI snapshot by fetching metrics from Firebase collections
 */
export const generateKpiSnapshot = async (): Promise<{ success: boolean; data?: KpiSnapshot; error?: string }> => {
  try {
    console.log("Generating KPI snapshot...");
    const timestamp = Math.floor(Date.now() / 1000);
    const kpiSnapshotId = uuidv4();
    
    // Initialize snapshot with default values
    const snapshot: KpiSnapshot = {
      id: kpiSnapshotId,
      capturedAt: timestamp,
      totalUsers: 0,
      activeUsers: 0,
      workoutCount: 0,
      challengeParticipants: 0,
      totalCreators: 0,
      payingCreators: 0,
      notableEvents: [],
    };

    // 1. Fetch total user count
    const userCountSnapshot = await db.collection('users').get();
    snapshot.totalUsers = userCountSnapshot.size;
    console.log(`Total users: ${snapshot.totalUsers}`);

    // 2. Fetch active users (users who have logged in within last 30 days)
    const thirtyDaysAgo = timestamp - (30 * 24 * 60 * 60); // 30 days in seconds
    const activeUsersSnapshot = await db
      .collection('users')
      .where('lastLoginAt', '>=', thirtyDaysAgo)
      .get();
    snapshot.activeUsers = activeUsersSnapshot.size;
    console.log(`Active users: ${snapshot.activeUsers}`);

    // 3. Fetch total workout count
    const workoutCountSnapshot = await db.collection('workout-summaries').get();
    snapshot.workoutCount = workoutCountSnapshot.size;
    console.log(`Total workouts: ${snapshot.workoutCount}`);

    // 4. Fetch challenge participants
    const activeChallengesSnapshot = await db
      .collection('sweatlist-collection')
      .where('challenge.status', '==', 'active')
      .get();
    
    let totalParticipants = 0;
    activeChallengesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.participants && typeof data.participants === 'object') {
        totalParticipants += Object.keys(data.participants).length;
      }
    });
    snapshot.challengeParticipants = totalParticipants;
    console.log(`Challenge participants: ${snapshot.challengeParticipants}`);

    // 5. Fetch creator counts (users who have created workouts)
    // For this example, we'll count users who have at least one workout
    const creatorIdsSet = new Set<string>();
    const creatorSnapshot = await db
      .collection('workout-summaries')
      .select('userId')
      .get();
    
    creatorSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        creatorIdsSet.add(data.userId);
      }
    });
    snapshot.totalCreators = creatorIdsSet.size;
    console.log(`Total creators: ${snapshot.totalCreators}`);

    // 6. Paying creators (this would typically come from a subscription system)
    // For demo purposes, let's assume 5% of creators are paying
    snapshot.payingCreators = Math.floor(snapshot.totalCreators * 0.05);
    console.log(`Paying creators: ${snapshot.payingCreators}`);

    // 7. Notable events (could be manually entered or detected from data)
    // For demo purposes, we'll check if there are any challenges with more than 100 participants
    const notableEvents: string[] = [];
    activeChallengesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.participants && Object.keys(data.participants).length > 100) {
        notableEvents.push(`Challenge ${data.challenge?.title || 'Untitled'} with ${Object.keys(data.participants).length} participants`);
      }
    });
    snapshot.notableEvents = notableEvents;
    console.log(`Notable events: ${snapshot.notableEvents}`);

    // 8. Calculate growth metrics if previous snapshot exists
    const previousSnapshots = await db
      .collection('kpiSnapshots')
      .orderBy('capturedAt', 'desc')
      .limit(1)
      .get();
    
    if (!previousSnapshots.empty) {
      const prevSnapshot = previousSnapshots.docs[0].data() as KpiSnapshot;
      const weeklyGrowth = {
        users: calculateGrowthPercentage(prevSnapshot.totalUsers, snapshot.totalUsers),
        workouts: calculateGrowthPercentage(prevSnapshot.workoutCount, snapshot.workoutCount),
        creators: calculateGrowthPercentage(prevSnapshot.totalCreators, snapshot.totalCreators)
      };
      
      snapshot.weeklyGrowth = weeklyGrowth;
      console.log(`Weekly growth: ${JSON.stringify(weeklyGrowth)}`);
    }

    // 9. Save the snapshot to Firestore
    await db.collection('kpiSnapshots').doc(kpiSnapshotId).set(snapshot);
    console.log(`KPI snapshot saved with ID: ${kpiSnapshotId}`);

    return {
      success: true,
      data: snapshot
    };
  } catch (error) {
    console.error("Error generating KPI snapshot:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Calculate percentage growth between two values
 */
function calculateGrowthPercentage(previousValue: number, currentValue: number): number {
  if (previousValue === 0) return 0;
  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

/**
 * Update function metadata after execution
 */
async function updateFunctionMetadata(status: 'success' | 'error', error?: string, resultId?: string): Promise<void> {
  try {
    const metadataRef = db.collection('functionMetadata').doc('generateKpiSnapshot');
    const metadataDoc = await metadataRef.get();
    
    const timestamp = Math.floor(Date.now() / 1000);
    let metadata: FunctionMetadata;
    
    if (metadataDoc.exists) {
      const existingData = metadataDoc.data() as FunctionMetadata;
      metadata = {
        ...existingData,
        lastRunAt: timestamp,
        lastRunStatus: status,
        lastRunError: error,
        lastResultId: resultId,
        runCount: (existingData.runCount || 0) + 1
      };
    } else {
      metadata = {
        id: 'generateKpiSnapshot',
        lastRunAt: timestamp,
        lastRunStatus: status,
        lastRunError: error,
        lastResultId: resultId,
        runCount: 1,
        schedule: 'Daily'
      };
    }
    
    await metadataRef.set(metadata);
    console.log("Function metadata updated successfully");
  } catch (error) {
    console.error("Error updating function metadata:", error);
  }
}

/**
 * Netlify Function Handler
 */
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST methods
  if (event.httpMethod !== 'POST' && !event.headers?.['x-netlify-event-source']) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const result = await generateKpiSnapshot();

    if (result.success) {
      await updateFunctionMetadata('success', undefined, result.data?.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'KPI snapshot generated successfully',
          data: result.data
        })
      };
    } else {
      await updateFunctionMetadata('error', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Failed to generate KPI snapshot',
          error: result.error
        })
      };
    }
  } catch (error) {
    console.error("Handler error:", error);
    await updateFunctionMetadata('error', error instanceof Error ? error.message : 'Unknown error');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 