import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config';

export const ATHLETIC_MIND_HUB_FOUNDER_EMAIL = 'tre@fitwithpulse.ai';

export type HubPermission = 'readOnly' | 'wikiEditor' | 'admin';

export type HubAuthor = {
  uid: string;
  name: string;
  email: string;
};

export type CouncilContactRecord = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  team: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

export type CouncilUpdateRecord = {
  id: string;
  title: string;
  audience: string;
  priority: 'Standard' | 'High' | 'Urgent';
  message: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

export type WikiBlockType = 'Section' | 'Research' | 'Thought' | 'Link' | 'Decision';

export type WikiBlockRecord = {
  id: string;
  title: string;
  section: string;
  type: WikiBlockType;
  content: string;
  link: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

export type HubChangeRecord = {
  id: string;
  action: 'created' | 'updated' | 'deleted';
  targetType: 'contact' | 'update' | 'wiki' | 'member' | 'invite';
  targetId: string;
  targetTitle: string;
  createdAt?: unknown;
  authorUid?: string;
  authorName?: string;
  authorEmail?: string;
};

export type HubMemberRecord = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  permission: HubPermission;
  inviteId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
};

export type HubInviteRecord = {
  id: string;
  token: string;
  permission: HubPermission;
  status: 'active' | 'disabled';
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  lastRedeemedAt?: unknown;
  lastRedeemedByUid?: string;
  lastRedeemedByEmail?: string;
};

export type HubUserSearchResult = {
  id: string;
  email: string;
  displayName: string;
  username: string;
};

const CONTACTS_COLLECTION = 'athletic-mind-hub-contacts';
const UPDATES_COLLECTION = 'athletic-mind-hub-updates';
const WIKI_COLLECTION = 'athletic-mind-hub-wiki-blocks';
const CHANGES_COLLECTION = 'athletic-mind-hub-change-log';
const MEMBERS_COLLECTION = 'athletic-mind-hub-members';
const INVITES_COLLECTION = 'athletic-mind-hub-invites';

function withAuthor(author: HubAuthor) {
  return {
    updatedByUid: author.uid,
    updatedByName: author.name,
    updatedByEmail: author.email,
  };
}

async function logChange(
  action: HubChangeRecord['action'],
  targetType: HubChangeRecord['targetType'],
  targetId: string,
  targetTitle: string,
  author: HubAuthor,
) {
  await addDoc(collection(db, CHANGES_COLLECTION), {
    action,
    targetType,
    targetId,
    targetTitle,
    authorUid: author.uid,
    authorName: author.name,
    authorEmail: author.email,
    createdAt: serverTimestamp(),
  });
}

function mapDoc<T>(document: { id: string; data: () => Record<string, unknown> }): T {
  return { id: document.id, ...document.data() } as T;
}

function normalizeSearchText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapUserSearchResult(document: { id: string; data: () => Record<string, unknown> }): HubUserSearchResult {
  const data = document.data();
  const email = normalizeSearchText(data.email).toLowerCase();
  const displayName = normalizeSearchText(data.displayName);
  const username = normalizeSearchText(data.username);

  return {
    id: document.id,
    email,
    displayName: displayName || username || email || 'Pulse user',
    username,
  };
}

function displayNameSearchVariants(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return Array.from(new Set([trimmed, capitalized]));
}

export const athleticMindHubService = {
  subscribeMembership(userId: string, onNext: (member: HubMemberRecord | null) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(db, MEMBERS_COLLECTION, userId),
      (snapshot) => onNext(snapshot.exists() ? mapDoc<HubMemberRecord>(snapshot) : null),
      onError,
    );
  },

  subscribeMembers(onNext: (members: HubMemberRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, MEMBERS_COLLECTION), orderBy('updatedAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.map((document) => mapDoc<HubMemberRecord>(document))),
      onError,
    );
  },

  subscribeInvites(onNext: (invites: HubInviteRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, INVITES_COLLECTION), orderBy('createdAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.map((document) => mapDoc<HubInviteRecord>(document))),
      onError,
    );
  },

  subscribeContacts(onNext: (contacts: CouncilContactRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, CONTACTS_COLLECTION), orderBy('createdAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.map((document) => mapDoc<CouncilContactRecord>(document))),
      onError,
    );
  },

  subscribeUpdates(onNext: (updates: CouncilUpdateRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, UPDATES_COLLECTION), orderBy('createdAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.map((document) => mapDoc<CouncilUpdateRecord>(document))),
      onError,
    );
  },

  subscribeWiki(onNext: (blocks: WikiBlockRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, WIKI_COLLECTION), orderBy('updatedAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.map((document) => mapDoc<WikiBlockRecord>(document))),
      onError,
    );
  },

  subscribeChanges(onNext: (changes: HubChangeRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, CHANGES_COLLECTION), orderBy('createdAt', 'desc')),
      (snapshot) => onNext(snapshot.docs.slice(0, 24).map((document) => mapDoc<HubChangeRecord>(document))),
      onError,
    );
  },

  async searchUsers(searchTerm: string): Promise<HubUserSearchResult[]> {
    const term = normalizeSearchText(searchTerm);
    if (term.length < 2) return [];

    const usersRef = collection(db, 'users');
    const normalizedEmail = term.toLowerCase();
    const normalizedUsername = normalizedEmail.replace(/^@/, '');
    const results = new Map<string, HubUserSearchResult>();

    if (term.length >= 8) {
      const directSnapshot = await getDoc(doc(db, 'users', term));
      if (directSnapshot.exists()) {
        results.set(directSnapshot.id, mapUserSearchResult(directSnapshot));
      }
    }

    const searchQueries = [
      query(usersRef, orderBy('email'), startAt(normalizedEmail), endAt(`${normalizedEmail}\uf8ff`), limit(8)),
      query(usersRef, orderBy('username'), startAt(normalizedUsername), endAt(`${normalizedUsername}\uf8ff`), limit(8)),
      ...displayNameSearchVariants(term).map((displayNameTerm) => (
        query(usersRef, orderBy('displayName'), startAt(displayNameTerm), endAt(`${displayNameTerm}\uf8ff`), limit(8))
      )),
    ];

    await Promise.all(searchQueries.map(async (userQuery) => {
      const snapshot = await getDocs(userQuery);
      snapshot.docs.forEach((document) => {
        const result = mapUserSearchResult(document);
        const haystack = `${result.email} ${result.username} ${result.displayName}`.toLowerCase();
        if (haystack.includes(normalizedEmail)) {
          results.set(result.id, result);
        }
      });
    }));

    return Array.from(results.values()).slice(0, 12);
  },

  async addContact(contact: Omit<CouncilContactRecord, 'id'>, author: HubAuthor) {
    const ref = await addDoc(collection(db, CONTACTS_COLLECTION), {
      ...contact,
      createdByUid: author.uid,
      createdByName: author.name,
      createdByEmail: author.email,
      ...withAuthor(author),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logChange('created', 'contact', ref.id, contact.name || contact.email || 'Contact', author);
  },

  async updateContact(contactId: string, contact: Omit<CouncilContactRecord, 'id'>, author: HubAuthor) {
    await updateDoc(doc(db, CONTACTS_COLLECTION, contactId), {
      ...contact,
      ...withAuthor(author),
      updatedAt: serverTimestamp(),
    });
    await logChange('updated', 'contact', contactId, contact.name || contact.email || 'Contact', author);
  },

  async deleteContact(contact: CouncilContactRecord, author: HubAuthor) {
    await deleteDoc(doc(db, CONTACTS_COLLECTION, contact.id));
    await logChange('deleted', 'contact', contact.id, contact.name || contact.email || 'Contact', author);
  },

  async addUpdate(update: Omit<CouncilUpdateRecord, 'id'>, author: HubAuthor) {
    const ref = await addDoc(collection(db, UPDATES_COLLECTION), {
      ...update,
      createdByUid: author.uid,
      createdByName: author.name,
      createdByEmail: author.email,
      ...withAuthor(author),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logChange('created', 'update', ref.id, update.title, author);
  },

  async deleteUpdate(update: CouncilUpdateRecord, author: HubAuthor) {
    await deleteDoc(doc(db, UPDATES_COLLECTION, update.id));
    await logChange('deleted', 'update', update.id, update.title, author);
  },

  async addWikiBlock(block: Omit<WikiBlockRecord, 'id'>, author: HubAuthor) {
    const ref = await addDoc(collection(db, WIKI_COLLECTION), {
      ...block,
      createdByUid: author.uid,
      createdByName: author.name,
      createdByEmail: author.email,
      ...withAuthor(author),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logChange('created', 'wiki', ref.id, block.title, author);
  },

  async updateWikiBlock(blockId: string, block: Omit<WikiBlockRecord, 'id'>, author: HubAuthor) {
    await updateDoc(doc(db, WIKI_COLLECTION, blockId), {
      ...block,
      ...withAuthor(author),
      updatedAt: serverTimestamp(),
    });
    await logChange('updated', 'wiki', blockId, block.title, author);
  },

  async deleteWikiBlock(block: WikiBlockRecord, author: HubAuthor) {
    await deleteDoc(doc(db, WIKI_COLLECTION, block.id));
    await logChange('deleted', 'wiki', block.id, block.title, author);
  },

  async ensureFounderAdminMembership(author: HubAuthor) {
    if (author.email.toLowerCase() !== ATHLETIC_MIND_HUB_FOUNDER_EMAIL) return;

    const memberRef = doc(db, MEMBERS_COLLECTION, author.uid);
    const snapshot = await getDoc(memberRef);
    if (snapshot.exists() && snapshot.data().permission === 'admin') return;

    await setDoc(
      memberRef,
      {
        userId: author.uid,
        email: author.email,
        displayName: author.name,
        permission: 'admin',
        createdByUid: author.uid,
        createdByName: author.name,
        createdByEmail: author.email,
        ...withAuthor(author),
        createdAt: snapshot.exists() ? snapshot.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await logChange('created', 'member', author.uid, `${author.name} became hub admin`, author);
  },

  async redeemInvite(token: string, author: HubAuthor) {
    const inviteRef = doc(db, INVITES_COLLECTION, token);
    const inviteSnapshot = await getDoc(inviteRef);
    if (!inviteSnapshot.exists()) {
      throw new Error('Invite link was not found.');
    }

    const invite = mapDoc<HubInviteRecord>(inviteSnapshot);
    if (invite.status !== 'active') {
      throw new Error('Invite link is not active.');
    }

    await setDoc(
      doc(db, MEMBERS_COLLECTION, author.uid),
      {
        userId: author.uid,
        email: author.email,
        displayName: author.name,
        permission: invite.permission,
        inviteId: token,
        createdByUid: invite.createdByUid || author.uid,
        createdByName: invite.createdByName || author.name,
        createdByEmail: invite.createdByEmail || author.email,
        ...withAuthor(author),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await updateDoc(inviteRef, {
      lastRedeemedAt: serverTimestamp(),
      lastRedeemedByUid: author.uid,
      lastRedeemedByEmail: author.email,
      ...withAuthor(author),
      updatedAt: serverTimestamp(),
    });

    await logChange('created', 'member', author.uid, `${author.name} joined the hub`, author);
  },

  async createInvite(permission: HubPermission, author: HubAuthor) {
    const inviteRef = doc(collection(db, INVITES_COLLECTION));
    const invite: Omit<HubInviteRecord, 'id'> = {
      token: inviteRef.id,
      permission,
      status: 'active',
      createdByUid: author.uid,
      createdByName: author.name,
      createdByEmail: author.email,
      updatedByUid: author.uid,
      updatedByName: author.name,
      updatedByEmail: author.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(inviteRef, invite);
    await logChange('created', 'invite', inviteRef.id, `${permission} invite generated`, author);
    return inviteRef.id;
  },

  async addMemberFromUser(user: HubUserSearchResult, permission: HubPermission, author: HubAuthor) {
    await setDoc(
      doc(db, MEMBERS_COLLECTION, user.id),
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        permission,
        createdByUid: author.uid,
        createdByName: author.name,
        createdByEmail: author.email,
        ...withAuthor(author),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false },
    );
    await logChange('created', 'member', user.id, `${user.displayName || user.email} added to the hub`, author);
  },

  async updateInviteStatus(invite: HubInviteRecord, status: HubInviteRecord['status'], author: HubAuthor) {
    await updateDoc(doc(db, INVITES_COLLECTION, invite.id), {
      status,
      ...withAuthor(author),
      updatedAt: serverTimestamp(),
    });
    await logChange('updated', 'invite', invite.id, `${invite.permission} invite ${status}`, author);
  },

  async updateMemberPermission(member: HubMemberRecord, permission: HubPermission, author: HubAuthor) {
    await updateDoc(doc(db, MEMBERS_COLLECTION, member.id), {
      permission,
      ...withAuthor(author),
      updatedAt: serverTimestamp(),
    });
    await logChange('updated', 'member', member.id, `${member.displayName || member.email} permission set to ${permission}`, author);
  },

  async deleteMember(member: HubMemberRecord, author: HubAuthor) {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, member.id));
    await logChange('deleted', 'member', member.id, member.displayName || member.email, author);
  },
};
