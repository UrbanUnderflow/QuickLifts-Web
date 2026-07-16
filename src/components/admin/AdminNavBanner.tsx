import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import {
  ChevronDown,
  Database,
  Home,
  LogIn,
  LogOut,
  Server,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import SignInModal from '../SignInModal';
import { useUser } from '../../hooks/useUser';
import {
  auth,
  getActiveFirebaseProjectId,
  initializeFirebase,
  isLocalFirebaseRuntime,
  isUsingDevFirebase,
  setPreferredFirebaseMode,
} from '../../api/firebase/config';

const titleizeAdminPath = (pathname: string): string => {
  const cleaned = pathname
    .replace(/^\/admin\/?/, '')
    .replace(/\[[^\]]+\]/g, '')
    .split('/')
    .filter(Boolean)[0];

  if (!cleaned) return 'Dashboard';

  const titleOverrides: Record<string, string> = {
    juniorCurriculum: 'Curriculum Outline',
    'curriculum-outline': 'Curriculum Outline',
  };

  if (titleOverrides[cleaned]) return titleOverrides[cleaned];

  return cleaned
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const AdminNavBanner: React.FC = () => {
  const router = useRouter();
  const user = useUser();
  const [isEnvironmentOpen, setIsEnvironmentOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [isLocalRuntime, setIsLocalRuntime] = useState(false);

  useEffect(() => {
    const activeMode = isUsingDevFirebase();
    setIsDevelopment(activeMode);
    setProjectId(getActiveFirebaseProjectId());
    setIsLocalRuntime(isLocalFirebaseRuntime());
  }, []);

  const pageTitle = useMemo(() => titleizeAdminPath(router.pathname), [router.pathname]);
  const accountLabel = user?.username ? `@${user.username}` : user?.email || 'Signed in';
  const profileImageUrl = user?.profileImage?.profileImageURL;

  const switchEnvironment = (nextIsDevelopment: boolean) => {
    if (nextIsDevelopment === isDevelopment) {
      setIsEnvironmentOpen(false);
      return;
    }

    setPreferredFirebaseMode(nextIsDevelopment);
    initializeFirebase(nextIsDevelopment);
    setIsDevelopment(nextIsDevelopment);
    setProjectId(getActiveFirebaseProjectId());
    setIsEnvironmentOpen(false);

    window.setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const refreshAfterSignIn = () => {
    setIsSignInOpen(false);
    window.setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[#0f1216]/95 text-white shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-[#d7ff00]/25 bg-[#d7ff00]/10 px-3 py-2 text-sm font-semibold text-[#d7ff00] transition hover:bg-[#d7ff00]/15"
              title="Open admin dashboard"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
            <Link
              href="/admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              title="Admin dashboard"
              aria-label="Admin dashboard"
            >
              <Home className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-100">{pageTitle}</div>
              <div className="truncate text-xs text-zinc-500">{router.asPath}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEnvironmentOpen((open) => !open)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  isDevelopment
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15'
                    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                }`}
                title={`Using the ${isDevelopment ? 'development' : 'production'} Firebase project`}
              >
                <Server className="h-4 w-4" />
                <span>{isDevelopment ? 'Development database' : 'Production database'}</span>
                <ChevronDown className={`h-4 w-4 transition ${isEnvironmentOpen ? 'rotate-180' : ''}`} />
              </button>

              {isEnvironmentOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close environment menu"
                    onClick={() => setIsEnvironmentOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border border-zinc-700 bg-[#171b21] shadow-2xl">
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => switchEnvironment(false)}
                        className={`w-full rounded-md px-3 py-2 text-left transition ${
                          !isDevelopment ? 'bg-[#d7ff00] text-black' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          <div>
                            <div className="text-sm font-semibold">Production database</div>
                            <div className="text-xs opacity-70">Live Firebase project</div>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => switchEnvironment(true)}
                        className={`mt-1 w-full rounded-md px-3 py-2 text-left transition ${
                          isDevelopment ? 'bg-[#d7ff00] text-black' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          <div>
                            <div className="text-sm font-semibold">Development database</div>
                            <div className="text-xs opacity-70">Dev Firebase project</div>
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                      <div className="truncate">Project: {projectId || 'Detecting project'}</div>
                      <div>{isLocalRuntime ? 'Local runtime' : 'Hosted runtime'} - reloads after switching</div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {user ? (
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
                <div className="inline-flex min-w-0 items-center gap-2 px-3 py-2 text-sm text-zinc-200">
                  {profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileImageUrl} alt={accountLabel} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <UserCircle2 className="h-4 w-4 text-zinc-400" />
                  )}
                  <span className="hidden text-zinc-500 sm:inline">Signed in as</span>
                  <span className="max-w-[180px] truncate font-semibold">{accountLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-10 items-center gap-1.5 border-l border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d7ff00]/35 bg-[#d7ff00] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#c8eb00]"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {isSignInOpen ? (
        <SignInModal
          isVisible={isSignInOpen}
          closable
          onClose={() => setIsSignInOpen(false)}
          onSignInSuccess={refreshAfterSignIn}
          onSignUpSuccess={refreshAfterSignIn}
        />
      ) : null}
    </>
  );
};

export default AdminNavBanner;
