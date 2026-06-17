import React, { useEffect, useState } from 'react';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';
import { isDevAuthBypassEnabled } from '../../utils/devAuthBypass';
import AdminNavBanner from '../admin/AdminNavBanner';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const user = useUser();
  const userLoading = useUserLoading();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const renderAdminSurface = (content: React.ReactNode) => (
    <>
      <AdminNavBanner />
      {content}
    </>
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
      <div className="min-h-[55vh] bg-[#111417] px-4 py-10 text-center text-sm text-zinc-400">
        Checking admin access...
      </div>
    );
  }

  if (!user) {
    return renderAdminSurface(
      <div className="min-h-[55vh] bg-[#111417] px-4 py-12 text-white">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-[#1a1e24] p-6 text-center shadow-xl">
          <div className="text-lg font-semibold">Sign in to continue</div>
          <p className="mt-2 text-sm text-zinc-400">
            Use the admin banner to sign in, then this page will continue after your account is verified.
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return renderAdminSurface(
      <div className="min-h-[55vh] bg-[#111417] px-4 py-10 text-center text-sm text-zinc-400">
        Checking admin access...
      </div>
    );
  }

  if (!isAdmin) {
    return renderAdminSurface(
      <div className="min-h-[55vh] bg-[#111417] px-4 py-12 text-white">
        <div className="mx-auto max-w-md rounded-xl border border-rose-500/25 bg-rose-500/10 p-6 text-center shadow-xl">
          <div className="text-lg font-semibold text-rose-100">Admin access required</div>
          <p className="mt-2 text-sm text-rose-100/70">
            This signed-in account is not allowed to view admin tools. Use the banner account control to sign out and switch accounts.
          </p>
        </div>
      </div>
    );
  }

  return renderAdminSurface(children);
};

export default AdminRouteGuard;
