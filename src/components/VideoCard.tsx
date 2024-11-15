import React from 'react';

// VideoCard.tsx
interface VideoCardProps {
  gifUrl?: string;
  exerciseName: string;
  onClick: () => void;
}
  
const VideoCard: React.FC<VideoCardProps> = ({ gifUrl, exerciseName, onClick }) => {
    const [isValidGif, setIsValidGif] = React.useState<boolean>(true);
  
    React.useEffect(() => {
      if (!gifUrl) {
        setIsValidGif(false);
        return;
      }
  
      fetch(gifUrl, { method: 'HEAD' })
        .then(response => {
          if (response.status === 404) {
            setIsValidGif(false);
          }
        })
        .catch(() => setIsValidGif(false));
    }, [gifUrl]);
  
    return (
      <button
        onClick={onClick}
        className="relative w-full aspect-square rounded-lg overflow-hidden"
      >
        {isValidGif && gifUrl ? (
          <img 
            src={gifUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
          />
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
