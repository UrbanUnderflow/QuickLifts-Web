import React, { useEffect, useState } from 'react';
import SnapshotArtifactReader from './SnapshotArtifactReader';
import { auth } from '../../../api/firebase/config';

type Artifact = { name: string; content: string };

export default function AuntEdnaSnapshotIntegrationTab() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in as an administrator to view this document.');
        const token = await user.getIdToken();
        const files = ['README.md', 'snapshot.schema.json', 'examples/snapshot.synthetic.json', 'examples/pull-request.synthetic.json', 'examples/pull-response.synthetic.json', 'examples/push-ack.synthetic.json'];
        const loaded = await Promise.all(files.map(async file => {
          const response = await fetch(`/api/admin/system-overview/snapshot-artifacts?file=${encodeURIComponent(file)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error('The integration documents could not be loaded.');
          const data = await response.json();
          if (typeof data.file !== 'string' || typeof data.content !== 'string') throw new Error('The integration documents were incomplete.');
          return { name: data.file, content: data.content };
        }));
        if (mounted) setArtifacts(loaded);
      } catch (failure) {
        if (mounted) setError(failure instanceof Error ? failure.message : 'The integration documents could not be loaded.');
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">{error}</p>;
  if (!artifacts.length) return <p role="status">Loading integration documents…</p>;
  return <SnapshotArtifactReader artifacts={artifacts} />;
}
