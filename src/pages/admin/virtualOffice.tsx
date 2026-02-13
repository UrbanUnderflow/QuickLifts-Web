import dynamic from 'next/dynamic';

/* 
 * The entire VirtualOfficeContent component (3000+ lines) is loaded 
 * client-side only via dynamic import with ssr:false.
 * This keeps the page bundle tiny and avoids the Netlify build 
 * memory limit by deferring compilation to a separate chunk.
 */
const VirtualOfficeContent = dynamic(
  () => import('../../components/virtualOffice/VirtualOfficeContent'),
  {
    ssr: false, loading: () => (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030508',
        color: '#71717a',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: '14px',
      }}>
        Loading Virtual Office…
      </div>
    )
  }
);

export default function VirtualOfficePage() {
  return <VirtualOfficeContent />;
}
