// components/GifImageViewer.tsx
import React from 'react';

interface GifImageViewerProps {
  gifUrl: string;
  alt: string;
  frameSize?: { width: number; height: number }; // Allows setting a fixed size
  contentMode?: 'cover' | 'contain' | 'fill'; // Controls image scaling
  className?: string; // Additional CSS classes
  onClick?: () => void; // Click handler for interaction
}

export const GifImageViewer: React.FC<GifImageViewerProps> = ({
  gifUrl,
  alt,
  frameSize,
  contentMode = 'cover',
  className = '',
  onClick,
}) => {
  const style = frameSize
    ? { width: `${frameSize.width}px`, height: `${frameSize.height}px` }
    : {};

  return (
    <div
      className={`relative overflow-hidden rounded-full cursor-pointer ${className}`}
      style={style}
      onClick={onClick}
    >
      <img
        src={gifUrl}
        alt={alt}
        className={`w-full h-full object-${contentMode}`}
        loading="lazy"
      />
    </div>
  );
};