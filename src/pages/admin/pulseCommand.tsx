import dynamic from 'next/dynamic';

const PulseCommandContent = dynamic(
  () => import('../../components/pulseCommand/PulseCommandContent'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0b0b0d] px-6 py-8 text-zinc-200">
        Loading Pulse Command...
      </div>
    ),
  },
);

export default function PulseCommandPage() {
  return <PulseCommandContent />;
}
