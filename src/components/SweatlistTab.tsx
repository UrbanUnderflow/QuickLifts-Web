import React from 'react';
import { Workout } from '../api/firebase/workout/types';
import CollectionSweatlistItem from './CollectionSweatlistItem';
import { 
    BookOpenIcon 
} from '@heroicons/react/24/outline';

export interface SweatlistsTabProps {
    sweatlists: Workout[];
    onSelectSweatlist: (sweatlist: Workout) => void;
}

export const SweatlistsTab: React.FC<SweatlistsTabProps> = ({
    sweatlists,
    onSelectSweatlist,
  }) => {
    if (sweatlists.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <BookOpenIcon className="w-12 h-12 text-white/20" />
          <h3 className="mt-4 text-white font-medium">No sweatlists added yet</h3>
        </div>
      );
    }
  
    return (
        <div className="space-y-4 p-4">
          {sweatlists.map(workout => (
            <div 
              key={workout.id} 
              onClick={() => onSelectSweatlist(workout)}
              className="cursor-pointer"
            >
              <CollectionSweatlistItem workout={workout} />
            </div>
          ))}
        </div>
      );
  };