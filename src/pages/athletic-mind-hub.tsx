import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import {
  Bell,
  BookOpenText,
  CalendarDays,
  Check,
  Clipboard,
  Edit3,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Megaphone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import PageHead from '../components/PageHead';
import { useUser } from '../hooks/useUser';
import { auth } from '../api/firebase/config';
import {
  athleticMindHubService,
  ATHLETIC_MIND_HUB_FOUNDER_EMAIL,
  type CouncilUpdateRecord,
  type HubAuthor,
  type HubChangeRecord,
  type HubMemberRecord,
  type HubPermission,
  type WikiBlockRecord,
  type WikiBlockType,
} from '../api/firebase/athleticMindHub/service';

const emptyWikiBlock: Omit<WikiBlockRecord, 'id'> = {
  title: '',
  section: 'Council Notes',
  type: 'Thought',
  content: '',
  link: '',
};

const permissionLabels: Record<HubPermission, string> = {
  readOnly: 'Read only',
  wikiEditor: 'Read + update wiki',
  admin: 'Admin',
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

function buildUpdateCopy(update: CouncilUpdateRecord) {
  return [
    update.title,
    `Audience: ${update.audience}`,
    `Priority: ${update.priority}`,
    '',
    update.message,
  ].join('\n');
}

function sectionAnchor(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `wiki-section-${slug || 'section'}`;
}

function authorLabel(record: {
  updatedByName?: string;
  updatedByEmail?: string;
  createdByName?: string;
  createdByEmail?: string;
}) {
  return record.updatedByName || record.createdByName || record.updatedByEmail || record.createdByEmail || 'Council member';
}

const AthleticMindHub: NextPage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [updates, setUpdates] = useState<CouncilUpdateRecord[]>([]);
  const [wikiBlocks, setWikiBlocks] = useState<WikiBlockRecord[]>([]);
  const [changes, setChanges] = useState<HubChangeRecord[]>([]);
  const [member, setMember] = useState<HubMemberRecord | null>(null);
  const [wikiDraft, setWikiDraft] = useState(emptyWikiBlock);
  const [editingWikiId, setEditingWikiId] = useState<string | null>(null);
  const [wikiSearchTerm, setWikiSearchTerm] = useState('');
  const [wikiEditorOpen, setWikiEditorOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const redeemedInviteRef = useRef('');

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  const authorUid = currentUser?.id || firebaseUser?.uid || '';
  const authorEmail = currentUser?.email || firebaseUser?.email || '';
  const authorName = currentUser?.displayName || currentUser?.username || authorEmail || 'Council member';

  const author: HubAuthor | null = useMemo(() => {
    if (!authorUid) return null;

    return {
      uid: authorUid,
      name: authorName,
      email: authorEmail,
    };
  }, [authorEmail, authorName, authorUid]);

  const signedInLabel = author?.email || author?.name || '';

  const inviteToken = useMemo(() => {
    const raw = router.query.invite;
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  }, [router.query.invite]);

  const permission = member?.permission;
  const isFounder = author?.email.toLowerCase() === ATHLETIC_MIND_HUB_FOUNDER_EMAIL;
  const isAdmin = isFounder || permission === 'admin';
  const canEditWiki = isAdmin || permission === 'wikiEditor';
  const canReadHub = isAdmin || permission === 'readOnly' || permission === 'wikiEditor';
  const accessLabel = canReadHub
    ? permissionLabels[permission || (isFounder ? 'admin' : 'readOnly')]
    : membershipLoading
      ? 'Checking access'
      : 'Access required';

  useEffect(() => {
    if (author) return;
    setMember(null);
    setMembershipLoading(false);
    setLoading(false);
  }, [author]);

  useEffect(() => {
    if (!author) return undefined;
    const onError = (error: Error) => {
      console.error('[AthleticMindHub] Firestore sync error', error);
      setToast('Firebase sync needs permission or connection');
      setMembershipLoading(false);
      setLoading(false);
    };

    setMembershipLoading(true);
    const timeout = window.setTimeout(() => {
      setMembershipLoading(false);
      setToast('Hub permission check timed out. Try refreshing or sign out and back in.');
    }, 9000);

    athleticMindHubService.ensureFounderAdminMembership(author).catch((error) => {
      console.warn('[AthleticMindHub] Founder admin bootstrap failed', error);
      setMembershipLoading(false);
      setToast(error instanceof Error ? error.message : 'Founder admin bootstrap failed');
    });

    const unsubscribe = athleticMindHubService.subscribeMembership(author.uid, (next) => {
      window.clearTimeout(timeout);
      setMember(next);
      setMembershipLoading(false);
    }, onError);

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [author]);

  useEffect(() => {
    if (!author || !inviteToken) return;
    if (redeemedInviteRef.current === inviteToken) return;

    redeemedInviteRef.current = inviteToken;
    setMembershipLoading(true);
    athleticMindHubService.redeemInvite(inviteToken, author)
      .then(() => {
        setToast('Hub invite accepted');
        router.replace('/athletic-mind-hub', undefined, { shallow: true });
      })
      .catch((error) => {
        console.warn('[AthleticMindHub] Invite redemption failed', error);
        redeemedInviteRef.current = '';
        setToast(error instanceof Error ? error.message : 'Invite redemption failed');
      })
      .finally(() => {
        setMembershipLoading(false);
      });
  }, [author, inviteToken, router]);

  async function handleSignOut() {
    await signOut(auth);
    setMember(null);
    setMembershipLoading(false);
    setToast('Signed out');
  }

  useEffect(() => {
    if (!author || !canReadHub) return undefined;
    const onError = (error: Error) => {
      console.error('[AthleticMindHub] Firestore sync error', error);
      setToast('Firebase sync needs permission or connection');
      setLoading(false);
    };

    const unsubscribers = [
      athleticMindHubService.subscribeUpdates(setUpdates, onError),
      athleticMindHubService.subscribeWiki(setWikiBlocks, onError),
      athleticMindHubService.subscribeChanges(setChanges, onError),
    ];

    setLoading(false);

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [author, canReadHub]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredWikiBlocks = useMemo(() => {
    const term = wikiSearchTerm.trim().toLowerCase();
    if (!term) return wikiBlocks;

    return wikiBlocks.filter((block) =>
      [block.title, block.section, block.type, block.content, block.link, block.updatedByName, block.updatedByEmail]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [wikiBlocks, wikiSearchTerm]);

  const wikiSections = useMemo(() => {
    const sectionMap = new Map<string, WikiBlockRecord[]>();

    filteredWikiBlocks.forEach((block) => {
      const sectionTitle = block.section?.trim() || 'Council Notes';
      sectionMap.set(sectionTitle, [...(sectionMap.get(sectionTitle) || []), block]);
    });

    return Array.from(sectionMap.entries()).map(([title, blocks]) => ({ title, blocks }));
  }, [filteredWikiBlocks]);

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

  function requireAuthor() {
    if (!author) {
      setToast('Sign in to update the hub');
      return null;
    }
    return author;
  }

  function openWikiEditor(section = 'Council Notes') {
    if (!canEditWiki) {
      setToast('You need wiki editing permission');
      return;
    }

    setEditingWikiId(null);
    setWikiDraft({
      ...emptyWikiBlock,
      section,
    });
    setWikiEditorOpen(true);
  }

  function openSectionEditor() {
    if (!canEditWiki) {
      setToast('You need wiki editing permission');
      return;
    }

    setEditingWikiId(null);
    setWikiDraft({
      ...emptyWikiBlock,
      section: '',
      type: 'Section',
    });
    setWikiEditorOpen(true);
  }

  function closeWikiEditor() {
    setEditingWikiId(null);
    setWikiDraft(emptyWikiBlock);
    setWikiEditorOpen(false);
  }

  async function handleWikiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeAuthor = requireAuthor();
    if (!activeAuthor) return;
    if (!canEditWiki) {
      setToast('You need wiki editing permission');
      return;
    }
    const trimmedTitle = wikiDraft.title.trim();
    const trimmedContent = wikiDraft.content.trim();
    const trimmedSection = wikiDraft.section.trim() || (wikiDraft.type === 'Section' ? trimmedTitle : 'Council Notes');

    if (!trimmedTitle || !trimmedContent) {
      setToast('Add a wiki title and content');
      return;
    }

    const payload = {
      ...wikiDraft,
      title: trimmedTitle,
      section: trimmedSection,
      content: trimmedContent,
      link: wikiDraft.link.trim(),
    };

    setSaving(true);
    try {
      if (editingWikiId) {
        await athleticMindHubService.updateWikiBlock(editingWikiId, payload, activeAuthor);
        setToast('Wiki block updated');
      } else {
        await athleticMindHubService.addWikiBlock(payload, activeAuthor);
        setToast('Wiki block added');
      }
      setWikiDraft(emptyWikiBlock);
      setEditingWikiId(null);
      setWikiEditorOpen(false);
    } catch (error) {
      console.error('[AthleticMindHub] Wiki save failed', error);
      setToast('Wiki save failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeUpdate(update: CouncilUpdateRecord) {
    const activeAuthor = requireAuthor();
    if (!activeAuthor) return;
    if (!isAdmin) {
      setToast('Only admins can remove hub updates');
      return;
    }
    await athleticMindHubService.deleteUpdate(update, activeAuthor);
    setToast('Update removed');
  }

  async function removeWikiBlock(block: WikiBlockRecord) {
    const activeAuthor = requireAuthor();
    if (!activeAuthor) return;
    if (!canEditWiki) {
      setToast('You need wiki editing permission');
      return;
    }
    await athleticMindHubService.deleteWikiBlock(block, activeAuthor);
    setToast('Wiki block removed');
  }

  function editWikiBlock(block: WikiBlockRecord) {
    if (!canEditWiki) {
      setToast('You need wiki editing permission');
      return;
    }
    setEditingWikiId(block.id);
    setWikiDraft({
      title: block.title,
      section: block.section,
      type: block.type,
      content: block.content,
      link: block.link || '',
    });
    setWikiEditorOpen(true);
  }

  return (
    <>
      <PageHead
        pageOgUrl="https://fitwithpulse.ai/athletic-mind-hub"
        pageOgImage="/athletic-mind-hub/council-workspace.png"
        themeColor="#294036"
        metaData={{
          pageId: 'athletic-mind-hub',
          pageTitle: 'Athletic Mind Hub | Pulse',
          metaDescription: 'A council workspace for Athletic Mind updates, wiki notes, contacts, and communications.',
          ogTitle: 'Athletic Mind Hub',
          ogDescription: 'A shared Athletic Mind Council workspace powered by Firebase.',
          ogImage: '/athletic-mind-hub/council-workspace.png',
          lastUpdated: new Date().toISOString(),
        }}
      />

      <main className="hubShell">
        <section className="hero">
          <div className="heroBackdrop" />
          <nav className="topbar" aria-label="Athletic Mind Hub">
            <div className="brandMark">
              <BrainMark />
              <span>Athletic Mind Council</span>
            </div>
            <div className="topbarActions">
              <div className="hubNavLinks" aria-label="Hub navigation">
                <a href="/athletic-mind-hub">Wiki</a>
                {isAdmin && (
                  <>
                    <a href="/athletic-mind-hub/contacts">Contacts</a>
                    <a href="/athletic-mind-hub/permissions">Permissions</a>
                  </>
                )}
              </div>
              <span className="accountPill">{accessLabel}</span>
              {author ? (
                <div className="signedInPill" title={`Signed in as ${signedInLabel}`}>
                  <span>
                    Signed in as <strong>{signedInLabel}</strong>
                  </span>
                  <button type="button" onClick={handleSignOut} aria-label="Sign out of Athletic Mind Hub">
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <span className="signedInPill muted">Signed out</span>
              )}
            </div>
          </nav>

          <div className="heroContent">
            <div className="heroCopy">
              <p className="eyebrow">Firebase council workspace</p>
              <h1>Athletic Mind Hub</h1>
              <p className="heroText">
                Shared updates, role-based access, and a living council wiki where each change carries the author
                with it.
              </p>
              <div className="heroActions">
                <a className="primaryAction" href="#athletic-mind-wiki">
                  <BookOpenText size={18} />
                  Open Wiki
                </a>
                {isAdmin && (
                  <>
                    <a className="secondaryAction" href="/athletic-mind-hub/contacts">
                      <Users size={18} />
                      Contacts
                    </a>
                    <a className="secondaryAction" href="/athletic-mind-hub/permissions">
                      <ShieldCheck size={18} />
                      Permissions
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="metricStrip" aria-label="Hub summary">
              <div>
                <strong>{accessLabel}</strong>
                <span>Your access</span>
              </div>
              <div>
                <strong>{updates.length}</strong>
                <span>Saved updates</span>
              </div>
              <div>
                <strong>{wikiBlocks.length}</strong>
                <span>Wiki entries</span>
              </div>
            </div>
          </div>
        </section>

        {membershipLoading && !canReadHub ? (
          <section className="accessState" aria-label="Loading hub access">
            <Loader2 className="spin" size={26} />
            <h2>Checking hub access</h2>
            <p>We are confirming your Athletic Mind Hub permission.</p>
          </section>
        ) : !canReadHub ? (
          <section className="accessState" aria-label="Hub access required">
            <ShieldCheck size={28} />
            <h2>Hub access required</h2>
            <p>
              Ask an Athletic Mind Hub admin to send you an invite link. If you already have one, open the link
              while signed in with this account.
            </p>
          </section>
        ) : (
          <>
        <section className="workspace" aria-label="Council workspace">
          <div className="updatesColumn">
            <div className="timeline">
              <div className="timelineHeader">
                <h3>Update History</h3>
                <Bell size={18} />
              </div>

              {updates.length ? (
                updates.map((update) => (
                  <article className="updateCard" key={update.id}>
                    <div className="updateMeta">
                      <span>{update.audience}</span>
                      <span className={`priority ${update.priority.toLowerCase()}`}>{update.priority}</span>
                    </div>
                    <h4>{update.title}</h4>
                    <p>{update.message}</p>
                    <div className="authorChip">Updated by {authorLabel(update)} · {formatDate(update.updatedAt || update.createdAt)}</div>
                    <div className="updateFooter">
                      <span><CalendarDays size={15} />{formatDate(update.createdAt)}</span>
                      <div className="rowActions">
                        <button type="button" onClick={() => copyText(buildUpdateCopy(update), 'Update copied')} aria-label={`Copy ${update.title}`} title="Copy update"><Clipboard size={16} /></button>
                        {isAdmin && <button type="button" onClick={() => removeUpdate(update)} aria-label={`Remove ${update.title}`} title="Remove update"><Trash2 size={16} /></button>}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="emptyState">
                  {loading ? <Loader2 className="spin" size={24} /> : <Megaphone size={24} />}
                  <h3>{loading ? 'Loading Firebase updates' : 'No updates saved yet'}</h3>
                  <p>Saved council updates will appear here for signed-in members.</p>
                </div>
              )}
            </div>
          </div>

        </section>

        <section className="wikiWorkspace" id="athletic-mind-wiki" aria-label="Athletic Mind wiki">
          <div className="wikiChrome">
            <div className="wikiLogo">
              <BookOpenText size={26} />
              <div>
                <strong>Athletic Mind Wiki</strong>
                <span>Council knowledge base</span>
              </div>
            </div>
            <div className="wikiSearchBar">
              <Search size={19} />
              <input value={wikiSearchTerm} onChange={(event) => setWikiSearchTerm(event.target.value)} placeholder="Search the wiki" aria-label="Search wiki" />
            </div>
            {canEditWiki && (
              <button className="wikiTextButton" type="button" onClick={openSectionEditor}>
                <Plus size={16} />
                Add section
              </button>
            )}
          </div>

          <div className="wikiArticleGrid">
            <aside className="wikiContents" aria-label="Wiki contents">
              <div className="wikiRailHeader">
                <strong>Contents</strong>
              </div>
              <a href="#athletic-mind-wiki">(Top)</a>
              {wikiSections.map((section) => (
                <a key={section.title} href={`#${sectionAnchor(section.title)}`}>{section.title}</a>
              ))}
            </aside>

            <article className="wikiArticle">
              <header className="wikiArticleHeader">
                <div>
                  <h2>Athletic Mind Council</h2>
                  <div className="wikiArticleTabs">
                    <span>Article</span>
                    <span>{canEditWiki ? 'Editable' : 'Read'}</span>
                    <span>{wikiBlocks.length} entries</span>
                  </div>
                </div>
                {canEditWiki && (
                  <button className="wikiTextButton" type="button" onClick={() => openWikiEditor('Overview')}>
                    <Plus size={16} />
                    Add
                  </button>
                )}
              </header>

              {wikiEditorOpen && canEditWiki && (
                <form className="wikiInlineEditor" onSubmit={handleWikiSubmit}>
                  <div className="formGrid two">
                    <label>
                      Title
                      <input value={wikiDraft.title} onChange={(event) => setWikiDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Heading, resource, thought, or decision" />
                    </label>
                    <label>
                      Section
                      <input value={wikiDraft.section} onChange={(event) => setWikiDraft((draft) => ({ ...draft, section: event.target.value }))} placeholder="Overview, Research, Resources" />
                    </label>
                  </div>

                  <div className="formGrid two">
                    <label>
                      Type
                      <select value={wikiDraft.type} onChange={(event) => setWikiDraft((draft) => ({ ...draft, type: event.target.value as WikiBlockType }))}>
                        <option>Thought</option>
                        <option>Research</option>
                        <option>Link</option>
                        <option>Section</option>
                        <option>Decision</option>
                      </select>
                    </label>
                    <label>
                      Link
                      <input value={wikiDraft.link} onChange={(event) => setWikiDraft((draft) => ({ ...draft, link: event.target.value }))} placeholder="https://..." />
                    </label>
                  </div>

                  <label>
                    Content
                    <textarea value={wikiDraft.content} onChange={(event) => setWikiDraft((draft) => ({ ...draft, content: event.target.value }))} placeholder="Add the council note, research summary, link context, or working thought." rows={6} />
                  </label>

                  <div className="composerActions">
                    <button className="primaryAction" type="submit" disabled={saving}>
                      {editingWikiId ? <Save size={18} /> : <Plus size={18} />}
                      {editingWikiId ? 'Save edit' : 'Publish'}
                    </button>
                    <button className="secondaryAction" type="button" onClick={closeWikiEditor}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {wikiSections.length ? (
                wikiSections.map((section) => (
                  <section className="wikiArticleSection" id={sectionAnchor(section.title)} key={section.title}>
                    <div className="wikiSectionTitle">
                      <h3>{section.title}</h3>
                      {canEditWiki && (
                        <button className="wikiTextButton" type="button" onClick={() => openWikiEditor(section.title)}>
                          <Plus size={15} />
                          Add
                        </button>
                      )}
                    </div>

                    {section.blocks.map((block) => (
                      <div className="wikiArticleEntry" key={block.id}>
                        <div className="wikiEntryHeader">
                          <div>
                            <span>{block.type}</span>
                            <h4>{block.title}</h4>
                          </div>
                          {canEditWiki && (
                            <div className="rowActions">
                              <button type="button" onClick={() => editWikiBlock(block)} aria-label={`Edit ${block.title}`} title="Edit"><Edit3 size={16} /></button>
                              <button type="button" onClick={() => removeWikiBlock(block)} aria-label={`Remove ${block.title}`} title="Remove"><Trash2 size={16} /></button>
                            </div>
                          )}
                        </div>
                        <p className="wikiContent">{block.content}</p>
                        {block.link && (
                          <a className="resourceLink" href={block.link} target="_blank" rel="noreferrer">
                            <LinkIcon size={15} />
                            {block.link}
                          </a>
                        )}
                        <div className="wikiByline">Updated by {authorLabel(block)} · {formatDate(block.updatedAt || block.createdAt)}</div>
                      </div>
                    ))}
                  </section>
                ))
              ) : (
                <div className="wikiEmptyArticle">
                  <BookOpenText size={24} />
                  <h3>{wikiBlocks.length ? 'No matching wiki entries' : 'The wiki is ready'}</h3>
                  <p>{wikiBlocks.length ? 'Try another search term.' : 'Add the first section, thought, link, or research note.'}</p>
                  {canEditWiki && (
                    <button className="wikiTextButton" type="button" onClick={openSectionEditor}>
                      <Plus size={16} />
                      Add section
                    </button>
                  )}
                </div>
              )}
            </article>

            <aside className="wikiAppearance" aria-label="Recent wiki changes">
              <div className="timelineHeader">
                <h3>Recent Changes</h3>
                <Bell size={18} />
              </div>
              {changes.length ? (
                changes.map((change) => (
                  <div className="changeRow" key={change.id}>
                    <span>{change.action}</span>
                    <strong>{change.targetTitle}</strong>
                    <small>{change.authorName || change.authorEmail || 'Council member'} · {formatDate(change.createdAt)}</small>
                  </div>
                ))
              ) : (
                <p className="softText">Changes will appear here as the council updates the hub.</p>
              )}
            </aside>
          </div>
        </section>

          </>
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

        .hubShell {
          min-height: 100vh;
          background: linear-gradient(180deg, rgba(244, 241, 234, 0) 0%, #f4f1ea 35rem), #f4f1ea;
          color: #16251f;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .hero {
          position: relative;
          min-height: 620px;
          overflow: hidden;
          color: #f9f7ef;
        }

        .heroBackdrop {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(13, 27, 22, 0.92) 0%, rgba(13, 27, 22, 0.74) 42%, rgba(13, 27, 22, 0.16) 100%),
            linear-gradient(180deg, rgba(13, 27, 22, 0.16) 0%, rgba(13, 27, 22, 0.68) 100%),
            url('/athletic-mind-hub/council-workspace.png') center / cover no-repeat;
          transform: scale(1.01);
        }

        .topbar,
        .heroContent,
        .workspace,
        .wikiWorkspace,
        .adminWorkspace,
        .accessState {
          position: relative;
          z-index: 1;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 0;
        }

        .brandMark,
        .topbarActions,
        .heroActions,
        .composerActions,
        .rowActions,
        .contactTools,
        .updateFooter span,
        .wikiBlockTop,
        .resourceLink {
          display: flex;
          align-items: center;
        }

        .brandMark {
          gap: 12px;
          font-size: 0.95rem;
          font-weight: 800;
          color: #fff8e6;
        }

        .brainMark {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #e7b953;
          color: #16251f;
        }

        .topbarActions,
        .heroActions,
        .composerActions,
        .rowActions,
        .contactTools,
        .resourceLink {
          gap: 10px;
        }

        .topbarActions {
          justify-content: flex-end;
          flex-wrap: wrap;
          min-width: 0;
        }

        .hubNavLinks {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          background: rgba(11, 20, 17, 0.38);
          padding: 5px;
        }

        .hubNavLinks a {
          border-radius: 999px;
          color: rgba(255, 248, 230, 0.84);
          font-size: 0.78rem;
          font-weight: 900;
          padding: 7px 10px;
          text-decoration: none;
        }

        .hubNavLinks a:hover {
          background: rgba(255, 255, 255, 0.13);
          color: #fff8e6;
        }

        .accountPill,
        .signedInPill,
        .authorChip,
        .typePill {
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 850;
        }

        .accountPill {
          flex: 0 1 auto;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.13);
          padding: 10px 13px;
        }

        .signedInPill {
          display: inline-flex;
          align-items: center;
          flex: 0 1 auto;
          gap: 10px;
          max-width: min(430px, 42vw);
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(11, 20, 17, 0.42);
          padding: 7px 8px 7px 12px;
          color: rgba(255, 248, 230, 0.88);
        }

        .signedInPill > span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .signedInPill strong {
          color: #fff8e6;
          font-weight: 900;
        }

        .signedInPill button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          border: 0;
          border-radius: 999px;
          background: #fff8e6;
          color: #16251f;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 900;
          padding: 0 10px;
          white-space: nowrap;
        }

        .signedInPill.muted {
          padding: 10px 13px;
          color: rgba(255, 248, 230, 0.66);
        }

        .heroContent {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 420px;
          gap: 42px;
          align-items: end;
          min-height: 470px;
          padding: 64px 0 80px;
        }

        .heroCopy {
          max-width: 710px;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #d99c68;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        h4,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 18px;
          font-size: clamp(3rem, 7vw, 6.7rem);
          line-height: 0.94;
          letter-spacing: 0;
        }

        .heroText {
          max-width: 650px;
          margin-bottom: 30px;
          color: rgba(249, 247, 239, 0.88);
          font-size: clamp(1.05rem, 2vw, 1.28rem);
          line-height: 1.58;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        button {
          font: inherit;
        }

        button:disabled {
          cursor: progress;
          opacity: 0.68;
        }

        .primaryAction,
        .secondaryAction,
        .iconButton {
          border: 0;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .primaryAction,
        .secondaryAction {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 46px;
          border-radius: 8px;
          padding: 0 18px;
          font-weight: 800;
          text-decoration: none;
        }

        .primaryAction {
          background: #e7b953;
          color: #14241e;
          box-shadow: 0 18px 44px rgba(8, 22, 17, 0.24);
        }

        .primaryAction.disabled {
          pointer-events: none;
          opacity: 0.58;
        }

        .secondaryAction {
          background: rgba(255, 255, 255, 0.13);
          color: inherit;
          border: 1px solid rgba(255, 255, 255, 0.25);
        }

        .panel .secondaryAction,
        .workspace .secondaryAction,
        .wikiWorkspace .secondaryAction {
          background: #fffdf8;
          color: #294036;
          border: 1px solid #ddd6c8;
        }

        .primaryAction:hover,
        .secondaryAction:hover,
        .iconButton:hover,
        .rowActions button:hover {
          transform: translateY(-1px);
        }

        .iconButton,
        .rowActions button {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          background: rgba(255, 255, 255, 0.13);
          color: inherit;
        }

        .workspace .iconButton,
        .wikiWorkspace .iconButton,
        .rowActions button {
          border-color: #ddd6c8;
          background: #fffdf8;
          color: #294036;
        }

        .metricStrip {
          display: grid;
          gap: 12px;
          align-self: end;
        }

        .metricStrip div {
          display: grid;
          gap: 3px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 8px;
          padding: 18px;
          background: rgba(13, 27, 22, 0.58);
          backdrop-filter: blur(16px);
        }

        .metricStrip strong {
          color: #ffffff;
          font-size: 2rem;
          line-height: 1;
        }

        .metricStrip span {
          color: rgba(249, 247, 239, 0.75);
          font-size: 0.9rem;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 24px;
          align-items: start;
          padding: 34px 0 48px;
        }

        .wikiWorkspace,
        .adminWorkspace {
          padding: 16px 0 76px;
        }

        .adminWorkspace {
          padding-top: 0;
        }

        .accessState {
          display: grid;
          place-items: center;
          gap: 10px;
          min-height: 320px;
          padding: 42px 0 76px;
          text-align: center;
          color: #4a8d75;
        }

        .accessState h2 {
          margin: 0;
          color: #16251f;
          font-size: clamp(1.8rem, 4vw, 2.7rem);
        }

        .accessState p {
          max-width: 580px;
          color: #5f6d66;
          line-height: 1.6;
        }

        .updatesColumn,
        .timeline,
        .contactList {
          display: grid;
          gap: 16px;
        }

        .sectionHeader,
        .timelineHeader,
        .wikiHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .sectionHeader h2,
        .wikiHeader h2 {
          margin: 0;
          color: #16251f;
          font-size: clamp(1.8rem, 4vw, 2.7rem);
          line-height: 1;
        }

        .timelineHeader h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .panel,
        .updateCard,
        .contactCard,
        .wikiBlock,
        .emptyState {
          border: 1px solid #ded6c7;
          border-radius: 8px;
          background: rgba(255, 253, 248, 0.94);
          box-shadow: 0 18px 54px rgba(29, 41, 36, 0.08);
        }

        .panel,
        .updateCard,
        .contactCard,
        .wikiBlock {
          display: grid;
          gap: 14px;
          padding: 18px;
        }

        .formGrid,
        .wikiGrid,
        .adminGrid {
          display: grid;
          gap: 14px;
        }

        .formGrid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .wikiGrid,
        .adminGrid {
          grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
          align-items: start;
          margin-top: 18px;
        }

        .adminGrid {
          margin-bottom: 18px;
        }

        .wikiChrome {
          display: grid;
          grid-template-columns: minmax(230px, auto) minmax(260px, 1fr) auto;
          gap: 14px;
          align-items: center;
          border-bottom: 1px solid #cfd6dc;
          padding: 10px 0 16px;
        }

        .wikiLogo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .wikiLogo strong {
          display: block;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1.45rem;
          letter-spacing: 0;
        }

        .wikiLogo span {
          display: block;
          color: #63736b;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .wikiSearchBar {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #a7b0b7;
          background: #fff;
          color: #697780;
          min-height: 42px;
          padding: 0 12px;
        }

        .wikiSearchBar input {
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          padding-left: 0;
        }

        .wikiTextButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 34px;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #3267c8;
          cursor: pointer;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 850;
          padding: 0 8px;
        }

        .wikiTextButton:hover {
          background: #eef3ff;
        }

        .wikiArticleGrid {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr) 250px;
          gap: 32px;
          align-items: start;
          padding-top: 28px;
        }

        .wikiContents,
        .wikiAppearance {
          position: sticky;
          top: 16px;
          display: grid;
          gap: 10px;
          color: #202122;
          font-size: 0.92rem;
        }

        .wikiRailHeader,
        .wikiAppearance .timelineHeader {
          border-bottom: 1px solid #d8dde3;
          padding-bottom: 8px;
        }

        .wikiContents a {
          color: #3267c8;
          line-height: 1.25;
          text-decoration: none;
        }

        .wikiContents a:hover,
        .resourceLink:hover {
          text-decoration: underline;
        }

        .wikiArticle {
          min-width: 0;
          color: #202122;
          font-family: Georgia, "Times New Roman", serif;
        }

        .wikiArticleHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #a2a9b1;
          padding-bottom: 0;
        }

        .wikiArticleHeader h2 {
          margin: 0;
          color: #202122;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          font-weight: 500;
          line-height: 1.08;
        }

        .wikiArticleTabs {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 12px;
          color: #3267c8;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 0.9rem;
          font-weight: 800;
        }

        .wikiArticleTabs span:first-child {
          border-bottom: 3px solid #202122;
          color: #202122;
          padding-bottom: 9px;
        }

        .wikiInlineEditor {
          display: grid;
          gap: 14px;
          border: 1px solid #a2a9b1;
          background: #fff;
          box-shadow: 0 10px 30px rgba(32, 33, 34, 0.08);
          margin: 22px 0;
          padding: 16px;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }

        .wikiArticleSection {
          padding-top: 28px;
        }

        .wikiSectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #a2a9b1;
          margin-bottom: 14px;
        }

        .wikiSectionTitle h3 {
          margin: 0;
          color: #202122;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1.65rem;
          font-weight: 500;
          line-height: 1.25;
        }

        .wikiArticleEntry {
          padding: 12px 0 18px;
        }

        .wikiArticleEntry + .wikiArticleEntry {
          border-top: 1px solid #eaecf0;
        }

        .wikiEntryHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 8px;
        }

        .wikiEntryHeader span {
          color: #6b7279;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .wikiEntryHeader h4 {
          margin: 2px 0 0;
          color: #202122;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 1.02rem;
          line-height: 1.3;
        }

        .wikiArticleEntry .wikiContent {
          margin-bottom: 10px;
          color: #202122;
          font-size: 1.04rem;
          line-height: 1.72;
          white-space: pre-wrap;
        }

        .wikiByline {
          color: #72777d;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 750;
        }

        .wikiEmptyArticle {
          display: grid;
          place-items: center;
          gap: 10px;
          min-height: 260px;
          border: 1px solid #eaecf0;
          margin-top: 28px;
          padding: 30px;
          text-align: center;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }

        label {
          display: grid;
          gap: 7px;
          color: #4a5c54;
          font-size: 0.82rem;
          font-weight: 800;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9d0c2;
          border-radius: 8px;
          background: #fffaf2;
          color: #16251f;
          font: inherit;
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
        select:focus,
        textarea:focus {
          border-color: #4a8d75;
          box-shadow: 0 0 0 4px rgba(74, 141, 117, 0.16);
        }

        .fullWidth {
          width: 100%;
        }

        .updateMeta,
        .updateFooter,
        .wikiBlockTop {
          justify-content: space-between;
          gap: 12px;
        }

        .updateMeta {
          color: #63736b;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .priority,
        .typePill {
          border-radius: 999px;
          padding: 5px 9px;
          background: #e8ede6;
          color: #294036;
        }

        .priority.high {
          background: #f7e2c8;
          color: #8a4d15;
        }

        .priority.urgent {
          background: #f4d5d0;
          color: #903729;
        }

        .updateCard h4,
        .contactCard h3,
        .wikiBlock h3 {
          margin-bottom: 0;
          color: #16251f;
          font-size: 1.08rem;
          line-height: 1.25;
        }

        .updateCard p,
        .contactCard p,
        .emptyState p,
        .wikiBlock p,
        .softText {
          margin-bottom: 0;
          color: #5f6d66;
          line-height: 1.55;
        }

        .wikiContent {
          white-space: pre-wrap;
        }

        .resourceLink {
          color: #245f74;
          font-weight: 850;
          overflow-wrap: anywhere;
          text-decoration: none;
        }

        .authorChip {
          justify-self: start;
          background: #edf0e8;
          color: #4a5c54;
          padding: 6px 10px;
        }

        .updateFooter {
          color: #718077;
          font-size: 0.82rem;
          font-weight: 750;
        }

        .updateFooter span {
          gap: 7px;
        }

        .contactTools,
        .wikiTools {
          align-items: stretch;
        }

        .wikiTools {
          display: flex;
          margin: 18px 0;
        }

        .searchBox {
          display: flex;
          align-items: center;
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

        .copyEmailsAction {
          white-space: nowrap;
        }

        .contactImport {
          position: relative;
          cursor: pointer;
          gap: 8px;
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
          display: inline-flex;
          align-items: center;
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

        .contactDetails {
          display: grid;
          gap: 5px;
          min-width: 0;
          color: #5f6d66;
          font-size: 0.92rem;
        }

        .contactDetails a {
          color: #245f74;
          overflow-wrap: anywhere;
          text-decoration: none;
          font-weight: 800;
        }

        .contactCard .rowActions {
          justify-content: flex-end;
        }

        .changePanel {
          position: sticky;
          top: 18px;
        }

        .changeRow {
          display: grid;
          gap: 4px;
          border-top: 1px solid #ebe4d6;
          padding-top: 12px;
        }

        .changeRow span {
          color: #9b6a38;
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .changeRow small {
          color: #718077;
          font-weight: 750;
        }

        .roleNotice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #4a8d75;
        }

        .roleNotice h3 {
          margin-bottom: 4px;
          color: #16251f;
        }

        .roleNotice p,
        .invitePanel small,
        .permissionRow small {
          color: #5f6d66;
          line-height: 1.45;
        }

        .inviteLinkBox {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 42px;
          gap: 8px;
          align-items: center;
          border: 1px solid #ddd6c8;
          border-radius: 8px;
          background: #fffaf2;
          padding: 8px;
        }

        .inviteLinkBox span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #4a5c54;
          font-size: 0.86rem;
          font-weight: 750;
        }

        .inviteLinkBox button,
        .dangerButton {
          border: 0;
          border-radius: 8px;
          cursor: pointer;
          font: inherit;
          font-weight: 850;
        }

        .inviteLinkBox button {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          background: #edf0e8;
          color: #294036;
        }

        .membersPanel {
          margin-top: 18px;
        }

        .permissionRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          border-top: 1px solid #ebe4d6;
          padding-top: 14px;
        }

        .permissionRow div:first-child {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .permissionRow strong,
        .permissionRow small {
          overflow-wrap: anywhere;
        }

        .memberRow {
          grid-template-columns: minmax(0, 1fr) minmax(220px, 280px) auto;
        }

        .dangerButton {
          min-height: 42px;
          padding: 0 14px;
          background: #f4d5d0;
          color: #903729;
        }

        .dangerButton:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .emptyState {
          display: grid;
          place-items: center;
          gap: 9px;
          min-height: 210px;
          padding: 30px;
          text-align: center;
          color: #4a8d75;
        }

        .emptyState h3 {
          margin-bottom: 0;
          color: #16251f;
        }

        .emptyState.compact {
          min-height: 180px;
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

        @media (max-width: 920px) {
          .hero {
            min-height: auto;
          }

          .heroBackdrop {
            background:
              linear-gradient(180deg, rgba(13, 27, 22, 0.94) 0%, rgba(13, 27, 22, 0.72) 54%, rgba(13, 27, 22, 0.42) 100%),
              url('/athletic-mind-hub/council-workspace.png') center / cover no-repeat;
          }

          .heroContent,
          .workspace,
          .wikiArticleGrid,
          .wikiGrid,
          .adminGrid {
            grid-template-columns: 1fr;
          }

          .wikiContents,
          .wikiAppearance {
            position: relative;
            top: auto;
          }

          .wikiContents {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 14px;
            border-bottom: 1px solid #d8dde3;
            padding-bottom: 14px;
          }

          .wikiRailHeader {
            width: 100%;
          }

          .wikiChrome {
            grid-template-columns: 1fr;
          }

          .heroContent {
            min-height: auto;
            padding: 58px 0 46px;
          }

          .metricStrip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .workspace {
            padding-top: 24px;
          }

          .changePanel {
            position: relative;
            top: auto;
          }
        }

        @media (max-width: 640px) {
          .topbar,
          .heroContent,
          .workspace,
          .wikiWorkspace,
          .adminWorkspace,
          .accessState {
            width: min(100% - 28px, 1180px);
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
            padding-top: 18px;
          }

          .topbarActions {
            width: 100%;
            flex-wrap: wrap;
            justify-content: flex-start;
            gap: 8px;
          }

          .accountPill {
            flex: 1 1 auto;
            max-width: none;
            min-width: 132px;
            text-align: center;
          }

          .signedInPill {
            width: 100%;
            max-width: none;
            box-sizing: border-box;
            justify-content: space-between;
            padding: 8px 8px 8px 12px;
          }

          .signedInPill > span {
            flex: 1 1 auto;
          }

          .signedInPill button {
            flex: 0 0 auto;
          }

          .heroActions,
          .composerActions,
          .formGrid.two {
            grid-template-columns: 1fr;
          }

          .heroActions,
          .composerActions {
            display: grid;
          }

          .heroContent {
            padding: 42px 0 30px;
          }

          .metricStrip {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .metricStrip div {
            padding: 12px 10px;
          }

          .metricStrip strong {
            font-size: 1.45rem;
          }

          .metricStrip span {
            font-size: 0.78rem;
          }

          .contactTools {
            display: grid;
            grid-template-columns: 1fr;
          }

          .updateMeta,
          .updateFooter,
          .wikiBlockTop,
          .permissionRow,
          .memberRow {
            display: grid;
            grid-template-columns: 1fr;
            align-items: flex-start;
          }

          .rowActions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
};

const BrainMark = () => (
  <span className="brainMark" aria-hidden="true">
    <Users size={19} strokeWidth={2.4} />
  </span>
);

export default AthleticMindHub;
