import React from 'react';
import { Trash2 } from 'lucide-react';

interface VideoCardProps {
  gifUrl?: string;
  exerciseName: string;
  onClick: () => void;
  videoId?: string;
  exerciseId?: string;
  onDelete?: (videoId: string, exerciseId: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ 
  gifUrl, 
  exerciseName, 
  onClick,
  videoId,
  exerciseId,
  onDelete
}) => {
  const [isValidGif, setIsValidGif] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!gifUrl) {
      setIsValidGif(false);
      return;
    }

    fetch(gifUrl, { 
      method: 'HEAD',
      mode: 'no-cors' // Add this line to handle CORS
    })
      .then(_response => {
        // Since we're using no-cors, we won't get status
        // Instead, just assume it's valid if we get a response
        setIsValidGif(true);
      })
      .catch(() => setIsValidGif(false));
  }, [gifUrl]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && videoId && exerciseId) {
      onDelete(videoId, exerciseId);
    }
  };

  return (
    <button
      onClick={onClick}
      className="relative w-full aspect-square rounded-lg overflow-hidden group"
    >
      {onDelete && videoId && exerciseId && (
        <div 
          className="absolute top-2 right-2 z-10 p-1.5 bg-black/70 rounded-full hover:bg-red-500/90 transition-colors"
          onClick={handleDelete}
        >
          <Trash2 size={16} className="text-white" />
        </div>
      )}

      {isValidGif && gifUrl ? (
        <div className="w-full h-full">
          <img 
            key={gifUrl}
            src={gifUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
            onError={() => setIsValidGif(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
            <p className="text-white text-sm font-medium truncate">{exerciseName}</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-2">
          <span className="text-white text-sm text-center font-medium">
            {exerciseName}
          </span>
        </div>
      )}
    </button>
  );
};

export default VideoCard;