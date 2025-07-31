// FILE: pages/admin/prize-test-setup.tsx
// Admin page for setting up prize money test scenarios

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

interface TestSetupResponse {
  success: boolean;
  challengeId?: string;
  setup?: {
    prizePool: number;
    distributionType: string;
    participantCount: number;
    winnerUserId: string;
    autoCompleted: boolean;
  };
  participants?: Array<{
    rank: number;
    userId: string;
    username: string;
    score: number;
    isWinner: boolean;
  }>;
  urls?: {
    challengeDetail: string;
    challengeWrapup: string;
    winnerRedemption: string;
  };
  completion?: any;
  message?: string;
  error?: string;
}

const PrizeTestSetupPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<TestSetupResponse | null>(null);
  const [config, setConfig] = useState({
    prizeAmount: 10000, // $100.00 in cents
    distributionType: 'top_three_weighted',
    participantCount: 8,
    autoComplete: true
  });

  const currentUser = useSelector((state: RootState) => state.user.currentUser);

  const handleSetupTest = async () => {
    if (!currentUser?.id) {
      alert('You must be logged in to set up test scenarios');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/setup-prize-test-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerUserId: currentUser.id,
          ...config
        })
      });

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('Error setting up test:', error);
      setResponse({
        success: false,
        error: 'Failed to set up test scenario'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You must be logged in to access this admin page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">🏆 Prize Money Test Setup</h1>
        
        <div className="bg-zinc-900 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Test Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Prize Pool (cents)</label>
              <input
                type="number"
                value={config.prizeAmount}
                onChange={(e) => setConfig({...config, prizeAmount: parseInt(e.target.value)})}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                placeholder="10000"
              />
              <p className="text-xs text-zinc-400 mt-1">${config.prizeAmount / 100} total</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Distribution Type</label>
              <select
                value={config.distributionType}
                onChange={(e) => setConfig({...config, distributionType: e.target.value})}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg"
              >
                <option value="winner_takes_all">Winner Takes All</option>
                <option value="top_three_equal">Top 3 Equal</option>
                <option value="top_three_weighted">Top 3 Weighted (50/30/20)</option>
                <option value="custom">Custom Distribution</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Participant Count</label>
              <input
                type="number"
                value={config.participantCount}
                onChange={(e) => setConfig({...config, participantCount: parseInt(e.target.value)})}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg"
                min="3"
                max="20"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Auto Complete</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.autoComplete}
                  onChange={(e) => setConfig({...config, autoComplete: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm">Automatically complete challenge and calculate winners</span>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-800 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">What this will create:</h3>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>• A test challenge with prize money enabled</li>
              <li>• {config.participantCount} fake participants with realistic data</li>
              <li>• You will be the winner with the highest score</li>
              <li>• {config.autoComplete ? 'Challenge will be auto-completed with winners calculated' : 'Challenge will remain active for manual testing'}</li>
              <li>• Prize distribution: {config.distributionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
            </ul>
          </div>
          
          <button
            onClick={handleSetupTest}
            disabled={loading}
            className="bg-[#E0FE10] text-black py-3 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up test...' : '🎯 Create Test Scenario'}
          </button>
        </div>

        {response && (
          <div className="bg-zinc-900 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Test Results</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                response.success ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
              }`}>
                {response.success ? 'Success' : 'Failed'}
              </span>
            </div>

            {response.success ? (
              <div className="space-y-6">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-300">{response.message}</p>
                </div>

                {response.setup && (
                  <div>
                    <h3 className="font-semibold mb-3">Challenge Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-zinc-800 p-3 rounded">
                        <div className="text-zinc-400">Prize Pool</div>
                        <div className="font-semibold">${response.setup.prizePool}</div>
                      </div>
                      <div className="bg-zinc-800 p-3 rounded">
                        <div className="text-zinc-400">Participants</div>
                        <div className="font-semibold">{response.setup.participantCount}</div>
                      </div>
                      <div className="bg-zinc-800 p-3 rounded">
                        <div className="text-zinc-400">Distribution</div>
                        <div className="font-semibold">{response.setup.distributionType.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="bg-zinc-800 p-3 rounded">
                        <div className="text-zinc-400">Status</div>
                        <div className="font-semibold">{response.setup.autoCompleted ? 'Completed' : 'Active'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {response.participants && (
                  <div>
                    <h3 className="font-semibold mb-3">Leaderboard</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-700">
                            <th className="text-left py-2">Rank</th>
                            <th className="text-left py-2">Username</th>
                            <th className="text-right py-2">Score</th>
                            <th className="text-center py-2">Winner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {response.participants.map((participant) => (
                            <tr key={participant.userId} className={`border-b border-zinc-800 ${participant.isWinner ? 'bg-yellow-900/20' : ''}`}>
                              <td className="py-2">#{participant.rank}</td>
                              <td className="py-2">{participant.username}</td>
                              <td className="py-2 text-right">{participant.score}</td>
                              <td className="py-2 text-center">
                                {participant.isWinner ? '🏆' : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {response.urls && (
                  <div>
                    <h3 className="font-semibold mb-3">Test URLs</h3>
                    <div className="space-y-2">
                      <a
                        href={response.urls.challengeWrapup}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-zinc-800 p-3 rounded hover:bg-zinc-700 transition-colors"
                      >
                        <div className="font-medium">🎉 Challenge Results Page</div>
                        <div className="text-sm text-zinc-400">{response.urls.challengeWrapup}</div>
                      </a>
                      
                      <a
                        href={response.urls.winnerRedemption}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-zinc-800 p-3 rounded hover:bg-zinc-700 transition-colors"
                      >
                        <div className="font-medium">💰 Prize Redemption Page</div>
                        <div className="text-sm text-zinc-400">{response.urls.winnerRedemption}</div>
                      </a>
                      
                      <a
                        href={response.urls.challengeDetail}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-zinc-800 p-3 rounded hover:bg-zinc-700 transition-colors"
                      >
                        <div className="font-medium">📊 Challenge Detail Page</div>
                        <div className="text-sm text-zinc-400">{response.urls.challengeDetail}</div>
                      </a>
                    </div>
                  </div>
                )}

                {response.completion && (
                  <div>
                    <h3 className="font-semibold mb-3">Prize Distribution</h3>
                    <div className="bg-zinc-800 p-4 rounded">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(response.completion, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300">Error: {response.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrizeTestSetupPage; 