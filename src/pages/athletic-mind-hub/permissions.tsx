import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { onAuthStateChanged, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Clipboard,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import PageHead from '../../components/PageHead';
import { useUser } from '../../hooks/useUser';
import { auth } from '../../api/firebase/config';
import {
  athleticMindHubService,
  ATHLETIC_MIND_HUB_FOUNDER_EMAIL,
  type HubAuthor,
  type HubInviteRecord,
  type HubMemberRecord,
  type HubPermission,
} from '../../api/firebase/athleticMindHub/service';

const permissionLabels: Record<HubPermission, string> = {
  readOnly: 'Read only',
  wikiEditor: 'Read + update wiki',
  admin: 'Admin',
};

const permissionDescriptions: Record<HubPermission, string> = {
  readOnly: 'Can read updates and wiki content.',
  wikiEditor: 'Can read the hub and add or edit wiki blocks.',
  admin: 'Can manage permissions, contacts, updates, invites, and wiki content.',
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

const AthleticMindHubPermissions: NextPage = () => {
  const currentUser = useUser();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [member, setMember] = useState<HubMemberRecord | null>(null);
  const [members, setMembers] = useState<HubMemberRecord[]>([]);
  const [invites, setInvites] = useState<HubInviteRecord[]>([]);
  const [invitePermission, setInvitePermission] = useState<HubPermission>('readOnly');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [toast, setToast] = useState('');
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setPermissionsLoading(false);
      return undefined;
    }

    setMembershipLoading(true);
    athleticMindHubService.ensureFounderAdminMembership(author).catch((error) => {
      console.error('[AthleticMindHubPermissions] Founder admin sync failed', error);
    });

    return athleticMindHubService.subscribeMembership(
      author.uid,
      (nextMember) => {
        setMember(nextMember);
        setMembershipLoading(false);
      },
      (error) => {
        console.error('[AthleticMindHubPermissions] Membership subscription failed', error);
        setMembershipLoading(false);
      },
    );
  }, [author]);

  useEffect(() => {
    if (!author) return undefined;
    if (!isAdmin) {
      setMembers([]);
      setInvites([]);
      setPermissionsLoading(false);
      return undefined;
    }

    setPermissionsLoading(true);
    const unsubscribers = [
      athleticMindHubService.subscribeMembers(setMembers, (error) => {
        console.error('[AthleticMindHubPermissions] Members subscription failed', error);
        setToast('Members failed to load');
      }),
      athleticMindHubService.subscribeInvites(setInvites, (error) => {
        console.error('[AthleticMindHubPermissions] Invites subscription failed', error);
        setToast('Invites failed to load');
      }),
    ];
    setPermissionsLoading(false);

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [author, isAdmin]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function requireAdmin() {
    if (!author) {
      setToast('Sign in to manage permissions');
      return null;
    }
    if (!isAdmin) {
      setToast('Only admins can manage permissions');
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

  async function generateInviteLink() {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;

    setSaving(true);
    try {
      const token = await athleticMindHubService.createInvite(invitePermission, activeAuthor);
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
      const link = `${origin}/athletic-mind-hub?invite=${encodeURIComponent(token)}&signin=1`;
      setLastInviteLink(link);
      await copyText(link, 'Invite link generated and copied');
    } catch (error) {
      console.error('[AthleticMindHubPermissions] Invite generation failed', error);
      setToast('Invite generation failed');
    } finally {
      setSaving(false);
    }
  }

  async function changeMemberPermission(memberRecord: HubMemberRecord, permissionValue: HubPermission) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;

    try {
      await athleticMindHubService.updateMemberPermission(memberRecord, permissionValue, activeAuthor);
      setToast('Permission updated');
    } catch (error) {
      console.error('[AthleticMindHubPermissions] Permission update failed', error);
      setToast('Permission update failed');
    }
  }

  async function removeMemberAccess(memberRecord: HubMemberRecord) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;
    if (memberRecord.email.toLowerCase() === ATHLETIC_MIND_HUB_FOUNDER_EMAIL) {
      setToast('Founder admin access cannot be removed here');
      return;
    }

    await athleticMindHubService.deleteMember(memberRecord, activeAuthor);
    setToast('Member access removed');
  }

  async function setInviteStatus(invite: HubInviteRecord, status: HubInviteRecord['status']) {
    const activeAuthor = requireAdmin();
    if (!activeAuthor) return;

    await athleticMindHubService.updateInviteStatus(invite, status, activeAuthor);
    setToast(`Invite ${status}`);
  }

  return (
    <>
      <PageHead
        pageOgUrl="https://fitwithpulse.ai/athletic-mind-hub/permissions"
        pageOgImage="/athletic-mind-hub/council-workspace.png"
        themeColor="#294036"
        metaData={{
          pageId: 'athletic-mind-hub-permissions',
          pageTitle: 'Athletic Mind Permissions | Pulse',
          metaDescription: 'Admin permissions for the Athletic Mind Hub.',
          ogTitle: 'Athletic Mind Permissions',
          ogDescription: 'Manage invites and permissions for the Athletic Mind Hub.',
          ogImage: '/athletic-mind-hub/council-workspace.png',
          lastUpdated: new Date().toISOString(),
        }}
      />

      <main className="permissionsShell">
        <nav className="topbar" aria-label="Athletic Mind permissions navigation">
          <div className="navLinks">
            <a className="backLink" href="/athletic-mind-hub">
              <ArrowLeft size={18} />
              Hub
            </a>
            <a href="/athletic-mind-hub/contacts">Contacts</a>
          </div>
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
              <a className="pillButton" href="/athletic-mind-hub/permissions?signin=1">Sign in</a>
            </div>
          )}
        </nav>

        <header className="pageHeader">
          <div>
            <p className="eyebrow">Admin controls</p>
            <h1>Permissions</h1>
            <p>Invite council members and update access for the hub.</p>
          </div>
          <ShieldCheck size={42} />
        </header>

        {membershipLoading || permissionsLoading ? (
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
                ? 'Only Athletic Mind Hub admins can manage invites and member permissions. Ask an admin to update this account permission.'
                : 'Sign in with an admin account to manage invites and member permissions.'}
            </p>
          </section>
        ) : (
          <>
            <section className="adminGrid">
              <div className="panel">
                <div className="panelHeader">
                  <h2>Invite Members</h2>
                  <UserPlus size={18} />
                </div>
                <label>
                  Default permission
                  <select value={invitePermission} onChange={(event) => setInvitePermission(event.target.value as HubPermission)}>
                    <option value="readOnly">{permissionLabels.readOnly}</option>
                    <option value="wikiEditor">{permissionLabels.wikiEditor}</option>
                    <option value="admin">{permissionLabels.admin}</option>
                  </select>
                  <small>{permissionDescriptions[invitePermission]}</small>
                </label>
                <button className="primaryAction fullWidth" type="button" onClick={generateInviteLink} disabled={saving}>
                  {saving ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
                  Generate Share Link
                </button>
                {lastInviteLink && (
                  <div className="inviteLinkBox">
                    <span>{lastInviteLink}</span>
                    <button type="button" onClick={() => copyText(lastInviteLink, 'Invite link copied')} aria-label="Copy latest invite link">
                      <Clipboard size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelHeader">
                  <h2>Active Invite Links</h2>
                  <KeyRound size={18} />
                </div>
                {invites.length ? (
                  invites.map((invite) => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
                    const inviteLink = `${origin}/athletic-mind-hub?invite=${encodeURIComponent(invite.id)}&signin=1`;
                    return (
                      <article className="permissionRow" key={invite.id}>
                        <div>
                          <strong>{permissionLabels[invite.permission]}</strong>
                          <small>{invite.status} · Created by {invite.createdByName || invite.createdByEmail || 'admin'}</small>
                        </div>
                        <div className="rowActions">
                          <button type="button" onClick={() => copyText(inviteLink, 'Invite link copied')} aria-label="Copy invite link" title="Copy invite link"><Clipboard size={16} /></button>
                          <button type="button" onClick={() => setInviteStatus(invite, invite.status === 'active' ? 'disabled' : 'active')} aria-label={`${invite.status === 'active' ? 'Disable' : 'Enable'} invite`} title={invite.status === 'active' ? 'Disable invite' : 'Enable invite'}>
                            <ShieldCheck size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="softText">Generated invite links will appear here.</p>
                )}
              </div>
            </section>

            <section className="panel membersPanel">
              <div className="panelHeader">
                <h2>Hub Members</h2>
                <Users size={18} />
              </div>
              {members.length ? (
                members.map((hubMember) => (
                  <article className="permissionRow memberRow" key={hubMember.id}>
                    <div>
                      <strong>{hubMember.displayName || hubMember.email}</strong>
                      <small>{hubMember.email} · Joined {formatDate(hubMember.createdAt)}</small>
                    </div>
                    <label>
                      Permission
                      <select
                        value={hubMember.permission}
                        onChange={(event) => changeMemberPermission(hubMember, event.target.value as HubPermission)}
                        disabled={hubMember.email.toLowerCase() === ATHLETIC_MIND_HUB_FOUNDER_EMAIL}
                      >
                        <option value="readOnly">{permissionLabels.readOnly}</option>
                        <option value="wikiEditor">{permissionLabels.wikiEditor}</option>
                        <option value="admin">{permissionLabels.admin}</option>
                      </select>
                    </label>
                    <button
                      className="dangerButton"
                      type="button"
                      onClick={() => removeMemberAccess(hubMember)}
                      disabled={hubMember.email.toLowerCase() === ATHLETIC_MIND_HUB_FOUNDER_EMAIL}
                    >
                      Remove
                    </button>
                  </article>
                ))
              ) : (
                <p className="softText">Members will appear here once they join with an invite link.</p>
              )}
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

        .permissionsShell {
          min-height: 100vh;
          color: #16251f;
          background: #f4f1ea;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .topbar,
        .pageHeader,
        .adminGrid,
        .membersPanel,
        .accessState {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .topbar,
        .navLinks,
        .backLink,
        .signedInPill,
        .signedInPill button,
        .pageHeader,
        .panelHeader,
        .primaryAction,
        .rowActions {
          display: flex;
          align-items: center;
        }

        .topbar {
          justify-content: space-between;
          gap: 18px;
          padding: 24px 0 18px;
        }

        .navLinks {
          gap: 14px;
        }

        .navLinks a,
        .backLink {
          color: #294036;
          font-weight: 900;
          text-decoration: none;
        }

        .backLink {
          gap: 8px;
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
          font-size: clamp(3rem, 7vw, 5.5rem);
          line-height: 0.95;
          letter-spacing: 0;
        }

        .pageHeader p,
        .softText {
          margin-bottom: 0;
          color: #5f6d66;
          line-height: 1.55;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.6fr);
          gap: 18px;
          align-items: start;
        }

        .panel {
          display: grid;
          gap: 16px;
          border: 1px solid #ded6c7;
          border-radius: 8px;
          background: #fffdf8;
          box-shadow: 0 18px 54px rgba(29, 41, 36, 0.08);
          padding: 18px;
        }

        .panelHeader {
          justify-content: space-between;
          gap: 18px;
        }

        .panelHeader h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 750;
        }

        label {
          display: grid;
          gap: 8px;
          color: #4a5c54;
          font-size: 0.82rem;
          font-weight: 900;
        }

        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9d0c2;
          border-radius: 8px;
          background: #fffaf2;
          color: #16251f;
          font: inherit;
          font-size: 0.95rem;
          font-weight: 750;
          outline: none;
          padding: 12px 13px;
        }

        label small,
        .permissionRow small {
          color: #5f6d66;
          line-height: 1.45;
        }

        button {
          font: inherit;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .primaryAction {
          justify-content: center;
          gap: 10px;
          min-height: 46px;
          border: 0;
          border-radius: 8px;
          background: #e7b953;
          color: #14241e;
          cursor: pointer;
          font-weight: 900;
          padding: 0 18px;
        }

        .fullWidth {
          width: 100%;
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
        .rowActions button,
        .dangerButton {
          border: 0;
          border-radius: 8px;
          cursor: pointer;
          font: inherit;
          font-weight: 850;
        }

        .inviteLinkBox button,
        .rowActions button {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 1px solid #d8d0c2;
          background: #fffdf8;
          color: #294036;
        }

        .membersPanel {
          margin-top: 18px;
          margin-bottom: 80px;
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

        .accessState {
          display: grid;
          place-items: center;
          gap: 9px;
          min-height: 260px;
          padding: 34px;
          text-align: center;
          color: #4a8d75;
        }

        .accessState h2 {
          margin: 0;
          color: #16251f;
        }

        .accessState p {
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
          .adminGrid,
          .memberRow {
            grid-template-columns: 1fr;
          }

          .pageHeader {
            display: grid;
          }
        }

        @media (max-width: 640px) {
          .topbar,
          .pageHeader,
          .adminGrid,
          .membersPanel,
          .accessState {
            width: min(100% - 28px, 1180px);
          }

          .topbar {
            align-items: flex-start;
          }

          .signedInPill {
            max-width: 62vw;
          }

          .permissionRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};

export default AthleticMindHubPermissions;
