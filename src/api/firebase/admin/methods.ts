import { setDoc, doc, getDoc, deleteDoc, Timestamp, collection, query, orderBy, limit as firestoreLimit, getDocs, addDoc, where } from 'firebase/firestore';
import { db } from '../config';
import { AdminService, PageMetaData, DailyPrompt, ProgrammingAccess } from './types';
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
      // Format date as MM-DD-YYYY for the document path
      const date = prompt.date;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      const dateId = `${month}-${day}-${year}`;
      
      // Clean up data to ensure no undefined values that Firestore doesn't allow
      const promptData: Record<string, any> = {
        id: prompt.id || `${dateId}-${prompt.challengeId || 'general'}`,
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
      
      // Determine the document path based on whether it's linked to a challenge
      let docPath: string;
      if (prompt.challengeId) {
        // Save to: daily-reflections/{MM-DD-YYYY}/challenges/{challengeId}
        docPath = `daily-reflections/${dateId}/challenges/${prompt.challengeId}`;
      } else {
        // Save to: daily-reflections/{MM-DD-YYYY}/general/general (for general reflections)
        docPath = `daily-reflections/${dateId}/general/general`;
      }
      
      await setDoc(doc(db, docPath), promptData);
      console.log(`Daily reflection saved to: ${docPath}`);
      return true;
    } catch (error) {
      console.error('Error creating daily prompt:', error);
      return false;
    }
  },

  async getDailyPrompt(id: string): Promise<DailyPrompt | null> {
    try {
      // Parse the ID to determine the document path
      // ID format: {MM-DD-YYYY}-{challengeId} or {MM-DD-YYYY}-general
      const parts = id.split('-');
      if (parts.length < 4) {
        console.error(`Invalid daily prompt ID format: ${id}. Expected format: MM-DD-YYYY-challengeId`);
        return null;
      }
      
      // Reconstruct the date part (MM-DD-YYYY)
      const dateId = `${parts[0]}-${parts[1]}-${parts[2]}`;
      const challengeOrGeneral = parts.slice(3).join('-'); // Handle challenge IDs that might contain hyphens
      
      let docPath: string;
      if (challengeOrGeneral === 'general') {
        docPath = `daily-reflections/${dateId}/general/general`;
      } else {
        docPath = `daily-reflections/${dateId}/challenges/${challengeOrGeneral}`;
      }
      
      const docRef = doc(db, docPath);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Convert Firestore Timestamps to Date objects
        return {
          id: id,
          dateId: dateId,
          challengeId: challengeOrGeneral === 'general' ? undefined : challengeOrGeneral,
          text: data.text || '',
          date: convertFirestoreTimestamp(data.date),
          createdAt: convertFirestoreTimestamp(data.createdAt),
          updatedAt: convertFirestoreTimestamp(data.updatedAt),
          exerciseId: data.exerciseId,
          exerciseName: data.exerciseName,
          challengeName: data.challengeName
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
      // Get all date documents from daily-reflections collection
      const datesQuery = query(
        collection(db, 'daily-reflections'),
        orderBy('__name__', 'desc'), // Order by document ID (date) descending
        firestoreLimit(limit)
      );
      
      const datesSnapshot = await getDocs(datesQuery);
      const prompts: DailyPrompt[] = [];
      
      // For each date, get all reflections (both general and challenge-specific)
      for (const dateDoc of datesSnapshot.docs) {
        const dateId = dateDoc.id; // MM-DD-YYYY format
        
        try {
          // Get general reflections for this date
          const generalRef = doc(db, 'daily-reflections', dateId, 'general', 'general');
          const generalSnap = await getDoc(generalRef);
          
          if (generalSnap.exists()) {
            const data = generalSnap.data();
            prompts.push({
              id: `${dateId}-general`,
              dateId: dateId,
              challengeId: undefined,
              text: data.text || '',
              date: convertFirestoreTimestamp(data.date),
              createdAt: convertFirestoreTimestamp(data.createdAt),
              updatedAt: convertFirestoreTimestamp(data.updatedAt),
              exerciseId: data.exerciseId,
              exerciseName: data.exerciseName,
              challengeName: data.challengeName
            } as DailyPrompt);
          }
          
          // Get challenge-specific reflections for this date
          const challengesRef = collection(db, 'daily-reflections', dateId, 'challenges');
          const challengesSnapshot = await getDocs(challengesRef);
          
          challengesSnapshot.forEach((challengeDoc) => {
            const data = challengeDoc.data();
            const challengeId = challengeDoc.id;
            
            prompts.push({
              id: `${dateId}-${challengeId}`,
              dateId: dateId,
              challengeId: challengeId,
              text: data.text || '',
              date: convertFirestoreTimestamp(data.date),
              createdAt: convertFirestoreTimestamp(data.createdAt),
              updatedAt: convertFirestoreTimestamp(data.updatedAt),
              exerciseId: data.exerciseId,
              exerciseName: data.exerciseName,
              challengeName: data.challengeName
            } as DailyPrompt);
          });
          
        } catch (dateError) {
          console.error(`Error fetching reflections for date ${dateId}:`, dateError);
        }
      }
      
      // Sort by date descending
      prompts.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      return prompts.slice(0, limit); // Ensure we don't exceed the limit
    } catch (error) {
      console.error('Error getting daily prompts:', error);
      return [];
    }
  },

  async deleteDailyPrompt(id: string): Promise<boolean> {
    try {
      // Parse the ID to determine the document path
      // ID format: {MM-DD-YYYY}-{challengeId} or {MM-DD-YYYY}-general
      const parts = id.split('-');
      if (parts.length < 4) {
        console.error(`Invalid daily prompt ID format: ${id}. Expected format: MM-DD-YYYY-challengeId`);
        return false;
      }
      
      // Reconstruct the date part (MM-DD-YYYY)
      const dateId = `${parts[0]}-${parts[1]}-${parts[2]}`;
      const challengeOrGeneral = parts.slice(3).join('-'); // Handle challenge IDs that might contain hyphens
      
      let docPath: string;
      if (challengeOrGeneral === 'general') {
        docPath = `daily-reflections/${dateId}/general/general`;
      } else {
        docPath = `daily-reflections/${dateId}/challenges/${challengeOrGeneral}`;
      }
      
      const docRef = doc(db, docPath);
      await deleteDoc(docRef);
      console.log(`Successfully deleted daily reflection: ${docPath}`);
      return true;
    } catch (error) {
      console.error('Error deleting daily prompt:', error);
      return false;
    }
  },

  // Programming Access methods
  async createProgrammingAccessRequest(request: Omit<ProgrammingAccess, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const now = new Date();
      const requestData = {
        ...request,
        email: request.email.toLowerCase(), // Normalize email
        status: request.status || 'requested',
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };

      // Check if request already exists for this email
      const existingQuery = query(
        collection(db, 'programming-access'),
        where('email', '==', request.email.toLowerCase())
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        // Update existing request
        const existingDoc = existingSnapshot.docs[0];
        await setDoc(doc(db, 'programming-access', existingDoc.id), {
          ...requestData,
          createdAt: existingDoc.data().createdAt, // Keep original creation date
          updatedAt: Timestamp.fromDate(now)
        });
        console.log('Updated existing programming access request for:', request.email);
      } else {
        // Create new request
        await addDoc(collection(db, 'programming-access'), requestData);
        console.log('Created new programming access request for:', request.email);
      }

      return true;
    } catch (error) {
      console.error('Error creating programming access request:', error);
      return false;
    }
  },

  async getProgrammingAccessRequests(): Promise<ProgrammingAccess[]> {
    try {
      const requestsQuery = query(
        collection(db, 'programming-access'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(requestsQuery);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: convertFirestoreTimestamp(doc.data().createdAt),
        updatedAt: convertFirestoreTimestamp(doc.data().updatedAt),
        approvedAt: doc.data().approvedAt ? convertFirestoreTimestamp(doc.data().approvedAt) : undefined
      })) as ProgrammingAccess[];
    } catch (error) {
      console.error('Error fetching programming access requests:', error);
      return [];
    }
  },

  async updateProgrammingAccessStatus(id: string, status: 'active' | 'deactivated', approvedBy?: string): Promise<boolean> {
    try {
      const now = new Date();
      const updateData: any = {
        status,
        updatedAt: Timestamp.fromDate(now)
      };

      if (status === 'active') {
        updateData.approvedAt = Timestamp.fromDate(now);
        if (approvedBy) {
          updateData.approvedBy = approvedBy;
        }
      }

      await setDoc(doc(db, 'programming-access', id), updateData, { merge: true });
      console.log(`Updated programming access status for ${id} to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating programming access status:', error);
      return false;
    }
  },

  async checkProgrammingAccess(email: string): Promise<ProgrammingAccess | null> {
    try {
      const accessQuery = query(
        collection(db, 'programming-access'),
        where('email', '==', email.toLowerCase()),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(accessQuery);

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: convertFirestoreTimestamp(doc.data().createdAt),
        updatedAt: convertFirestoreTimestamp(doc.data().updatedAt),
        approvedAt: doc.data().approvedAt ? convertFirestoreTimestamp(doc.data().approvedAt) : undefined
      } as ProgrammingAccess;
    } catch (error) {
      console.error('Error checking programming access:', error);
      return null;
    }
  },

  async deleteProgrammingAccessRequest(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'programming-access', id));
      console.log(`Successfully deleted programming access request: ${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting programming access request:', error);
      return false;
    }
  }
}; 