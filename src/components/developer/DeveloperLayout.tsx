import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from './DeveloperLayout.module.css';
export default function DeveloperLayout({children,title,active='api'}:{children:React.ReactNode;title:string;active?:'home'|'api'}) {
 return <div className={styles.root}><Head><title>{title} | Pulse Developers</title><meta name="description" content="API documentation and integration guides for Pulse partners."/></Head><header className={styles.header}><div className={styles.headerInner}><Link href="/developer" className={styles.wordmark}>Pulse<span>Developers</span></Link><nav className={styles.nav} aria-label="Developer navigation"><Link href="/developer" aria-current={active==='home'?'page':undefined}>Overview</Link><Link href="/developer/api" aria-current={active==='api'?'page':undefined}>APIs</Link></nav></div></header><main className={styles.main}>{children}</main><footer className={styles.footer}><span>Pulse developer documentation</span><span>Built for partner integration teams</span></footer></div>;
}
