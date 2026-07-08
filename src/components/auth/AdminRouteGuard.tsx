import React, { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';
import { isDevAuthBypassEnabled } from '../../utils/devAuthBypass';
import AdminNavBanner from '../admin/AdminNavBanner';
import SignInModal from '../SignInModal';
import { auth } from '../../api/firebase/config';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  showAdminBanner?: boolean;
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children, showAdminBanner = true }) => {
  const user = useUser();
  const userLoading = useUserLoading();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const renderAdminSurface = (content: React.ReactNode) => (
    <>
      {showAdminBanner ? <AdminNavBanner /> : null}
      {content}
      {!showAdminBanner && isSignInOpen ? (
        <SignInModal
          isVisible={isSignInOpen}
          closable
          onClose={() => setIsSignInOpen(false)}
          onSignInSuccess={() => {
            setIsSignInOpen(false);
            window.setTimeout(() => window.location.reload(), 250);
          }}
          onSignUpSuccess={() => {
            setIsSignInOpen(false);
            window.setTimeout(() => window.location.reload(), 250);
          }}
        />
      ) : null}
    </>
  );
  const loadingSurfaceClassName = showAdminBanner
    ? 'min-h-[55vh] bg-[#111417] px-4 py-10 text-center text-sm text-zinc-400'
    : 'min-h-screen bg-[#FAFAF7] px-4 py-10 text-center text-sm text-stone-500';
  const cardSurfaceClassName = showAdminBanner
    ? 'min-h-[55vh] bg-[#111417] px-4 py-12 text-white'
    : 'min-h-screen bg-[#FAFAF7] px-4 py-12 text-stone-900';
  const neutralCardClassName = showAdminBanner
    ? 'mx-auto max-w-md rounded-xl border border-zinc-800 bg-[#1a1e24] p-6 text-center shadow-xl'
    : 'mx-auto max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm';
  const dangerCardClassName = showAdminBanner
    ? 'mx-auto max-w-md rounded-xl border border-rose-500/25 bg-rose-500/10 p-6 text-center shadow-xl'
    : 'mx-auto max-w-md rounded-lg border border-rose-200 bg-rose-50 p-6 text-center shadow-sm';
  const accountLabel = user?.username ? `@${user.username}` : user?.email || 'Signed in';
  const profileImageUrl = user?.profileImage?.profileImageURL;
  const renderStandaloneAccountBar = () =>
    showAdminBanner ? null : (
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#FAFAF7]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/pulse-logo.svg" alt="Pulse" className="h-8 shrink-0" />
            <span className="hidden text-sm font-medium text-stone-500 sm:inline">Group Meet</span>
          </div>

          {user ? (
            <div className="inline-flex min-w-0 items-center overflow-hidden rounded-full border border-stone-200 bg-white shadow-sm">
              <div className="inline-flex min-w-0 items-center gap-2 px-3 py-2 text-sm text-stone-600">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={accountLabel} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                    {(accountLabel || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-stone-400 sm:inline">Signed in as</span>
                <span className="max-w-[220px] truncate font-semibold text-stone-800">{accountLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="inline-flex h-10 items-center border-l border-stone-200 px-3 text-sm font-semibold text-stone-600 transition hover:bg-stone-50 hover:text-stone-950"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSignInOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
    );

  useEffect(() => {
    const checkAdmin = async () => {
      if (userLoading) {
        return;
      }
      if (!user || !user.email) {
        setIsAdmin(null);
        setLoading(false);
        return;
      }
      try {
        const result = await adminMethods.isAdmin(user.email);
        setIsAdmin(result);
      } catch (_e) {
        setIsAdmin(false);
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user, userLoading]);

  // Local-only escape hatch: when running the dev server with the bypass flag
  // set, render admin content without requiring a signed-in admin. Hard-gated
  // against production builds inside isDevAuthBypassEnabled().
  if (isDevAuthBypassEnabled()) {
    return renderAdminSurface(children);
  }

  if (loading || userLoading) {
    return renderAdminSurface(
      <>
        {renderStandaloneAccountBar()}
        <div className={loadingSurfaceClassName}>
          Checking admin access...
        </div>
      </>
    );
  }

  if (!user) {
    return renderAdminSurface(
      <>
        {renderStandaloneAccountBar()}
        <div className={cardSurfaceClassName}>
          <div className={neutralCardClassName}>
            <div className="text-lg font-semibold">Sign in to continue</div>
            <p className={`mt-2 text-sm ${showAdminBanner ? 'text-zinc-400' : 'text-stone-500'}`}>
              Sign in, then this page will continue after your account is verified.
            </p>
            {!showAdminBanner ? (
              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700"
              >
                Sign in
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  if (isAdmin === null) {
    return renderAdminSurface(
      <>
        {renderStandaloneAccountBar()}
        <div className={loadingSurfaceClassName}>
          Checking admin access...
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return renderAdminSurface(
      <>
        {renderStandaloneAccountBar()}
        <div className={cardSurfaceClassName}>
          <div className={dangerCardClassName}>
            <div className={`text-lg font-semibold ${showAdminBanner ? 'text-rose-100' : 'text-rose-900'}`}>
              Admin access required
            </div>
            <p className={`mt-2 text-sm ${showAdminBanner ? 'text-rose-100/70' : 'text-rose-700'}`}>
              This signed-in account is not allowed to view admin tools. Use the account control above to sign out and switch accounts.
            </p>
          </div>
        </div>
      </>
    );
  }

  return renderAdminSurface(children);
};

export default AdminRouteGuard;
