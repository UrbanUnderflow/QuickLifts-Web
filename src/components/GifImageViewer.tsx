// components/GifImageViewer.tsx
import React from 'react';

interface GifImageViewerProps {
  gifUrl: string;
  alt: string;
  frameSize?: { width: number; height: number };
  contentMode?: 'cover' | 'contain' | 'fill';
  className?: string;
  onClick?: () => void;
  variant?: 'circle' | 'rounded'; // New prop
}

export const GifImageViewer: React.FC<GifImageViewerProps> = ({
  gifUrl,
  alt,
  frameSize,
  contentMode = 'cover',
  className = '',
  onClick,
  variant = 'circle', // Default to circle for backward compatibility
}) => {
  const style = frameSize
    ? { width: `${frameSize.width}px`, height: `${frameSize.height}px` }
    : {};

  const borderRadius = variant === 'circle' ? 'rounded-full' : 'rounded-xl';

  return (
    <div
      className={`relative overflow-hidden ${borderRadius} cursor-pointer ${className}`}
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