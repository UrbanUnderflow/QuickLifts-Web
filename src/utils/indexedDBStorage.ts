/**
 * IndexedDB storage utility for handling large file data
 * This is used as an alternative to sessionStorage which has quota limitations
 */

// Define the database name and store name
const DB_NAME = 'QuickLiftsVideoDB';
const STORE_NAME = 'videoFiles';
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database
 * @returns Promise with the database instance
 */
export const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening IndexedDB');
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Stores a video file in IndexedDB
 * @param key The key to store the file under
 * @param data The file data object
 * @returns Promise that resolves when the data is stored
 */
export const storeVideoFile = async (key: string, data: any): Promise<void> => {
  console.log(`[IndexedDB] Storing video file with key: ${key}`);
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Add the ID to the data object
      const dataWithId = { ...data, id: key };
      const request = store.put(dataWithId);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Successfully stored video file with key: ${key}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('[IndexedDB] Error storing video file:', event);
        reject('Error storing data in IndexedDB');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error in storeVideoFile:', error);
    throw error;
  }
};

/**
 * Retrieves a video file from IndexedDB
 * @param key The key to retrieve the file under
 * @returns Promise with the file data
 */
export const getVideoFile = async (key: string): Promise<any> => {
  console.log(`[IndexedDB] Retrieving video file with key: ${key}`);
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`[IndexedDB] Successfully retrieved video file with key: ${key}`);
          resolve(result);
        } else {
          console.log(`[IndexedDB] No video file found with key: ${key}`);
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('[IndexedDB] Error retrieving video file:', event);
        reject('Error retrieving data from IndexedDB');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error in getVideoFile:', error);
    throw error;
  }
};

/**
 * Removes a video file from IndexedDB
 * @param key The key of the file to remove
 * @returns Promise that resolves when the data is removed
 */
export const removeVideoFile = async (key: string): Promise<void> => {
  console.log(`[IndexedDB] Removing video file with key: ${key}`);
  try {
    // First check if the file exists to avoid unnecessary operations
    const fileExists = await getVideoFile(key);
    if (!fileExists) {
      console.log(`[IndexedDB] No file found with key: ${key}, skipping removal`);
      return;
    }
    
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Successfully removed video file with key: ${key}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('[IndexedDB] Error removing video file:', event);
        reject('Error removing data from IndexedDB');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error in removeVideoFile:', error);
    // Don't throw the error, just log it and continue
    // This prevents cascading failures if the file is already gone
  }
}; 