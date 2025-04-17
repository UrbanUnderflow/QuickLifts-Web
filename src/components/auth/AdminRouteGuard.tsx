import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const user = useUser();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user || !user.email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const result = await adminMethods.isAdmin(user.email);
        setIsAdmin(result);
      } catch (e) {
        setIsAdmin(false);
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (isAdmin === false) {
      router.replace('/');
    }
  }, [isAdmin, loading, router]);

  if (loading || isAdmin === null) {
    return <div className="text-center mt-10">Checking admin access...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminRouteGuard; 