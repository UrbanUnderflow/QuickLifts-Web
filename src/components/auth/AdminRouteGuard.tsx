import React, { useEffect, useState } from 'react';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';
import { isDevAuthBypassEnabled } from '../../utils/devAuthBypass';
import AdminNavBanner from '../admin/AdminNavBanner';
import SignInModal from '../SignInModal';

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
      <div className={loadingSurfaceClassName}>
        Checking admin access...
      </div>
    );
  }

  if (!user) {
    return renderAdminSurface(
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
    );
  }

  if (isAdmin === null) {
    return renderAdminSurface(
      <div className={loadingSurfaceClassName}>
        Checking admin access...
      </div>
    );
  }

  if (!isAdmin) {
    return renderAdminSurface(
      <div className={cardSurfaceClassName}>
        <div className={dangerCardClassName}>
          <div className={`text-lg font-semibold ${showAdminBanner ? 'text-rose-100' : 'text-rose-900'}`}>
            Admin access required
          </div>
          <p className={`mt-2 text-sm ${showAdminBanner ? 'text-rose-100/70' : 'text-rose-700'}`}>
            This signed-in account is not allowed to view admin tools. Sign out and switch accounts.
          </p>
        </div>
      </div>
    );
  }

  return renderAdminSurface(children);
};

export default AdminRouteGuard;
