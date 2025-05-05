import { db } from '../config/firebase';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Updates metadata for a specific function run in Firestore.
 * 
 * @param functionName The name of the function (used as the document ID in functionMetadata).
 * @param status The status of the run ('success' or 'error').
 * @param error Optional error message if status is 'error'.
 * @param resultId Optional ID of the generated result (e.g., press release ID) if status is 'success'.
 */
export async function updateFunctionMetadata(functionName: string, status: 'success' | 'error', error?: string, resultId?: string): Promise<void> {
    const metadataRef = db.collection('functionMetadata').doc(functionName);
    const dataToUpdate: any = {
      lastRunAt: Timestamp.now(), // Use lastRunAt for scheduled/general runs
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
      console.log(`Function metadata updated for ${functionName}: ${status}`);
    } catch (metaError) {
      console.error(`Failed to update function metadata for ${functionName}:`, metaError);
      // Optionally re-throw or handle metadata update failure
    }
}

/**
 * Updates specific metadata fields for manual function triggers.
 * 
 * @param functionName The name of the function being triggered.
 * @param status The status of the manual run ('success' or 'error').
 * @param error Optional error message if status is 'error'.
 * @param resultId Optional ID of the generated result if status is 'success'.
 */
export async function updateManualTriggerMetadata(functionName: string, status: 'success' | 'error', error?: string, resultId?: string): Promise<void> {
    const metadataRef = db.collection('functionMetadata').doc(functionName); 
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