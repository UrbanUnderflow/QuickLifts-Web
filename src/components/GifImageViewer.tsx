// components/GifImageViewer.tsx
import React from 'react';

interface GifImageViewerProps {
  gifUrl: string;
  alt: string;
  className?: string;
}

export const GifImageViewer: React.FC<GifImageViewerProps> = ({ 
  gifUrl, 
  alt,
  className = ''
}) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img 
        src={gifUrl} 
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy" 
      />
    </div>
  );
};