import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { onAuthStateChanged, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  Edit3,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import PageHead from '../../components/PageHead';
import { useUser } from '../../hooks/useUser';
import { auth } from '../../api/firebase/config';
import {
  athleticMindHubService,
  ATHLETIC_MIND_HUB_FOUNDER_EMAIL,
  type CouncilContactRecord,
  type HubAuthor,
  type HubMemberRecord,
} from '../../api/firebase/athleticMindHub/service';

const emptyContact: Omit<CouncilContactRecord, 'id'> = {
  name: '',
  role: '',
  email: '',
  phone: '',
  team: '',
  notes: '',
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const raw = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1_000_000));
  }
  return null;
}

function formatDate(value: unknown) {
  const date = toDate(value);
  if (!date) return 'Just now';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(contacts: CouncilContactRecord[]) {
  const header = ['Name', 'Email', 'Notes'];
  const rows = contacts.map((contact) => [
    contact.name,
    contact.email,
    contact.notes,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function authorLabel(record: {
  updatedByName?: string;
  updatedByEmail?: string;
  createdByName?: string;
  createdByEmail?: string;
}) {
  return record.updatedByName || record.createdByName || record.updatedByEmail || record.createdByEmail || 'Council member';
}

const AthleticMindHubContacts: NextPage = () => {
  const currentUser = useUser();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [member, setMember] = useState<HubMemberRecord | null>(null);
  const [contacts, setContacts] = useState<CouncilContactRecord[]>([]);
  const [contactDraft, setContactDraft] = useState(emptyContact);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [inlineContactDraft, setInlineContactDraft] = useState(emptyContact);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  const authorUid = currentUser?.id || firebaseUser?.uid || '';
  const authorEmail = currentUser?.email || firebaseUser?.email || '';
  const authorName = currentUser?.displayName || currentUser?.username || firebaseUser?.displayName || authorEmail || 'Council member';

  const author: HubAuthor | null = useMemo(() => {
    if (!authorUid) return null;
    return {
      uid: authorUid,
      name: authorName,
      email: authorEmail,
    };
  }, [authorEmail, authorName, authorUid]);

  const isFounderAdmin = authorEmail.toLowerCase() === ATHLETIC_MIND_HUB_FOUNDER_EMAIL;
  const isAdmin = isFounderAdmin || member?.permission === 'admin';
  const signedInLabel = author ? authorEmail || authorName : '';
  const accountStatusLabel = author ? `Signed in as ${signedInLabel}` : 'No signed-in account detected';

  useEffect(() => {
    if (!author) {
      setMembershipLoading(false);
      setContactsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setMembershipLoading(true);

    athleticMindHubService.ensureFounderAdminMembership(author).catch((error) => {
      console.error('[AthleticMindHubContacts] Founder admin sync failed', error);
    });

    const unsubscribe = athleticMindHubService.subscribeMembership(
      author.uid,
      (nextMember) => {
        if (cancelled) return;
        setMember(nextMember);
        setMembershipLoading(false);
      },
      (error) => {
        console.error('[AthleticMindHubContacts] Membership subscription failed', error);
        if (!cancelled) setMembershipLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [author]);

  useEffect(() => {
    if (!author) return undefined;
    if (!isAdmin) {
      setContacts([]);
      setContactsLoading(false);
      return undefined;
    }

    setContactsLoading(true);
    return athleticMindHubService.subscribeContacts(
      (nextContacts) => {
        setContacts(nextContacts);
        setContactsLoading(false);
      },
      (error) => {
        console.error('[AthleticMindHubContacts] Contact subscription failed', error);
        setToast('Contact list failed to load');
        setContactsLoading(false);
      },
    );
  }, [author, isAdmin]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contacts;

    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.notes]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [contacts, searchTerm]);

  const contactEmails = useMemo(
    () => contacts.map((contact) => contact.email.trim()).filter(Boolean),
    [contacts],
  );

  const mailtoHref = contactEmails.length
    ? `mailto:?bcc=${encodeURIComponent(contactEmails.join(','))}&subject=${encodeURIComponent('Athletic Mind Council Update')}`
    : undefined;

  function requireAdmin() {
    if (!author) {
      setToast('Sign in to manage contacts');
      return null;
    }
    if (!isAdmin) {
      setToast('Only admins can view the contact list');
      return null;
    }
    return author;
  }

  async function copyText(value: string, confirmation: string) {
    if (!value.trim()) {
      setToast('Nothing to copy yet');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setToast(confirmation);
    } catch {
      setToast('Copy failed; select the text and copy manually');
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setToast('Signed out');
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;
    if (!contactDraft.email.trim()) {
      setToast('Email is required');
      return;
    }

    setSaving(true);
    try {
      await athleticMindHubService.addContact(
        {
          name: contactDraft.name.trim(),
          email: contactDraft.email.trim().toLowerCase(),
          notes: contactDraft.notes.trim(),
          role: '',
          phone: '',
          team: '',
        },
        activeAuthor,
      );
      setContactDraft(emptyContact);
      setToast('Contact saved');
    } catch (error) {
      console.error('[AthleticMindHubContacts] Contact save failed', error);
      setToast('Contact save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveInlineContact(contactId: string) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;
    if (!inlineContactDraft.email.trim()) {
      setToast('Email is required');
      return;
    }

    setSaving(true);
    try {
      await athleticMindHubService.updateContact(
        contactId,
        {
          name: inlineContactDraft.name.trim(),
          email: inlineContactDraft.email.trim().toLowerCase(),
          notes: inlineContactDraft.notes.trim(),
          role: '',
          phone: '',
          team: '',
        },
        activeAuthor,
      );
      setEditingContactId(null);
      setInlineContactDraft(emptyContact);
      setToast('Contact updated');
    } catch (error) {
      console.error('[AthleticMindHubContacts] Contact update failed', error);
      setToast('Contact update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleContactImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setToast('Upload an image file with visible emails');
      return;
    }

    setImportingContacts(true);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Image read failed'));
        reader.readAsDataURL(file);
      });
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setToast('Sign in before importing contacts');
        return;
      }

      const response = await fetch('/api/athletic-mind-hub/extract-email-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ imageDataUrl }),
      });

      const result = await response.json() as {
        contacts?: Array<{ name?: string; email?: string; notes?: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || 'Email extraction failed');
      }

      const existingEmails = new Set(contacts.map((contact) => contact.email.trim().toLowerCase()).filter(Boolean));
      const extractedContacts = (result.contacts || [])
        .map((contact) => ({
          name: (contact.name || '').trim(),
          email: (contact.email || '').trim().toLowerCase(),
          notes: '',
          role: '',
          phone: '',
          team: '',
        }))
        .filter((contact) => contact.email && !existingEmails.has(contact.email));

      if (!extractedContacts.length) {
        setToast('No new emails found in that image');
        return;
      }

      await Promise.all(
        extractedContacts.map((contact) => athleticMindHubService.addContact(contact, activeAuthor)),
      );
      setToast(`Imported ${extractedContacts.length} contact${extractedContacts.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('[AthleticMindHubContacts] Contact image import failed', error);
      setToast(error instanceof Error ? error.message : 'Email image import failed');
    } finally {
      setImportingContacts(false);
    }
  }

  async function removeContact(contact: CouncilContactRecord) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;

    await athleticMindHubService.deleteContact(contact, activeAuthor);
    setToast('Contact removed');
  }

  function editContact(contact: CouncilContactRecord) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;

    setEditingContactId(contact.id);
    setInlineContactDraft({
      name: contact.name || '',
      email: contact.email || '',
      notes: contact.notes || '',
      role: '',
      phone: '',
      team: '',
    });
  }

  function cancelContactEdit() {
    setEditingContactId(null);
    setInlineContactDraft(emptyContact);
  }

  function downloadContacts() {
    if (!isAdmin) {
      setToast('Only admins can export contacts');
      return;
    }
    if (!contacts.length) {
      setToast('Add contacts before exporting');
      return;
    }

    const blob = new Blob([buildCsv(contacts)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'athletic-mind-council-contacts.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        pageOgUrl="https://fitwithpulse.ai/athletic-mind-hub/contacts"
        pageOgImage="/athletic-mind-hub/council-workspace.png"
        themeColor="#294036"
        metaData={{
          pageId: 'athletic-mind-hub-contacts',
          pageTitle: 'Athletic Mind Contacts | Pulse',
          metaDescription: 'Admin contact list for the Athletic Mind Hub.',
          ogTitle: 'Athletic Mind Contacts',
          ogDescription: 'Copy, import, and manage Athletic Mind Council contacts.',
          ogImage: '/athletic-mind-hub/council-workspace.png',
          lastUpdated: new Date().toISOString(),
        }}
      />

      <main className="contactsShell">
        <nav className="topbar" aria-label="Athletic Mind contact navigation">
          <a className="backLink" href="/athletic-mind-hub">
            <ArrowLeft size={18} />
            Hub
          </a>
          {author ? (
            <div className="signedInPill" title={`Signed in as ${signedInLabel}`}>
              <span>Signed in as <strong>{signedInLabel}</strong></span>
              <button type="button" onClick={handleSignOut} aria-label="Sign out">
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          ) : (
            <div className="signedInPill muted" title={accountStatusLabel}>
              <span>No account detected</span>
              <a className="pillButton" href="/athletic-mind-hub/contacts?signin=1">Sign in</a>
            </div>
          )}
        </nav>

        <header className="pageHeader">
          <div>
            <p className="eyebrow">Admin contact list</p>
            <h1>Contacts</h1>
            <p>Name, email, and notes for Athletic Mind Council communications.</p>
          </div>
          {isAdmin && (
            <div className="headerActions">
              <a className={`primaryAction${!mailtoHref ? ' disabled' : ''}`} href={mailtoHref}>
                <Mail size={18} />
                Email Council
              </a>
              <button className="secondaryAction" type="button" onClick={() => copyText(contactEmails.join(', '), 'Council emails copied')}>
                <Clipboard size={18} />
                Copy emails
              </button>
              <button className="iconButton" type="button" onClick={downloadContacts} aria-label="Download contact CSV" title="Download contact CSV">
                <Download size={18} />
              </button>
            </div>
          )}
        </header>

        {membershipLoading || contactsLoading ? (
          <section className="accessState">
            <Loader2 className="spin" size={26} />
            <h2>Checking access</h2>
          </section>
        ) : !isAdmin ? (
          <section className="accessState">
            <ShieldCheck size={28} />
            <h2>Admin access required</h2>
            <strong>{accountStatusLabel}</strong>
            <p>
              {author
                ? 'The council contact list is only visible to Athletic Mind Hub admins. Ask an admin to update this account permission.'
                : 'Sign in with an admin account to view and manage the council contact list.'}
            </p>
          </section>
        ) : (
          <section className="contactsGrid">
            <aside className="contactComposer">
              <form className="panel" onSubmit={handleContactSubmit}>
                <label>
                  Name
                  <input value={contactDraft.name} onChange={(event) => setContactDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Optional" />
                </label>
                <label>
                  Email
                  <input type="email" value={contactDraft.email} onChange={(event) => setContactDraft((draft) => ({ ...draft, email: event.target.value }))} placeholder="name@school.edu" />
                </label>
                <label>
                  Notes
                  <textarea value={contactDraft.notes} onChange={(event) => setContactDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Best channel, committee assignment, availability" rows={4} />
                </label>
                <button className="primaryAction fullWidth" type="submit" disabled={saving}>
                  {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
                  Add Contact
                </button>
              </form>

              <label className="panel contactImport">
                <input type="file" accept="image/*" onChange={handleContactImageUpload} disabled={importingContacts || saving} />
                <span>
                  {importingContacts ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
                  {importingContacts ? 'Extracting emails...' : 'Upload picture of emails'}
                </span>
                <small>Extracted emails are added automatically. Blank names stay blank.</small>
              </label>
            </aside>

            <section className="contactListArea">
              <div className="listToolbar">
                <div className="searchBox">
                  <Search size={17} />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" />
                </div>
                <span>{filteredContacts.length} of {contacts.length}</span>
              </div>

              <div className="contactList">
                {filteredContacts.length ? (
                  filteredContacts.map((contact) => {
                    const displayName = contact.name || 'Unnamed contact';
                    const isEditing = editingContactId === contact.id;
                    return (
                      <article className="contactRow" key={contact.id}>
                        {isEditing ? (
                          <div className="inlineContactEditor">
                            <div className="inlineEditorGrid">
                              <label>
                                Name
                                <input value={inlineContactDraft.name} onChange={(event) => setInlineContactDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Optional" />
                              </label>
                              <label>
                                Email
                                <input type="email" value={inlineContactDraft.email} onChange={(event) => setInlineContactDraft((draft) => ({ ...draft, email: event.target.value }))} placeholder="name@school.edu" />
                              </label>
                            </div>
                            <label>
                              Notes
                              <textarea value={inlineContactDraft.notes} onChange={(event) => setInlineContactDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Best channel, committee assignment, availability" rows={3} />
                            </label>
                            <div className="inlineEditorActions">
                              <button className="primaryAction" type="button" onClick={() => saveInlineContact(contact.id)} disabled={saving}>
                                {saving ? <Loader2 className="spin" size={18} /> : <Edit3 size={18} />}
                                Save
                              </button>
                              <button className="secondaryAction" type="button" onClick={cancelContactEdit}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <h3>{displayName}</h3>
                              <a href={`mailto:${contact.email}`}>{contact.email}</a>
                              {contact.notes && <p>{contact.notes}</p>}
                              <small>Added by {authorLabel(contact)} · {formatDate(contact.createdAt)}</small>
                            </div>
                            <div className="rowActions">
                              <button type="button" onClick={() => editContact(contact)} aria-label={`Edit ${displayName}`} title="Edit contact"><Edit3 size={16} /></button>
                              <button type="button" onClick={() => copyText(contact.email, `${displayName}'s email copied`)} aria-label={`Copy ${displayName}'s email`} title="Copy email"><Clipboard size={16} /></button>
                              <button type="button" onClick={() => removeContact(contact)} aria-label={`Remove ${displayName}`} title="Remove contact"><Trash2 size={16} /></button>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="emptyState">
                    <Users size={24} />
                    <h3>{contacts.length ? 'No matching contacts' : 'No contacts yet'}</h3>
                    <p>{contacts.length ? 'Try another search term.' : 'Add the first council contact or upload a screenshot of emails.'}</p>
                  </div>
                )}
              </div>
            </section>
          </section>
        )}

        <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
          <Check size={17} />
          {toast}
        </div>
      </main>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: #f4f1ea;
        }

        .contactsShell {
          min-height: 100vh;
          color: #16251f;
          background: #f4f1ea;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .topbar,
        .pageHeader,
        .contactsGrid,
        .accessState {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .topbar,
        .pageHeader,
        .headerActions,
        .backLink,
        .signedInPill,
        .signedInPill button,
        .primaryAction,
        .secondaryAction,
        .listToolbar,
        .searchBox,
        .contactImport span,
        .rowActions {
          display: flex;
          align-items: center;
        }

        .topbar {
          justify-content: space-between;
          padding: 24px 0 18px;
        }

        .backLink {
          gap: 8px;
          color: #294036;
          font-weight: 900;
          text-decoration: none;
        }

        .signedInPill {
          gap: 10px;
          max-width: min(520px, 58vw);
          border: 1px solid #d8d0c2;
          border-radius: 999px;
          background: #fffdf8;
          padding: 7px 8px 7px 12px;
          color: #5f6d66;
          font-size: 0.82rem;
          font-weight: 850;
        }

        .signedInPill span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .signedInPill strong {
          color: #16251f;
        }

        .signedInPill button,
        .signedInPill .pillButton {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          border: 0;
          border-radius: 999px;
          background: #16251f;
          color: #fff8e6;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 900;
          padding: 0 10px;
          text-decoration: none;
          white-space: nowrap;
        }

        .signedInPill.muted {
          padding: 7px 8px 7px 12px;
        }

        .pageHeader {
          justify-content: space-between;
          gap: 22px;
          padding: 52px 0 28px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #d99c68;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 10px;
          font-size: clamp(3rem, 7vw, 6rem);
          line-height: 0.95;
          letter-spacing: 0;
        }

        .pageHeader p {
          margin-bottom: 0;
          color: #5f6d66;
          font-size: 1.08rem;
          line-height: 1.55;
        }

        .headerActions {
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
        }

        button,
        a,
        input,
        textarea {
          -webkit-tap-highlight-color: transparent;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        .primaryAction,
        .secondaryAction,
        .iconButton {
          border: 0;
          cursor: pointer;
          transition: transform 160ms ease, background 160ms ease;
        }

        .primaryAction,
        .secondaryAction {
          justify-content: center;
          gap: 10px;
          min-height: 46px;
          border-radius: 8px;
          padding: 0 18px;
          font-weight: 900;
          text-decoration: none;
        }

        .primaryAction {
          background: #e7b953;
          color: #14241e;
        }

        .primaryAction.disabled {
          pointer-events: none;
          opacity: 0.55;
        }

        .secondaryAction,
        .iconButton,
        .rowActions button {
          border: 1px solid #d8d0c2;
          background: #fffdf8;
          color: #294036;
        }

        .iconButton,
        .rowActions button {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 8px;
        }

        .primaryAction:hover,
        .secondaryAction:hover,
        .iconButton:hover,
        .rowActions button:hover {
          transform: translateY(-1px);
        }

        .contactsGrid {
          display: grid;
          grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
          gap: 22px;
          align-items: start;
          padding-bottom: 80px;
        }

        .contactComposer,
        .contactList,
        .panel {
          display: grid;
          gap: 14px;
        }

        .panel,
        .contactRow,
        .emptyState {
          border: 1px solid #ded6c7;
          border-radius: 8px;
          background: #fffdf8;
          box-shadow: 0 18px 54px rgba(29, 41, 36, 0.08);
        }

        .panel,
        .contactRow {
          padding: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #465c52;
          font-weight: 900;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9d0c2;
          border-radius: 8px;
          background: #fffaf2;
          color: #16251f;
          font-size: 0.95rem;
          font-weight: 650;
          line-height: 1.4;
          outline: none;
          padding: 12px 13px;
        }

        textarea {
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color: #4a8d75;
          box-shadow: 0 0 0 4px rgba(74, 141, 117, 0.16);
        }

        .fullWidth {
          width: 100%;
        }

        .contactImport {
          position: relative;
          cursor: pointer;
          color: #4a5c54;
        }

        .contactImport input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .contactImport span {
          gap: 10px;
          color: #16251f;
          font-weight: 900;
        }

        .contactImport small {
          color: #7b877f;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.4;
        }

        .listToolbar {
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .listToolbar > span {
          color: #6d7b73;
          font-size: 0.86rem;
          font-weight: 850;
          white-space: nowrap;
        }

        .searchBox {
          flex: 1;
          gap: 8px;
          border: 1px solid #ddd6c8;
          border-radius: 8px;
          background: #fffdf8;
          padding: 0 12px;
          color: #75827c;
        }

        .searchBox input {
          border: 0;
          background: transparent;
          box-shadow: none;
          padding-left: 0;
        }

        .contactRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }

        .inlineContactEditor {
          display: grid;
          grid-column: 1 / -1;
          gap: 14px;
        }

        .inlineEditorGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .inlineEditorActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .inlineEditorActions .primaryAction,
        .inlineEditorActions .secondaryAction {
          width: auto;
          min-width: 120px;
        }

        .contactRow h3 {
          margin-bottom: 5px;
          color: #16251f;
          font-size: 1.05rem;
        }

        .contactRow a {
          color: #245f74;
          font-weight: 850;
          overflow-wrap: anywhere;
          text-decoration: none;
        }

        .contactRow p {
          margin: 10px 0 0;
          color: #5f6d66;
          line-height: 1.45;
        }

        .contactRow small {
          display: block;
          margin-top: 10px;
          color: #7b877f;
          font-weight: 750;
        }

        .rowActions {
          gap: 8px;
        }

        .accessState,
        .emptyState {
          display: grid;
          place-items: center;
          gap: 9px;
          min-height: 240px;
          padding: 34px;
          text-align: center;
          color: #4a8d75;
        }

        .accessState h2,
        .emptyState h3 {
          margin: 0;
          color: #16251f;
        }

        .accessState p,
        .emptyState p {
          max-width: 560px;
          margin-bottom: 0;
          color: #5f6d66;
          line-height: 1.6;
        }

        .toast {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: min(360px, calc(100vw - 44px));
          border-radius: 8px;
          background: #16251f;
          color: #fff8e6;
          padding: 13px 16px;
          font-weight: 800;
          opacity: 0;
          pointer-events: none;
          transform: translateY(10px);
          transition: opacity 160ms ease, transform 160ms ease;
        }

        .toast.show {
          opacity: 1;
          transform: translateY(0);
        }

        .spin {
          animation: spin 900ms linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 860px) {
          .pageHeader,
          .contactsGrid,
          .contactRow,
          .inlineEditorGrid {
            grid-template-columns: 1fr;
          }

          .pageHeader {
            display: grid;
          }

          .headerActions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .topbar,
          .pageHeader,
          .contactsGrid,
          .accessState {
            width: min(100% - 28px, 1180px);
          }

          .topbar {
            align-items: flex-start;
          }

          .signedInPill {
            max-width: 62vw;
          }

          .headerActions,
          .listToolbar {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};

export default AthleticMindHubContacts;
