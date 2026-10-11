import React from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import styles from './SystemOverviewWorkspace.module.css';

export default function SystemOverviewWorkspace({ children, onOpenSnapshot }: { children: React.ReactNode; onOpenSnapshot: () => void }) {
  return <div className={styles.root}><div className={styles.container}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Pulse workspace / Documentation</p><h1>System Overview</h1><p className={styles.subtitle}>Explore product behavior, architecture, and partner integrations. Select a system, find a document, and share the details your team needs.</p></div>
      <button className={styles.shortcut} onClick={onOpenSnapshot}><FileText size={17} /> AuntEdna snapshot contract <ArrowUpRight size={16} /></button>
    </header>
    {children}
  </div></div>;
}
