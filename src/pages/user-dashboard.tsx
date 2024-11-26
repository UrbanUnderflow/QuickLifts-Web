import React, { useState, useEffect } from 'react';

const UserDashboard: React.FC = () => {
  const [userStats, setUserStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkoutSummaries = async () => {
      try {
        setLoading(true);
        
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8888/.netlify/functions'
          : 'https://fitwithpulse.ai/.netlify/functions';

        const response = await fetch(`${apiUrl}/get-all-workout-summaries`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch workout summaries');
        }

        const data = await response.json();
        
        // Group workouts by user
        const userWorkouts = data.summaries.reduce((acc: any, summary: any) => {
          const { userId, username } = summary.user;
          
          if (!acc[userId]) {
            acc[userId] = {
              userId,
              username,
              workoutCount: 0
            };
          }
          
          acc[userId].workoutCount += 1;
          return acc;
        }, {});

        // Convert to array and sort by workout count
        const statsArray = Object.values(userWorkouts).sort((a: any, b: any) => b.workoutCount - a.workoutCount);
        setUserStats(statsArray);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutSummaries();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Workout Statistics</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Workouts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {userStats.map((user) => (
              <tr key={user.userId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.userId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.workoutCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserDashboard;