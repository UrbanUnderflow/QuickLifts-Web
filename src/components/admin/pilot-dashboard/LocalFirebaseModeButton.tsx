import React, { useEffect, useState } from 'react';
import { Database, RefreshCcw } from 'lucide-react';
import {
  getActiveFirebaseProjectId,
  isLocalFirebaseRuntime,
  isUsingDevFirebase,
  setPreferredFirebaseMode,
} from '../../../api/firebase/config';

export const LocalFirebaseModeButton: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (!isLocalFirebaseRuntime()) return;
    setMounted(true);
    setIsDev(isUsingDevFirebase());
    setProjectId(getActiveFirebaseProjectId());
  }, []);

  if (!mounted) {
    return null;
  }

  const nextMode = isDev ? 'PROD' : 'DEV';

  return (
    <button
      type="button"
      onClick={() => {
        setPreferredFirebaseMode(!isDev);
        window.location.reload();
      }}
      title={`Running against the ${isDev ? 'development' : 'production'} Firebase project. Click to switch to ${nextMode} and reload.`}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
        isDev
          ? 'border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15'
          : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
      }`}
    >
      <Database className="h-4 w-4" />
      <span>{isDev ? 'DB: DEV' : 'DB: PROD'}</span>
      <span className="hidden text-xs opacity-80 xl:inline">{projectId}</span>
      <RefreshCcw className="h-3.5 w-3.5 opacity-80" />
    </button>
  );
};
