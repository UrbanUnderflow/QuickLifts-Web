import React, { useState, useEffect } from 'react';
import { Trophy, User, ArrowUpRight, ArrowDownRight, Minus, MapPin, Timer, TrendingUp } from 'lucide-react';
import { UserChallenge, RunRoundConfiguration, RunLeaderboardMetric, RunLeaderboardMetricInfo } from '../../api/firebase/workout/types';

interface RunLeaderboardEntry {
    id: string;
    rank: number;
    userId: string;
    username: string;
    profileImageURL: string | null;
    metricValue: number;
    formattedValue: string;
    totalDistance: number;
    totalRuns: number;
    totalDuration: number;
    averagePace: number;
    streakDays: number;
}

interface RunRoundLeaderboardProps {
    challengeId: string;
    startDate: Date | null;
    endDate: Date | null;
    runRoundConfig: RunRoundConfiguration;
    participants: UserChallenge[];
    currentUserId?: string;
    onParticipantClick?: (userId: string, username: string) => void;
}

const RunRoundLeaderboard: React.FC<RunRoundLeaderboardProps> = ({
    challengeId,
    startDate,
    endDate,
    runRoundConfig,
    participants,
    currentUserId,
    onParticipantClick
}) => {
    const [leaderboard, setLeaderboard] = useState<RunLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAllParticipants, setShowAllParticipants] = useState(false);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!challengeId) return;

            setLoading(true);
            setError(null);

            try {
                // Build query params
                const params = new URLSearchParams({
                    challengeId: challengeId,
                    leaderboardMetric: runRoundConfig.leaderboardMetric || 'totalDistance',
                    allowTreadmill: String(runRoundConfig.allowTreadmill ?? true)
                });

                if (startDate) {
                    params.append('startDate', String(Math.floor(startDate.getTime() / 1000)));
                }
                if (endDate) {
                    params.append('endDate', String(Math.floor(endDate.getTime() / 1000)));
                }

                const response = await fetch(`/.netlify/functions/get-run-round-leaderboard?${params.toString()}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard');
                }

                const data = await response.json();

                if (data.success && data.leaderboard) {
                    setLeaderboard(data.leaderboard);
                } else {
                    throw new Error(data.error || 'Failed to fetch leaderboard');
                }
            } catch (err) {
                console.error('Error fetching run round leaderboard:', err);
                setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [challengeId, startDate, endDate, runRoundConfig.leaderboardMetric, runRoundConfig.allowTreadmill]);

    const toggleShowAll = () => {
        setShowAllParticipants(prev => !prev);
    };

    const getMetricIcon = () => {
        switch (runRoundConfig.leaderboardMetric) {
            case RunLeaderboardMetric.TotalDistance:
                return <MapPin className="w-4 h-4" />;
            case RunLeaderboardMetric.TotalTime:
                return <Timer className="w-4 h-4" />;
            case RunLeaderboardMetric.RunsCompleted:
                return <TrendingUp className="w-4 h-4" />;
            case RunLeaderboardMetric.AveragePace:
                return <Timer className="w-4 h-4" />;
            default:
                return <MapPin className="w-4 h-4" />;
        }
    };

    const getMetricDisplayName = () => {
        return RunLeaderboardMetricInfo[runRoundConfig.leaderboardMetric]?.displayName || 'Distance';
    };

    // Display only top 5 by default
    const displayedEntries = showAllParticipants ? leaderboard : leaderboard.slice(0, 5);

    if (loading) {
        return (
            <div className="bg-zinc-800 rounded-xl p-6 mt-6">
                <h2 className="text-lg font-semibold text-white mb-4">Leaderboard</h2>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-zinc-800 rounded-xl p-6 mt-6">
                <h2 className="text-lg font-semibold text-white mb-4">Leaderboard</h2>
                <div className="text-center py-4 text-zinc-400">
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-[#3B82F6] hover:text-[#60A5FA]"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-800 rounded-xl p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#3B82F6]" />
                    Run Leaderboard
                </h2>
                <div className="flex items-center gap-1 text-sm text-zinc-400">
                    {getMetricIcon()}
                    <span>By {getMetricDisplayName()}</span>
                </div>
            </div>

            {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-4xl mb-2">🏃</div>
                    <p className="text-zinc-400">No runs logged yet</p>
                    <p className="text-sm text-zinc-500 mt-1">Be the first to log a run!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedEntries.map((entry, index) => {
                        const isCurrentUser = entry.userId === currentUserId;

                        return (
                            <div
                                key={entry.id}
                                onClick={() => onParticipantClick?.(entry.userId, entry.username)}
                                className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${isCurrentUser
                                        ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/50 hover:bg-[#3B82F6]/30'
                                        : 'bg-zinc-900 hover:bg-zinc-800'
                                    }`}
                            >
                                <div className="flex items-center space-x-4">
                                    {/* Rank & Medal */}
                                    <div className="flex items-center justify-center w-8">
                                        {entry.rank <= 3 ? (
                                            <Trophy
                                                className={
                                                    entry.rank === 1 ? "text-yellow-500" :
                                                        entry.rank === 2 ? "text-gray-400" :
                                                            "text-amber-600"
                                                }
                                                size={20}
                                            />
                                        ) : (
                                            <span className="text-zinc-400 font-medium">#{entry.rank}</span>
                                        )}
                                    </div>

                                    {/* Profile Image or Placeholder */}
                                    {entry.profileImageURL ? (
                                        <img
                                            src={entry.profileImageURL}
                                            alt={entry.username}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                                            <User className="text-zinc-400" size={20} />
                                        </div>
                                    )}

                                    {/* User Info */}
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`font-medium ${isCurrentUser ? 'text-[#3B82F6]' : 'text-white'}`}>
                                                {entry.username}
                                                {isCurrentUser && <span className="text-[#3B82F6] text-sm ml-1">(You)</span>}
                                            </span>
                                        </div>
                                        <div className="text-sm text-zinc-500">
                                            {entry.totalRuns} {entry.totalRuns === 1 ? 'run' : 'runs'} • {entry.totalDistance.toFixed(1)} mi
                                        </div>
                                    </div>
                                </div>

                                {/* Metric Value */}
                                <div className="text-right">
                                    <div className={`font-bold text-lg ${isCurrentUser ? 'text-[#3B82F6]' : 'text-white'}`}>
                                        {entry.formattedValue}
                                    </div>
                                    {entry.streakDays > 0 && (
                                        <div className="text-sm text-orange-500">
                                            🔥 {entry.streakDays} day{entry.streakDays !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {leaderboard.length > 5 && (
                <button
                    onClick={toggleShowAll}
                    className="mt-4 text-sm text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                >
                    {showAllParticipants ? 'Show less' : `Show all (${leaderboard.length})`}
                </button>
            )}

            {/* Group Stats Summary */}
            {leaderboard.length > 0 && (
                <div className="mt-6 pt-4 border-t border-zinc-700">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-white">
                                {leaderboard.reduce((sum, e) => sum + e.totalDistance, 0).toFixed(1)}
                            </div>
                            <div className="text-xs text-zinc-400">Total Miles</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">
                                {leaderboard.reduce((sum, e) => sum + e.totalRuns, 0)}
                            </div>
                            <div className="text-xs text-zinc-400">Total Runs</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">
                                {leaderboard.length}
                            </div>
                            <div className="text-xs text-zinc-400">Runners</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RunRoundLeaderboard;
