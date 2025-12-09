import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface WorkoutTypeSelectorProps {
  onClose: () => void;
  onCreateWorkout: (selectedParts: string[]) => void;
}

const WorkoutTypeSelector: React.FC<WorkoutTypeSelectorProps> = ({
  onClose,
  onCreateWorkout,
}) => {
  const [selectedParts, setSelectedParts] = useState<string[]>([]);

  const toggleBodyPart = (id: string) => {
    setSelectedParts(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[80vh] sm:max-w-4xl lg:max-w-5xl sm:rounded-3xl">
        <div className="p-6 pb-2">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <X className="text-white" size={20} />
          </button>
          
          <div className="mt-6 mb-2 max-w-2xl mx-0 sm:mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold text-white text-left sm:text-center">
              Choose the body parts you want to workout.
            </h1>
            <p className="mt-2 text-zinc-400 text-base sm:text-lg text-left sm:text-center">
              You can choose multiple body parts
            </p>
          </div>
        </div>

        <div className="flex-1 p-6 pb-28 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-w-5xl mx-auto scrollbar-hide">
        <BodyPartButton
          id="body-parts/bicep"
          name="Biceps"
          isSelected={selectedParts.includes('bicep')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/tricep"
          name="Triceps" 
          isSelected={selectedParts.includes('triceps')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/chest"
          name="Chest"
          isSelected={selectedParts.includes('chest')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/calves"
          name="Calves"
          isSelected={selectedParts.includes('calves')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/abs"
          name="Abs"
          isSelected={selectedParts.includes('abs')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/hamstrings"
          name="Hamstrings"
          isSelected={selectedParts.includes('hamstrings')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/back"
          name="Back"
          isSelected={selectedParts.includes('back')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/deltoids"
          name="Deltoids"
          isSelected={selectedParts.includes('deltoids')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/glutes"
          name="Glutes"
          isSelected={selectedParts.includes('glutes')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/lats"
          name="Lats"
          isSelected={selectedParts.includes('lats')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/lowerback"
          name="Lower Back"
          isSelected={selectedParts.includes('lowerback')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/quadriceps"
          name="Quadriceps"
          isSelected={selectedParts.includes('quadriceps')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/rhomboids"
          name="Rhomboids"
          isSelected={selectedParts.includes('rhomboids')}
          onToggle={toggleBodyPart}
        />
        </div>

        {selectedParts.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => onCreateWorkout(selectedParts)}
                className="w-full py-4 rounded-full bg-[#E0FE10] text-black font-semibold text-lg"
              >
                Create workout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutTypeSelector;

interface BodyPartButtonProps {
  id: string;
  name: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const BodyPartButton: React.FC<BodyPartButtonProps> = ({
  id,
  name,
  isSelected,
  onToggle,
}) => {
  return (
    <button
      onClick={() => onToggle(id)}
      className={`relative aspect-square rounded-2xl bg-zinc-800/50 flex flex-col items-center justify-end
        ${isSelected ? 'ring-2 ring-[#E0FE10]' : ''}
        max-w-[250px] w-full mx-auto`}
    >
      <img 
        src={`${id}.svg`}
        alt={name}
        className="w-full h-full object-contain opacity-75"
      />
      
      {isSelected && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center">
          <Check className="text-black" size={16} />
        </div>
      )}
    </button>
  );
};

