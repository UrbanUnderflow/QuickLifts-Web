import { setDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config';
import { AdminService, PageMetaData } from './types';

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
  }
}; 