import { setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import { AdminService } from './types';

export const adminMethods: AdminService = {
  async addVersion(version, changeNotes, isCriticalUpdate) {
    try {
      const notesObject: { [key: string]: string } = {};
      changeNotes.forEach((note, idx) => {
        notesObject[(idx + 1).toString()] = note;
      });
      await setDoc(doc(db, 'versions', version), {
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
  }
}; 