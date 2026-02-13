/**
 * IndexedDB storage utility for handling large file data
 * This is used as an alternative to sessionStorage which has quota limitations
 *
 * IMPORTANT: All browser-storage operations are guarded with
 * `typeof window !== 'undefined'` so this module can be safely imported
 * during Next.js SSR / SSG without triggering "No available storage method"
 * errors from localforage.
 */

// Only import localforage in the browser — during SSR we never touch it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let localforage: any = null;

if (typeof window !== 'undefined') {
  localforage = require('localforage');
}

// Define the database name and store name
const DB_NAME = 'QuickLiftsVideoDB';
const STORE_NAME = 'videoFiles';

/**
 * Initialize localforage (browser-only)
 */
const initializeStorage = () => {
  if (typeof window === 'undefined' || !localforage) {
    return false;
  }

  try {
    console.log('[Storage] Available drivers:',
      localforage.INDEXEDDB ? 'IndexedDB' : 'No IndexedDB',
      localforage.WEBSQL ? 'WebSQL' : 'No WebSQL',
      localforage.LOCALSTORAGE ? 'localStorage' : 'No localStorage'
    );

    // First try to use just one driver at a time to avoid config issues
    try {
      localforage.config({
        driver: localforage.INDEXEDDB,
        name: DB_NAME,
        storeName: STORE_NAME,
        version: 1.0,
        description: 'Storage for video files',
        size: 100 * 1024 * 1024 // Request 100MB storage capacity
      });
      console.log('[Storage] Configured localforage to use IndexedDB');
    } catch (_e) {
      console.warn('[Storage] Failed to configure IndexedDB, falling back to other drivers');
      localforage!.config({
        driver: [
          localforage!.WEBSQL,
          localforage!.LOCALSTORAGE
        ],
        name: DB_NAME,
        storeName: STORE_NAME,
        version: 1.0,
        description: 'Storage for video files'
      });
      console.log('[Storage] Configured localforage to use fallback drivers');
    }

    // Test storage by writing and reading a small value
    const testStorage = async () => {
      try {
        const testKey = 'storage_test_' + Date.now();
        await localforage!.setItem(testKey, { test: 'ok' });
        const testResult = await localforage!.getItem(testKey);
        console.log('[Storage] Storage test completed successfully');
        console.log('[Storage] Test result:', testResult);
        console.log('[Storage] Current driver being used:', await localforage!.driver());
        await localforage!.removeItem(testKey);
        return true;
      } catch (testError) {
        console.error('[Storage] Storage test failed:', testError);
        return false;
      }
    };

    testStorage();
    return true;
  } catch (error) {
    console.error('[Storage] Error initializing localforage:', error);
    return false;
  }
};

// Initialize on module load — only in the browser
if (typeof window !== 'undefined') {
  initializeStorage();
}

/**
 * Stores a video file in storage
 * @param key The key to store the file under
 * @param data The file data object
 * @returns Promise that resolves when the data is stored
 */
export const storeVideoFile = async (key: string, data: any): Promise<void> => {
  if (typeof window === 'undefined' || !localforage) {
    console.warn('[Storage] storeVideoFile called on the server — skipping.');
    return;
  }

  console.log(`[Storage] Storing video file with key: ${key}, estimated size: ${data.data ? Math.round(data.data.length / 1024) : 'unknown'} KB`);

  try {
    // Check if localforage has a driver available
    const currentDriver = await localforage.driver();
    if (!currentDriver) {
      // If no driver is available, attempt to reinitialize
      console.warn('[Storage] No storage driver available, attempting to reinitialize');
      initializeStorage();

      // Check again for a driver
      const retryDriver = await localforage.driver();
      if (!retryDriver) {
        throw new Error('No available storage method found. Please try a different browser or clear browser data.');
      }
    }

    console.log(`[Storage] Using driver: ${await localforage.driver()}`);

    // Clear storage before saving to ensure maximum available space
    await clearUnusedStorage();

    // First, clear any existing data with this key
    await localforage.removeItem(key);
    console.log(`[Storage] Cleared any existing data for key: ${key}`);

    try {
      // Store the data - don't modify the data object, let localforage handle the key
      const startTime = performance.now();
      await localforage.setItem(key, data);
      const endTime = performance.now();
      console.log(`[Storage] Successfully stored video file with key: ${key} in ${Math.round(endTime - startTime)}ms`);
    } catch (storageError) {
      console.error('[Storage] Raw storage error:', storageError);

      // Specific error handling based on the error message or type
      if (storageError instanceof Error) {
        if (storageError.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded. Please try a smaller file or clear your browser data.');
        } else if (storageError.message.includes('No available storage method found')) {
          throw new Error('Browser storage is not available. Try enabling cookies/storage in your browser settings.');
        } else {
          throw storageError;
        }
      } else {
        throw storageError;
      }
    }
  } catch (error) {
    console.error('[Storage] Error storing video file:', error);
    throw error;
  }
};

/**
 * Retrieves a video file from storage
 * @param key The key to retrieve the file under
 * @returns Promise with the file data
 */
export const getVideoFile = async (key: string): Promise<any> => {
  if (typeof window === 'undefined' || !localforage) {
    console.warn('[Storage] getVideoFile called on the server — returning null.');
    return null;
  }

  console.log(`[Storage] Retrieving video file with key: ${key}`);
  try {
    const data = await localforage.getItem(key);
    if (data) {
      console.log(`[Storage] Successfully retrieved video file with key: ${key}`);
      return data;
    } else {
      console.log(`[Storage] No video file found with key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error('[Storage] Error retrieving video file:', error);
    throw error;
  }
};

/**
 * Removes a video file from storage
 * @param key The key of the file to remove
 * @returns Promise that resolves when the data is removed
 */
export const removeVideoFile = async (key: string): Promise<void> => {
  if (typeof window === 'undefined' || !localforage) {
    return;
  }

  console.log(`[Storage] Removing video file with key: ${key}`);
  try {
    await localforage.removeItem(key);
    console.log(`[Storage] Successfully removed video file with key: ${key}`);
  } catch (error) {
    console.error('[Storage] Error removing video file:', error);
    // Don't throw the error, just log it and continue
  }
};

/**
 * Clear unused storage to make space for new files
 */
async function clearUnusedStorage(): Promise<void> {
  if (typeof window === 'undefined' || !localforage) {
    return;
  }

  try {
    console.log('[Storage] Checking for unused files to clear space');

    // These keys should be cleared if they exist to free up space
    const keysToCheck = [
      'trim_video_file_backup',
      'old_video_file',
      'temp_video_file',
      // Add trimmed_video_file to prevent conflicts if a previous trimming was incomplete
      'trimmed_video_file'
    ];

    for (const key of keysToCheck) {
      try {
        const existingItem = await localforage.getItem(key);
        if (existingItem) {
          await localforage.removeItem(key);
          console.log(`[Storage] Cleared unused file with key: ${key}`);
        }
      } catch (e) {
        console.log(`[Storage] Error checking/removing file with key: ${key}`, e);
      }
    }
  } catch (error) {
    console.log('[Storage] Error clearing unused storage:', error);
  }
}

/**
 * Clear all storage (use with caution)
 */
export const clearAllStorage = async (): Promise<void> => {
  if (typeof window === 'undefined' || !localforage) {
    return;
  }

  try {
    console.log('[Storage] Clearing all stored video files');
    await localforage.clear();
    console.log('[Storage] Successfully cleared all storage');
  } catch (error) {
    console.error('[Storage] Error clearing all storage:', error);
  }
}; 