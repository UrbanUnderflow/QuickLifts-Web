import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import { isPipeListsProductionBrowser } from '../utils/pipelistsRuntime';

// Do not evaluate the workspace's Firebase imports before the runtime boundary.
const PipeListsPage: NextPage = () => {
  const [Workspace, setWorkspace] = useState<NextPage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isPipeListsProductionBrowser()) return;
    let cancelled = false;
    import('../features/PipeListsWorkspace').then(module => {
      if (!cancelled) setWorkspace(() => module.default);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  if (Workspace) return <Workspace />;
  return <main className="mx-auto max-w-xl p-8"><h1>PipeLists</h1><p>{failed ? 'Unable to load PipeLists. Reload to try again.' : 'PipeLists is available only on the production site. Development and preview sessions cannot connect to its services.'}</p></main>;
};
export default PipeListsPage;
