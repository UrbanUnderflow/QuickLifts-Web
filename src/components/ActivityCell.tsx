import React from 'react';
import { ActivityType, UserActivity } from '../types/Activity';
import { FaDumbbell, FaRunning, FaLeaf, FaRegHeart, FaVideo } from 'react-icons/fa'; // Add suitable icons as needed

export interface ActivityCellProps {
  activities: UserActivity[];
  selectedDate: Date;
  onWorkoutSelect: (activity: UserActivity) => void;
  onVideoSelect: (activity: UserActivity) => void;
  onProfileSelect: (activity: UserActivity) => void;
}

const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  switch (type) {
    case ActivityType.WeightTraining:
      return <FaDumbbell className="text-yellow-500" />;
    case ActivityType.Cardio:
      return <FaRunning className="text-blue-500" />;
    case ActivityType.Yoga:
      return <FaLeaf className="text-green-500" />;
    case ActivityType.ExercisePosted:
      return <FaVideo className="text-pink-500" />;
    case ActivityType.Follower:
    case ActivityType.Following:
      return <FaRegHeart className="text-red-500" />;
    default:
      return <FaDumbbell className="text-gray-500" />;
  }
};

export const ActivityCell: React.FC<ActivityCellProps> = ({
  activities,
  selectedDate,
  onWorkoutSelect,
  onVideoSelect,
  onProfileSelect
}) => {
  return (
    <div className="p-4 space-y-4 bg-zinc-900 rounded-lg">
      <div className="text-sm text-gray-400">
        {selectedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        })}
      </div>
      {activities.map(activity => (
        <div
          key={activity.id}
          className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700 transition"
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
          <ActivityIcon type={activity.type} />
          <div className="flex flex-col">
            <div className="text-white font-medium">{activity.title}</div>
            <div className="text-sm text-gray-400">{activity.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
