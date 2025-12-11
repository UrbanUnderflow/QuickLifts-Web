import React from 'react';

const VideoDemo: React.FC = () => (
  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-[2px] mb-12">
    {/* animated rim */}
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-[#d7ff00]/15 animate-[spin_12s_linear_infinite] opacity-30" />
    
    {/* inner container with larger dimensions */}
    <div className="relative bg-zinc-900 rounded-[0.75rem] overflow-hidden">
      <div className="w-full h-[400px] md:h-[500px] lg:h-[600px]">
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/8Ous6Wqvn7o?rel=0&modestbranding=1&playsinline=1"
          loading="lazy"
          title="Pulse Product Walk-Through"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  </div>
);

export default VideoDemo; 