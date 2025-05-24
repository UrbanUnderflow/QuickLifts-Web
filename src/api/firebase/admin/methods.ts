import { setDoc, doc, getDoc, Timestamp, collection, query, orderBy, limit as firestoreLimit, getDocs } from 'firebase/firestore';
import { db } from '../config';
import { AdminService, PageMetaData, DailyPrompt } from './types';
import { dateToUnixTimestamp, convertFirestoreTimestamp } from '../../../utils/formatDate';

export const adminMethods: AdminService = {
  async addVersion(version, changeNotes, isCriticalUpdate) {
    try {
      const notesObject: { [key: string]: string } = {};
      changeNotes.forEach((note, idx) => {
        notesObject[(idx + 1).toString()] = note;
      });
      await setDoc(doc(db, 'version', version), {
        ...notesObject,
        isCriticalUpdate,
      });
      return true;
    } catch (error) {
      console.error('Error adding version:', error);
      throw error;
    }
  },

  async isAdmin(email) {
    try {
      const adminDoc = await getDoc(doc(db, 'admin', email));
      return adminDoc.exists();
    } catch (error) {
      console.error('Error checking admin:', error);
      return false;
    }
  },

  async setPageMetaData(data: PageMetaData): Promise<boolean> {
    try {
      // Ensure lastUpdated is always set on write
      const dataWithTimestamp = { ...data, lastUpdated: Timestamp.now() };
      await setDoc(doc(db, 'pageMetaData', data.pageId), dataWithTimestamp, { merge: true });
      return true;
    } catch (error) {
      console.error('Error setting page meta data:', error);
      return false;
    }
  },

  async getPageMetaData(pageId: string): Promise<PageMetaData | null> {
    try {
      const docRef = doc(db, 'pageMetaData', pageId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as PageMetaData;
      }
      return null;
    } catch (error) {
      console.error('Error getting page meta data:', error);
      return null;
    }
  },

  async createDailyPrompt(prompt: DailyPrompt): Promise<boolean> {
    try {
      const now = new Date();
      // Format date as MM-dd-yyyy for the ID
      const date = prompt.date;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      const promptId = prompt.id || `${month}-${day}-${year}`;
      
      // Clean up data to ensure no undefined values that Firestore doesn't allow
      const promptData: Record<string, any> = {
        id: promptId,
        date: Timestamp.fromDate(prompt.date),
        text: prompt.text,
        createdAt: prompt.createdAt ? Timestamp.fromDate(prompt.createdAt) : Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };
      
      // Only add these optional fields if they have values
      if (prompt.exerciseId) {
        promptData.exerciseId = prompt.exerciseId;
      }
      
      if (prompt.exerciseName) {
        promptData.exerciseName = prompt.exerciseName;
      }
      
      if (prompt.challengeId) {
        promptData.challengeId = prompt.challengeId;
      }
      
      if (prompt.challengeName) {
        promptData.challengeName = prompt.challengeName;
      }
      
      await setDoc(doc(db, 'daily-reflections', promptId), promptData);
      return true;
    } catch (error) {
      console.error('Error creating daily prompt:', error);
      return false;
    }
  },

  async getDailyPrompt(id: string): Promise<DailyPrompt | null> {
    try {
      const docRef = doc(db, 'daily-reflections', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Convert Firestore Timestamps to Date objects
        return {
          ...data,
          date: convertFirestoreTimestamp(data.date),
          createdAt: convertFirestoreTimestamp(data.createdAt),
          updatedAt: convertFirestoreTimestamp(data.updatedAt)
        } as DailyPrompt;
      }
      return null;
    } catch (error) {
      console.error('Error getting daily prompt:', error);
      return null;
    }
  },
  
  async getDailyPrompts(limit: number = 20): Promise<DailyPrompt[]> {
    try {
      const promptsQuery = query(
        collection(db, 'daily-reflections'),
        orderBy('date', 'desc'),
        firestoreLimit(limit)
      );
      
      const querySnapshot = await getDocs(promptsQuery);
      const prompts: DailyPrompt[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        prompts.push({
          ...data,
          date: convertFirestoreTimestamp(data.date),
          createdAt: convertFirestoreTimestamp(data.createdAt),
          updatedAt: convertFirestoreTimestamp(data.updatedAt)
        } as DailyPrompt);
      });
      
      return prompts;
    } catch (error) {
      console.error('Error getting daily prompts:', error);
      return [];
    }
  }
}; 