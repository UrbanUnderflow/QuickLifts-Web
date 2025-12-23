/* ------------------------------------------------------------------
 *  ReferralGraph – tiny force-directed thumbnail for viral networks
 *  dependencies:  react-force-graph-2d  (≈15 kB gzip)
 * -----------------------------------------------------------------*/
import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// ❶  Load ForceGraph2D only on the client (avoids SSR blow-ups)
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then(mod => mod.ForceGraph2D || mod.default),
  { ssr: false }
);

// ---------- Types ----------
export interface GraphNode {
  id: string;
  label?: string;
  level?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface ReferralGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  className?: string;
}

// ---------- Component ----------
const ReferralGraph: React.FC<ReferralGraphProps> = ({ data, className = '' }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // ❷  Resize-aware canvas
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      setDimensions({
        w: containerRef.current.clientWidth,
        h: containerRef.current.clientHeight,
      });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ❸  Re-center graph on load
  useEffect(() => {
    if (fgRef.current && dimensions.w > 0) {
      // Use a timeout to ensure the graph is fully rendered before attempting operations
      setTimeout(() => {
        try {
          // Try to zoom to fit if the method exists, otherwise skip
          if (fgRef.current && typeof fgRef.current.zoomToFit === 'function') {
            fgRef.current.zoomToFit(400);
          }
        } catch (_error) {
          console.log('zoomToFit not available, skipping auto-zoom');
        }
      }, 100);
    }
  }, [dimensions.w, data]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-64 ${className}`}
      // subtle neon border to match dataroom aesthetic
    >
      {dimensions.w > 0 && (
        <ForceGraph2D
          {...({
            ref: fgRef,
            width: dimensions.w,
            height: dimensions.h,
            graphData: data,
            nodeRelSize: 4,
            linkColor: () => 'rgba(255,255,255,0.08)',
            linkWidth: () => 1,
            linkDirectionalParticles: 0,
            nodeCanvasObject: (node: any, ctx: any, globalScale: any) => {
              const label = node.label || node.id;
              // host node lime, children gray
              ctx.fillStyle = node.level === 0 ? '#E0FE10' : '#A1A1AA';
              ctx.beginPath();
              ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
              ctx.fill();

              // optional tiny labels on high-dpi screens
              const fontSize = 10 / globalScale;
              if (globalScale > 2) {
                ctx.font = `${fontSize}px Inter, sans-serif`;
                ctx.fillStyle = '#e4e4e7';
                ctx.textAlign = 'center';
                ctx.fillText(label, node.x, node.y - 10);
              }
            },
            nodePointerAreaPaint: (node: any, color: any, ctx: any) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
              ctx.fill();
            },
            enableNodeDrag: false,
            enableZoomInteraction: false,
            enablePanInteraction: false,
          } as any)}
        />
      )}
    </div>
  );
};

export default ReferralGraph;

/* ------------------------------------------------------------------
 *  Quick mock data (delete once Firestore pipe is wired)
 * ------------------------------------------------------------------*/
export const sampleGraph: ReferralGraphProps['data'] = {
  nodes: [
    { id: 'Host', level: 0 },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `P${i + 1}`, level: 1 })),
    { id: 'G1', level: 2 },
    { id: 'G2', level: 2 },
  ],
  links: [
    ...Array.from({ length: 10 }, (_, i) => ({ source: 'Host', target: `P${i + 1}` })),
    { source: 'P3', target: 'G1' },
    { source: 'P6', target: 'G2' },
  ],
}; 