import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import type { GroupMeetContact } from '../../../../../lib/groupMeet';
import {
  GROUP_MEET_CONTACTS_COLLECTION,
  mapGroupMeetContact,
} from '../../../../../lib/groupMeetAdmin';
import { requireAdminRequest } from '../../_auth';

type ContactBody = {
  name?: string;
  email?: string;
  imageUrl?: string;
};

async function listContacts(): Promise<GroupMeetContact[]> {
  const snapshot = await admin
    .firestore()
    .collection(GROUP_MEET_CONTACTS_COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();

  return snapshot.docs.map(mapGroupMeetContact);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ contacts: await listContacts() });
    } catch (error: any) {
      console.error('[group-meet-contacts] Failed to list contacts:', error);
      return res.status(500).json({ error: error?.message || 'Failed to load contacts.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as ContactBody;
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase() || null;
    const imageUrl = (body.imageUrl || '').trim() || null;

    if (!name) {
      return res.status(400).json({ error: 'Contact name is required.' });
    }

    const contactsRef = admin.firestore().collection(GROUP_MEET_CONTACTS_COLLECTION);
    let contactRef: FirebaseFirestore.DocumentReference;

    if (email) {
      const existingSnapshot = await contactsRef.where('email', '==', email).limit(1).get();
      contactRef = existingSnapshot.empty ? contactsRef.doc() : existingSnapshot.docs[0].ref;
    } else {
      contactRef = contactsRef.doc();
    }

    await contactRef.set(
      {
        name,
        email,
        imageUrl,
        createdByEmail: adminUser.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const savedDoc = await contactRef.get();
    return res.status(200).json({ contact: mapGroupMeetContact(savedDoc) });
  } catch (error: any) {
    console.error('[group-meet-contacts] Failed to save contact:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save contact.' });
  }
}
