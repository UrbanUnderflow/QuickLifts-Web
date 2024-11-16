import React from 'react';
import { ActivityType, UserActivity } from '../types/Activity';


// components/ActivityCell.tsx
export interface ActivityCellProps {
    activities: UserActivity[];
    selectedDate: Date;
    onWorkoutSelect: (activity: UserActivity) => void;
    onVideoSelect: (activity: UserActivity) => void;
    onProfileSelect: (activity: UserActivity) => void;
  }
  
export const ActivityCell: React.FC<ActivityCellProps> = ({
    activities,
    selectedDate,
    onWorkoutSelect,
    onVideoSelect,
    onProfileSelect
  }) => {
    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-400">
          {selectedDate.toLocaleDateString()}
        </div>
        {activities.map(activity => (
          <div 
            key={activity.id}
            className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg"
            onClick={() => {
              switch (activity.type) {
                case ActivityType.WeightTraining:
                case ActivityType.Speed:
                case ActivityType.Yoga:
                case ActivityType.Mobility:
                case ActivityType.Cardio:
                  onWorkoutSelect(activity);
                  break;
                case ActivityType.ExercisePosted:
                case ActivityType.ExerciseSaved:
                  onVideoSelect(activity);
                  break;
                case ActivityType.Following:
                case ActivityType.Follower:
                  onProfileSelect(activity);
                  break;
              }
            }}
          >
            <div className="text-white">
              <div className="font-medium">{activity.title}</div>
              <div className="text-sm text-gray-400">{activity.value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };