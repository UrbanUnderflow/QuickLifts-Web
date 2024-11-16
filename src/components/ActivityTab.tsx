import React from 'react';
import { ActivityCell } from './ActivityCell';
import { ActivityGroup, ActivityType, UserActivity } from '../types/Activity';
import { Exercise } from '../types/Exercise';
import { WorkoutSummary } from '../types/WorkoutSummary';
import { StarIcon } from '@heroicons/react/24/outline';


// components/ActivityTab.tsx
export interface ActivityTabProps {
    activities: UserActivity[];
    workoutSummaries: WorkoutSummary[];
    userVideos: Exercise[];
    isPublicProfile?: boolean;
    username: string;
    onWorkoutSelect: (summary: WorkoutSummary) => void;
    onVideoSelect: (exercise: Exercise) => void;
    onProfileSelect: (userId: string) => void;
  }
  
export const ActivityTab: React.FC<ActivityTabProps> = ({
    activities,
    workoutSummaries,
    userVideos,
    username,
    onWorkoutSelect,
    onVideoSelect,
    onProfileSelect
  }) => {
    const groupActivities = (): ActivityGroup[] => {
      if (activities.length === 0) return [];
  
      const groups: { [key: string]: UserActivity[] } = {};
  
      activities.forEach(activity => {
        const dateKey = activity.date.toDateString();
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(activity);
      });
  
      return Object.entries(groups).map(([date, acts]) => ({
        id: date,
        activities: acts
      }));
    };
  
    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <StarIcon className="w-12 h-12 text-white/20" />
          <h3 className="mt-4 text-white font-medium">{username} has no activities yet</h3>
        </div>
      );
    }
  
    return (
      <div className="space-y-4">
        {groupActivities().map(group => (
          <ActivityCell
            key={group.id}
            activities={group.activities}
            selectedDate={new Date(group.id)}
            onWorkoutSelect={(activity) => {
              const summary = workoutSummaries.find(s => s.id === activity.correspondingId);
              if (summary) onWorkoutSelect(summary);
            }}
            onVideoSelect={(activity) => {
              const video = userVideos.find(v => 
                v.videos.some(vid => vid.id === activity.correspondingId)
              );
              if (video) onVideoSelect(video);
            }}
            onProfileSelect={(activity) => {
              const userId = activity.type === ActivityType.Follower
                ? activity.correspondingId.slice(-28)
                : activity.correspondingId.slice(0, 28);
              onProfileSelect(userId);
            }}
          />
        ))}
      </div>
    );
  };