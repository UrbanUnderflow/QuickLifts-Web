import React from 'react';

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

    fetch(gifUrl, { 
      method: 'HEAD',
      mode: 'no-cors' // Add this line to handle CORS
    })
      .then(response => {
        // Since we're using no-cors, we won't get status
        // Instead, just assume it's valid if we get a response
        console.log(response);
        setIsValidGif(true);
      })
      .catch(() => setIsValidGif(false));
  }, [gifUrl]);

  return (
    <button
      onClick={onClick}
      className="relative w-full aspect-square rounded-lg overflow-hidden"
    >
      {isValidGif && gifUrl ? (
        <div className="w-full h-full">
          <img 
            key={gifUrl}
            src={gifUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
            onError={() => setIsValidGif(false)}
          />
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