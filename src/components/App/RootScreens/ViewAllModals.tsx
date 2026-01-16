import React from 'react';
import { Exercise } from '../../../api/firebase/exercise/types';
import { Workout, SweatlistCollection } from '../../../api/firebase/workout/types';

// View All Moves Modal
interface ViewAllMovesModalProps {
  moves: Exercise[];
  onClose: () => void;
  onSelectMove: (name: string) => void;
  onCreateNew: () => void;
}

export const ViewAllMovesModal: React.FC<ViewAllMovesModalProps> = ({ moves, onClose, onSelectMove, onCreateNew }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">My Moves</h2>
              <p className="text-zinc-400 text-sm">{moves.length} exercise video{moves.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {moves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-zinc-300 font-medium mb-1">No moves yet</p>
              <p className="text-zinc-500 text-sm mb-4">Upload your first exercise video</p>
              <button onClick={onCreateNew} className="bg-[#E0FE10] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#d0ee00] transition-colors">
                Create a Move
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {moves.map((exercise) => {
                const previewVideo = exercise.videos?.[0];
                const previewUrl = previewVideo?.thumbnail || previewVideo?.gifURL || '';
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => onSelectMove(exercise.name)}
                    className="group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/10"
                  >
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-zinc-800 to-zinc-900">
                      {previewUrl ? (
                        <>
                          <img src={previewUrl} alt={exercise.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-1">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-zinc-500 text-xs">Processing...</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md">
                        <span className="text-white text-xs font-medium">{exercise.videos?.length || 0}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 border-t-0 rounded-b-2xl group-hover:bg-zinc-800/80 transition-colors">
                      <div className="text-white font-medium text-sm truncate group-hover:text-violet-300 transition-colors">{exercise.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// View All Movelists Modal
interface ViewAllMovelistsModalProps {
  movelists: Workout[];
  username: string;
  onClose: () => void;
  onSelectMovelist: (id: string) => void;
  onCreateNew: () => void;
}

export const ViewAllMovelistsModal: React.FC<ViewAllMovelistsModalProps> = ({ movelists, username, onClose, onSelectMovelist, onCreateNew }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">My Movelists</h2>
              <p className="text-zinc-400 text-sm">{movelists.length} workout template{movelists.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {movelists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-zinc-300 font-medium mb-1">No movelists yet</p>
              <p className="text-zinc-500 text-sm mb-4">Build your first workout template</p>
              <button onClick={onCreateNew} className="bg-[#E0FE10] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#d0ee00] transition-colors">
                Create a Movelist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {movelists.map((stack) => {
                const previews = (stack.exercises || [])
                  .map((ex: any) => {
                    // Try multiple paths to find image URL
                    return ex?.exercise?.videos?.[0]?.thumbnail
                      || ex?.exercise?.videos?.[0]?.gifURL
                      || ex?.exercise?.thumbnail
                      || ex?.exercise?.gifURL
                      || ex?.videos?.[0]?.thumbnail
                      || ex?.videos?.[0]?.gifURL
                      || ex?.thumbnail
                      || ex?.gifURL;
                  })
                  .filter(Boolean)
                  .slice(0, 4) as string[];
                const moveCount = stack.exercises?.length || 0;

                return (
                  <button
                    key={stack.id}
                    type="button"
                    onClick={() => onSelectMovelist(stack.id)}
                    className="group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10"
                  >
                    <div className="relative h-28 bg-gradient-to-br from-zinc-800 to-zinc-900">
                      {previews.length > 0 ? (
                        <div className="w-full h-full grid grid-cols-4 gap-0.5">
                          {previews.map((url, idx) => (
                            <div key={idx} className="relative overflow-hidden">
                              <img src={url} alt="Move preview" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - previews.length) }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="bg-zinc-800/80" />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-500/10 to-amber-500/10">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-3">
                        <div className="bg-orange-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md">
                          <span className="text-white text-xs font-semibold">{moveCount} moves</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 border-t-0 rounded-b-2xl group-hover:bg-zinc-800/80 transition-colors">
                      <div className="text-white font-medium text-sm truncate group-hover:text-orange-300 transition-colors">
                        {stack.title || 'Untitled Movelist'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// View All Rounds Modal
interface ViewAllRoundsModalProps {
  rounds: SweatlistCollection[];
  filter: 'all' | 'active' | 'upcoming' | 'completed';
  onFilterChange: (filter: 'all' | 'active' | 'upcoming' | 'completed') => void;
  onClose: () => void;
  onSelectRound: (id: string) => void;
  onCreateNew: () => void;
}

export const ViewAllRoundsModal: React.FC<ViewAllRoundsModalProps> = ({ rounds, filter, onFilterChange, onClose, onSelectRound, onCreateNew }) => {
  // Get round status
  const getRoundStatus = (round: SweatlistCollection): 'upcoming' | 'active' | 'completed' => {
    const start = (round as any).challenge?.startDate;
    const end = (round as any).challenge?.endDate;
    const now = new Date();
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    if (startDate && endDate) {
      if (now >= startDate && now <= endDate) return 'active';
      if (now > endDate) return 'completed';
    }
    return 'upcoming';
  };

  // Filter rounds
  const filteredRounds = rounds.filter((round) => {
    if (filter === 'all') return true;
    return getRoundStatus(round) === filter;
  });

  // Count by status
  const statusCounts = rounds.reduce(
    (acc, round) => {
      const status = getRoundStatus(round);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { active: 0, upcoming: 0, completed: 0 } as Record<string, number>
  );

  // Type config for round cards
  const typeConfig: Record<string, { gradient: string; iconBg: string; iconColor: string; hoverShadow: string; hoverText: string; label: string }> = {
    workout: {
      gradient: 'from-rose-500/20 via-pink-500/20 to-orange-500/20',
      iconBg: 'bg-rose-500/30',
      iconColor: 'text-rose-300',
      hoverShadow: 'hover:shadow-rose-500/10',
      hoverText: 'group-hover:text-rose-300',
      label: 'Workout'
    },
    steps: {
      gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
      iconBg: 'bg-cyan-500/30',
      iconColor: 'text-cyan-300',
      hoverShadow: 'hover:shadow-cyan-500/10',
      hoverText: 'group-hover:text-cyan-300',
      label: 'Steps'
    },
    calories: {
      gradient: 'from-orange-500/20 via-amber-500/20 to-yellow-500/20',
      iconBg: 'bg-orange-500/30',
      iconColor: 'text-orange-300',
      hoverShadow: 'hover:shadow-orange-500/10',
      hoverText: 'group-hover:text-orange-300',
      label: 'Calories'
    },
    hybrid: {
      gradient: 'from-violet-500/20 via-purple-500/20 to-fuchsia-500/20',
      iconBg: 'bg-violet-500/30',
      iconColor: 'text-violet-300',
      hoverShadow: 'hover:shadow-violet-500/10',
      hoverText: 'group-hover:text-violet-300',
      label: 'Hybrid'
    }
  };

  const renderTypeIcon = (challengeType: string, iconColor: string) => {
    switch (challengeType) {
      case 'steps':
        return (
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'calories':
        return (
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        );
      case 'hybrid':
        return (
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'workout':
      default:
        return (
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v12H4zM16 6h4v12h-4zM8 10h8v4H8z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">My Rounds</h2>
              <p className="text-zinc-400 text-sm">{rounds.length} training challenge{rounds.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        {rounds.length > 0 && (
          <div className="px-6 py-5 border-b border-zinc-800 flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
            <button
              onClick={() => onFilterChange('all')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === 'all' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              All ({rounds.length})
            </button>
            <button
              onClick={() => onFilterChange('active')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === 'active' ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Active ({statusCounts.active})
            </button>
            <button
              onClick={() => onFilterChange('upcoming')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Upcoming ({statusCounts.upcoming})
            </button>
            <button
              onClick={() => onFilterChange('completed')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === 'completed' ? 'bg-zinc-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Completed ({statusCounts.completed})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {rounds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-rose-500/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
              <p className="text-zinc-300 font-medium mb-1">No rounds yet</p>
              <p className="text-zinc-500 text-sm mb-4">Host your first training challenge</p>
              <button onClick={onCreateNew} className="bg-[#E0FE10] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#d0ee00] transition-colors">
                Create a Round
              </button>
            </div>
          ) : filteredRounds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-zinc-400">No {filter} rounds found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRounds.map((round) => {
                const start = (round as any).challenge?.startDate;
                const end = (round as any).challenge?.endDate;
                const challengeType = (round as any).challenge?.challengeType || 'workout';
                const startDate = start ? new Date(start) : null;
                const endDate = end ? new Date(end) : null;

                const status = getRoundStatus(round);
                let statusColor = 'bg-blue-500';
                let statusText = 'Upcoming';

                if (status === 'active') {
                  statusColor = 'bg-green-500';
                  statusText = 'Active';
                } else if (status === 'completed') {
                  statusColor = 'bg-zinc-500';
                  statusText = 'Completed';
                }

                const config = typeConfig[challengeType] || typeConfig.workout;

                const dateLabel =
                  startDate && endDate
                    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : '';

                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => onSelectRound(round.id)}
                    className={`group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${config.hoverShadow}`}
                  >
                    <div className={`relative h-14 bg-gradient-to-r ${config.gradient} flex items-center px-4`}>
                      <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center mr-3`}>
                        {renderTypeIcon(challengeType, config.iconColor)}
                      </div>
                      <span className={`text-xs font-medium ${config.iconColor} opacity-80`}>{config.label}</span>
                      <div className={`absolute top-3 right-3 ${statusColor} px-2 py-0.5 rounded-full`}>
                        <span className="text-white text-xs font-semibold">{statusText}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 border-t-0 rounded-b-2xl group-hover:bg-zinc-800/80 transition-colors">
                      <div className={`text-white font-medium text-sm truncate ${config.hoverText} transition-colors`}>
                        {round.title || 'Untitled Round'}
                      </div>
                      {round.subtitle && (
                        <div className="text-zinc-400 text-xs mt-1 truncate">{round.subtitle}</div>
                      )}
                      {dateLabel && (
                        <div className="flex items-center gap-1.5 mt-2 text-zinc-500 text-xs">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{dateLabel}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
