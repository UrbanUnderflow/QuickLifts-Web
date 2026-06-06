import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const user = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin === false) {
      router.replace('/');
    }
  }, [isAdmin, loading, router, user]);

  if (loading || userLoading) {
    return <div className="text-center mt-10">Checking admin access...</div>;
  }

  if (!user) {
    return <div className="text-center mt-10">Sign in to continue.</div>;
  }

  if (isAdmin === null) {
    return <div className="text-center mt-10">Checking admin access...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminRouteGuard;
