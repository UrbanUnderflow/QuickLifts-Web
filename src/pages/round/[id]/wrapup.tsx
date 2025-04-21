import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Crown, Award, Flame, Sunrise, Heart, TrendingUp } from 'lucide-react';
import { workoutService, Challenge, UserChallenge, SweatlistCollection, WorkoutSummary, WeeklyWorkoutData, ExerciseWeeklyStats } from '../../../api/firebase/workout';
import { RootState } from '../../../redux/store';
import { collection } from 'firebase/firestore';
import { startOfWeek, endOfWeek, format as formatDateFns, differenceInCalendarWeeks } from 'date-fns';
import LiftingPerformanceSection from '../../../components/RoundWrapup/LiftingPerformanceSection';
import MuscleBalanceSection from '../../../components/RoundWrapup/MuscleBalanceSection';



// --- Shareable Analytics View ---
// This view will be rendered off-screen (hidden) and snapped to an image in a 3:4 ratio.
interface ShareableAnalyticsViewProps {
  participants: UserChallenge[];
  analyticsText: string;
}
const ShareableAnalyticsView: React.FC<ShareableAnalyticsViewProps> = ({ participants, analyticsText }) => {
  return (
    <div className="w-[300px] h-[400px] bg-zinc-900 text-white p-4 rounded-lg flex flex-col">
      {/* Podium Section */}
      <div className="flex justify-center items-end space-x-4 mb-4">
        {participants[1] && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-gray-400 overflow-hidden">
              <img
                src={participants[1].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[1].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-gray-400 font-bold">{participants[1].pulsePoints.totalPoints}</div>
          </div>
        )}
        {participants[0] && (
          <div className="text-center -mb-4">
            <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-yellow-400 overflow-hidden">
              <img
                src={participants[0].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[0].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-yellow-400 font-bold">{participants[0].pulsePoints.totalPoints}</div>
          </div>
        )}
        {participants[2] && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-amber-700 overflow-hidden">
              <img
                src={participants[2].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[2].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-amber-700 font-bold">{participants[2].pulsePoints.totalPoints}</div>
          </div>
        )}
      </div>
      {/* Analytics Text */}
      <div className="text-center text-xl font-bold mb-2">{analyticsText}</div>
      <div className="text-center text-sm text-gray-400">Challenge Wrap-up</div>
      <div className="mt-auto text-center text-xs text-gray-500">Powered by QuickLifts</div>
    </div>
  );
};

// --- Activity View for Share Sheet ---
interface ActivityViewProps {
  activityItems: any[];
  applicationActivities?: any[];
}
const ActivityView: React.FC<ActivityViewProps> = ({ activityItems, applicationActivities }) => {
  // This component wraps the native share sheet. In a web context, you can use navigator.share if available.
  useEffect(() => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Round Wrap-up',
          text: 'Check out my round wrap-up results!',
          url: activityItems[0], // our share image data URL
        })
        .catch((error) => console.error('Error sharing', error));
    } else {
      // Fallback: For now, just log
      console.log('Native share not supported.');
    }
  }, [activityItems]);
  return <div />;
};

// --------------------------------------------------------------
// Utility helpers (could be moved out later)
const weekLabel = (date: Date) => {
  const fmt = (d: Date) => formatDateFns(d, 'MMM d');
  const start = fmt(date);
  const end = fmt(endOfWeek(date));
  return `${start}-${end.slice(-2)}`;
};

// Utility: fallback mapping of exercise name -> primary muscle group (lower‑case keys, lower‑case values)
const mapExerciseNameToGroup = (exerciseName: string): string => {
  const mapping: Record<string, string> = {
    'bench press': 'chest',
    'incline bench press': 'chest',
    'decline bench press': 'chest',
    'dumbbell fly': 'chest',
    'push-up': 'chest',

    'deadlift': 'back',
    'pull-up': 'back',
    'lat pulldown': 'back',
    'barbell row': 'back',
    'dumbbell row': 'back',

    'squat': 'legs',
    'leg press': 'legs',
    'lunge': 'legs',
    'leg extension': 'legs',
    'leg curl': 'legs',

    'shoulder press': 'shoulders',
    'lateral raise': 'shoulders',
    'front raise': 'shoulders',
    'reverse fly': 'shoulders',

    'bicep curl': 'arms',
    'tricep extension': 'arms',
    'tricep pushdown': 'arms',
    'hammer curl': 'arms',

    'sit-up': 'core',
    'plank': 'core',
    'russian twist': 'core',
    'leg raise': 'core',
  };

  const lower = exerciseName.toLowerCase();
  // Exact match first
  if (mapping[lower]) return mapping[lower];

  // Keyword/fuzzy match
  if (lower.includes('chest') || lower.includes('bench') || lower.includes('fly')) return 'chest';
  if (lower.includes('back') || lower.includes('row') || lower.includes('pull')) return 'back';
  if (lower.includes('leg') || lower.includes('squat') || lower.includes('hamstring')) return 'legs';
  if (lower.includes('shoulder') || lower.includes('delt')) return 'shoulders';
  if (lower.includes('bicep') || lower.includes('tricep') || lower.includes('curl')) return 'arms';
  if (lower.includes('ab') || lower.includes('core') || lower.includes('plank')) return 'core';

  return 'other';
};

// --------------------------------------------------------------

// --- Main RoundWrapup Component ---
const RoundWrapup: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<UserChallenge[]>([]);
  const [rankedParticipants, setRankedParticipants] = useState<UserChallenge[]>([]);
  const [topEarlyRiser, setTopEarlyRiser] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [topStreakHolder, setTopStreakHolder] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [mostEncouraging, setMostEncouraging] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [biggestComeback, setBiggestComeback] = useState<{ user: UserChallenge; improvement: number } | null>(null);
  const [shareItems, setShareItems] = useState<any[]>([]);
  const [activeSheet, setActiveSheet] = useState<boolean>(false);
  const router = useRouter();
  const { id } = router.query;

  const { currentUser } = useSelector((state: RootState) => state.user);


  // A ref for the shareable analytics view snapshot
  const shareableRef = useRef<HTMLDivElement>(null);

  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<WeeklyWorkoutData[]>([]);
  const [totalVolumeLifted, setTotalVolumeLifted] = useState<number>(0);
  const [heaviestLift, setHeaviestLift] = useState<{ exercise: string; weight: number } | null>(null);
  const [totalReps, setTotalReps] = useState<number>(0);
  const [totalSets, setTotalSets] = useState<number>(0);
  const [muscleGroupBalance, setMuscleGroupBalance] = useState<Record<string, number>>({});
  const [personalRecords, setPersonalRecords] = useState<{ exercise: string; weight: number; reps: number }[]>([]);
  const [weightProgressions, setWeightProgressions] = useState<{ exercise: string; startWeight: number; endWeight: number }[]>([]);
  const [averageMuscleGroupLoad, setAverageMuscleGroupLoad] = useState<Record<string, number>>({});
  const [muscleGroupLoad, setMuscleGroupLoad] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Ensure we have a valid ID from the router before fetching
      const challengeId = typeof id === 'string' ? id : null;
      if (!challengeId) {
        console.error('No valid round ID found in URL');
        setLoading(false);
        // Optional: redirect or show an error message
        return;
      }
      try {
        // Fetch challenge and participants using the dynamic ID
        const collection: SweatlistCollection = await workoutService.getCollectionById(challengeId);
        const participantsResponse = await workoutService.getUserChallengesByChallengeId(challengeId);
        setChallenge(collection.challenge || null);
        setParticipants(participantsResponse.userChallenges || []);
      } catch (error) {
        console.error('Error fetching round data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Early riser calculation
  const calculateEarlyRiser = (participants: UserChallenge[]) => {
    const earlyRisers = participants.map(p => {
      console.log("User:", p.username);
      console.log("All completed workouts:", p.completedWorkouts);
      
      const count = p.completedWorkouts.filter(w => {
        console.log("Raw completedAt:", w.completedAt);
        const completedAt = new Date(w.completedAt);
        console.log("Parsed completedAt:", completedAt);
        console.log("Hour:", completedAt.getHours());
        return completedAt.getHours() < 8;
      }).length;
  
      console.log("Early workout count:", count);
      return { user: p, count };
    });
  
    const topEarlyRiser = earlyRisers.sort((a, b) => b.count - a.count)[0];
    console.log("Top early riser:", topEarlyRiser);
    
    return topEarlyRiser;
  };

  // When participants update, calculate rankings and superlatives
  useEffect(() => {
    if (participants.length > 0) {
      const sorted = [...participants].sort((a, b) => b.pulsePoints.totalPoints - a.pulsePoints.totalPoints);
      setRankedParticipants(sorted);

      const earlyRiserResult = calculateEarlyRiser(participants);
      setTopEarlyRiser(earlyRiserResult);

      const streaks = participants.map((p) => ({ user: p, count: p.currentStreak }));
      setTopStreakHolder(streaks.sort((a, b) => b.count - a.count)[0]);

      // Only show if count > 0
        const encouraging = participants.map(p => ({ 
            user: p, 
            count: p.encouragedUsers.length 
        }));
      const mostEncouraging = encouraging.sort((a, b) => b.count - a.count)[0];

      // Biggest comeback (using mock logic)
      if (participants.length > 0 && challenge) {
        const comebackResult = calculateComeback(participants, challenge);
        setBiggestComeback(comebackResult);
      }
    }
  }, [participants]);

  const calculateComeback = (participants: UserChallenge[], challenge: Challenge) => {
    const totalDuration = challenge.durationInDays;
  
    const comebacks = participants.map(p => {
      if (p.completedWorkouts.length === 0) {
        return { user: p, improvement: 0 };
      }
  
      // Sort workouts by date
      const sortedWorkouts = [...p.completedWorkouts].sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      );
  
      // Get first and last workout dates
      const firstDate = new Date(sortedWorkouts[0].completedAt);
      const lastDate = new Date(sortedWorkouts[sortedWorkouts.length - 1].completedAt);
      
      // Calculate effective duration in days (inclusive)
      const effectiveDays = Math.ceil(
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24)
      ) + 1;
  
      // Calculate rates
      const totalPoints = p.pulsePoints.totalPoints;
      const actualRate = totalPoints / effectiveDays;
      const expectedRate = totalPoints / totalDuration;
      
      // Calculate improvement percentage
      const improvement = expectedRate > 0 
        ? ((actualRate / expectedRate) - 1) * 100 
        : 0;
  
      console.log(`${p.username}:`);
      console.log(`Compressed ${totalPoints} points into ${effectiveDays} days`);
      console.log(`Rate: ${actualRate.toFixed(2)}/day vs Expected ${expectedRate.toFixed(2)}/day`);
      console.log(`Improvement: ${improvement.toFixed(0)}%`);
  
      return { user: p, improvement: Math.round(improvement) };
    });
  
    return comebacks.sort((a, b) => b.improvement - a.improvement)[0];
  };
  

  // Compute analytics text
  const analyticsText =
    rankedParticipants.length > 0
      ? `Top Score: ${rankedParticipants[0].pulsePoints.totalPoints} pts`
      : 'Challenge Wrap-up';

  // Fetch workout summaries for the current user once we have participants & challenge
  useEffect(() => {
    const loadWorkoutSummaries = async () => {
      if (!currentUser?.id || !challenge) return;
      try {
        const summaries = await workoutService.fetchAllWorkoutSummaries();
        // Filter to summaries that belong to this round (roundWorkoutId exists in completedWorkouts)
        const completedIds = new Set(
          participants
            .find(p => p.userId === currentUser.id)?.completedWorkouts.map(cw => cw.workoutId) || []
        );
        const roundSummaries = summaries.filter(s =>
          s.roundWorkoutId && completedIds.has(s.roundWorkoutId)
        );
        setWorkoutSummaries(roundSummaries as WorkoutSummary[]);

        // --- Simple total volume calculation ---
        let volume = 0;
        let heaviest: { exercise: string; weight: number } | null = null;

        roundSummaries.forEach(summary => {
          summary.exercisesCompleted?.forEach(log => {
            (log.logs || []).forEach(set => {
              const mainLoad = set.weight * set.reps;
              volume += mainLoad;
              if (set.isSplit) {
                volume += set.leftWeight * set.leftReps;
              }
              const heavierSideWeight = set.isSplit ? Math.max(set.weight, set.leftWeight) : set.weight;
              if (!heaviest || heavierSideWeight > heaviest.weight) {
                heaviest = { exercise: log.exercise.name, weight: heavierSideWeight };
              }
            });
          });
        });
        setTotalVolumeLifted(volume);
        setHeaviestLift(heaviest);

        // TODO: build weeklyBreakdown data structure
      } catch (e) {
        console.error('Error loading workout summaries', e);
      }
    };

    loadWorkoutSummaries();
  }, [participants, currentUser?.id, challenge]);

  // Build weekly breakdown whenever workoutSummaries changes
  useEffect(() => {
    // Calculate breakdown using the dedicated function
    const breakdown = calculateWeeklyBreakdown(workoutSummaries);

    console.log('[RoundWrapup: WeeklyEffect] Breakdown:', breakdown);

    // Update state with the results
    setWeeklyBreakdown(breakdown.weeklyData);
    setTotalReps(breakdown.cumulativeReps);
    setTotalSets(breakdown.cumulativeSets);
    setMuscleGroupBalance(breakdown.muscleRepsAggregate);
    setMuscleGroupLoad(breakdown.muscleLoadAggregate);

  }, [workoutSummaries]);

  // Compute lifting performance metrics once weeklyBreakdown ready
  useEffect(() => {
    if (weeklyBreakdown.length === 0) return;

    // --- Personal Records ---
    const prMap: Record<string, { weight: number; reps: number }> = {};
    workoutSummaries.forEach(summary => {
      summary.exercisesCompleted.forEach(log => {
        (log.logs || []).forEach(set => {
          const exerciseName = log.exercise.name;
          const heavier = set.isSplit ? Math.max(set.weight, set.leftWeight) : set.weight;
          const reps = set.isSplit && set.leftWeight > set.weight ? set.leftReps : set.reps;
          if (!prMap[exerciseName] || heavier > prMap[exerciseName].weight) {
            prMap[exerciseName] = { weight: heavier, reps };
          }
        });
      });
    });

    setPersonalRecords(Object.entries(prMap).map(([exercise, v]) => ({ exercise, weight: v.weight, reps: v.reps })).sort((a,b)=>b.weight-a.weight));

    // --- Weight Progressions (avg early vs late) ---
    const midpoint = Math.floor(workoutSummaries.length / 2);
    const early = workoutSummaries.slice(0, midpoint);
    const late = workoutSummaries.slice(midpoint);

    console.log('[RoundWrapup: WeeklyEffect] Early:', early); 

    const avgWeight = (sums: WorkoutSummary[]) => {
      const map: Record<string, number[]> = {};
      sums.forEach(summary => {
        summary.exercisesCompleted.forEach(log => {
          (log.logs || []).forEach(set => {
            const w1 = set.weight > 0 ? set.weight : 0;
            const w2 = set.isSplit && set.leftWeight > 0 ? set.leftWeight : 0;
            if (w1 > 0) {
              if (!map[log.exercise.name]) map[log.exercise.name] = [];
              map[log.exercise.name].push(w1);
            }
            if (w2 > 0) {
              if (!map[log.exercise.name]) map[log.exercise.name] = [];
              map[log.exercise.name].push(w2);
            }
          });
        });
      });
      const avg: Record<string, number> = {};
      Object.entries(map).forEach(([ex, arr]) => {
        avg[ex] = arr.reduce((a,b)=>a+b,0)/arr.length;
      });
      return avg;
    };


    const earlyAvg = avgWeight(early);
    const lateAvg = avgWeight(late);

    console.log('[RoundWrapup: WeeklyEffect] Early Avg:', earlyAvg);
    console.log('[RoundWrapup: WeeklyEffect] Late Avg:', lateAvg);

    const prog: { exercise: string; startWeight: number; endWeight: number }[] = [];
    Object.keys(lateAvg).forEach(ex => {
      if (earlyAvg[ex]) {
        prog.push({ exercise: ex, startWeight: earlyAvg[ex], endWeight: lateAvg[ex] });
      }
    });
    setWeightProgressions(prog.sort((a,b)=> (b.endWeight/b.startWeight)-(a.endWeight/a.startWeight)));

    // --- Average load per muscle group ---
    const totWeight: Record<string, number> = {};
    const totReps: Record<string, number> = {};
    weeklyBreakdown.forEach(wk => {
      wk.exerciseStats.forEach(stat => {
        totWeight[stat.muscleGroup] = (totWeight[stat.muscleGroup] || 0) + stat.totalWeight;
        totReps[stat.muscleGroup] = (totReps[stat.muscleGroup] || 0) + stat.totalReps;
      });
    });
    const avgMuscle: Record<string, number> = {};
    Object.keys(totWeight).forEach(mg => {
      avgMuscle[mg] = totWeight[mg] / Math.max(1, totReps[mg]);
    });
    setAverageMuscleGroupLoad(avgMuscle);
  }, [weeklyBreakdown]);

  const calculateWeeklyBreakdown = (summariesInput: WorkoutSummary[]) => {
    console.log("[calculateWeeklyBreakdown] Starting with summaries:", summariesInput); // DEBUG
    if (summariesInput.length === 0) {
      return {
        weeklyData: [],
        cumulativeReps: 0,
        cumulativeSets: 0,
        muscleRepsAggregate: {},
        muscleLoadAggregate: {},
      };
    }

    // Group by week start (Sunday)
    const byWeek = new Map<string, WorkoutSummary[]>();
    summariesInput.forEach(summary => {
      // Ensure completedAt is a Date object
      let completedDate: Date;
      const rawCompletedAt = summary.completedAt;
      const rawCreatedAt = summary.createdAt;

      if (rawCompletedAt instanceof Date) {
        completedDate = rawCompletedAt;
      } else if (rawCompletedAt && typeof (rawCompletedAt as any).toDate === 'function') {
        completedDate = (rawCompletedAt as any).toDate(); // Use .toDate() for Timestamp
      } else if (rawCreatedAt instanceof Date) {
        completedDate = rawCreatedAt; // Fallback to createdAt if it's a Date
      } else if (rawCreatedAt && typeof (rawCreatedAt as any).toDate === 'function') {
        completedDate = (rawCreatedAt as any).toDate(); // Fallback to createdAt if it's a Timestamp
      } else {
        // If neither is valid, log an error and skip this summary
        console.error('[calculateWeeklyBreakdown] Invalid date found in summary:', summary);
        return; // Skip this iteration
      }

      // Add a check for invalid date after conversion attempts
      if (isNaN(completedDate.getTime())) {
         console.error('[calculateWeeklyBreakdown] Resulting completedDate is invalid for summary:', summary);
         return; // Skip this iteration
      }

      const weekStart = startOfWeek(completedDate);
      const key = weekStart.toISOString();
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key)!.push(summary);
    });

    const weeklyDataResult: WeeklyWorkoutData[] = [];
    let cumulativeRepsResult = 0;
    let cumulativeSetsResult = 0;
    const muscleRepsAggregateResult: Record<string, number> = {};
    const muscleLoadAggregateResult: Record<string, number> = {};

    const sortedWeekKeys = Array.from(byWeek.keys()).sort();

    sortedWeekKeys.forEach((key) => {
      const weekSummaries = byWeek.get(key)!;
      const start = new Date(key);
      const end = endOfWeek(start);

      let setsCount = 0;
      let repsCount = 0;
      let volumeCount = 0;
      let weightCount = 0;
      const exerciseCounts: Record<string, number> = {};
      const muscleGroupSets: Record<string, number> = {};
      const muscleGroupWeight: Record<string, number> = {};
      const exerciseStatsMap: Record<string, { load: number; reps: number; muscleGroup: string }> = {};

      weekSummaries.forEach(summary => {
        (summary.exercisesCompleted || []).forEach(log => {
          const exName = log.exercise.name;
          exerciseCounts[exName] = (exerciseCounts[exName] || 0) + 1;

          let totalWeightForLog = 0;
          let totalRepsForLog = 0;
          let setsForLog = 0;

          // Iterate through the actual performed sets in log.logs
          (log.logs || []).forEach(set => {
            // Ensure set.reps and set.weight are numbers
            const setReps = typeof set.reps === 'number' ? set.reps : parseInt(set.reps || '0', 10);
            const setWeight = typeof set.weight === 'number' ? set.weight : parseFloat(set.weight || '0');
            const setLeftReps = typeof set.leftReps === 'number' ? set.leftReps : parseInt(set.leftReps || '0', 10);
            const setLeftWeight = typeof set.leftWeight === 'number' ? set.leftWeight : parseFloat(set.leftWeight || '0');

            console.log(`[calculateWeeklyBreakdown] Processing set:`, { setReps, setWeight, isSplit: set.isSplit, setLeftReps, setLeftWeight }); // DEBUG

            const currentSetReps = setReps + (set.isSplit ? setLeftReps : 0);
            const currentSetLoad = (setWeight * setReps) + (set.isSplit ? setLeftWeight * setLeftReps : 0);

            totalRepsForLog += currentSetReps;
            totalWeightForLog += currentSetLoad;
            if (currentSetReps > 0) { // Count a set if reps were performed
               setsForLog += 1;
            }
          });

           console.log(`[calculateWeeklyBreakdown] Exercise: ${exName} -> Total Weight: ${totalWeightForLog}, Total Reps: ${totalRepsForLog}, Sets: ${setsForLog}`); // DEBUG

          // Accumulate weekly totals based on summed sets
          repsCount += totalRepsForLog;
          setsCount += setsForLog;
          volumeCount += totalWeightForLog;
          weightCount += totalWeightForLog; // Assuming weightCount represents total load

          // --- Muscle Group Aggregation --- 
          let primaryMuscleGroup = 'other'; // Default
          // 1. Use primaryBodyParts if available
          if (log.exercise.primaryBodyParts && log.exercise.primaryBodyParts.length > 0) {
            primaryMuscleGroup = log.exercise.primaryBodyParts[0]; // Use first primary part
            log.exercise.primaryBodyParts.forEach(part => {
              muscleGroupSets[part] = (muscleGroupSets[part] || 0) + totalRepsForLog;
              muscleGroupWeight[part] = (muscleGroupWeight[part] || 0) + totalWeightForLog;
              // Aggregate overall totals
              muscleRepsAggregateResult[part] = (muscleRepsAggregateResult[part] || 0) + totalRepsForLog;
              muscleLoadAggregateResult[part] = (muscleLoadAggregateResult[part] || 0) + totalWeightForLog;
            });
          } else {
            // 2. Fallback to name mapping if primaryBodyParts is empty
            primaryMuscleGroup = mapExerciseNameToGroup(exName);
            muscleGroupSets[primaryMuscleGroup] = (muscleGroupSets[primaryMuscleGroup] || 0) + totalRepsForLog;
            muscleGroupWeight[primaryMuscleGroup] = (muscleGroupWeight[primaryMuscleGroup] || 0) + totalWeightForLog;
             // Aggregate overall totals
            muscleRepsAggregateResult[primaryMuscleGroup] = (muscleRepsAggregateResult[primaryMuscleGroup] || 0) + totalRepsForLog;
            muscleLoadAggregateResult[primaryMuscleGroup] = (muscleLoadAggregateResult[primaryMuscleGroup] || 0) + totalWeightForLog;
          }
          // --- End Muscle Group Aggregation ---


          // --- Exercise Stats Map --- 
          if (exerciseStatsMap[exName]) {
            exerciseStatsMap[exName].load += totalWeightForLog;
            exerciseStatsMap[exName].reps += totalRepsForLog;
            // Keep the first determined muscle group if already exists
          } else {
            exerciseStatsMap[exName] = {
              load: totalWeightForLog,
              reps: totalRepsForLog,
              muscleGroup: primaryMuscleGroup // Use the resolved group
            };
          }
          // --- End Exercise Stats Map ---
        });
      });

      // Convert exerciseStatsMap to array
      const exerciseStatsArr = Object.entries(exerciseStatsMap).map(([name, stats]) => ({
        id: `${start.toISOString()}-${name}`, // Unique ID for the week/exercise
        exerciseName: name,
        muscleGroup: stats.muscleGroup,
        totalWeight: stats.load,
        totalReps: stats.reps,
        averageLoadPerRep: stats.reps > 0 ? stats.load / stats.reps : 0
      })).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));


      weeklyDataResult.push({
        weekStartDate: start,
        weekEndDate: end,
        totalSets: setsCount,
        totalReps: repsCount,
        totalVolume: volumeCount,
        totalWeight: weightCount,
        exerciseCounts,
        muscleGroupSets,
        muscleGroupWeight,
        exerciseStats: exerciseStatsArr,
        weekLabel: weekLabel(start)
      });

      cumulativeRepsResult += repsCount;
      cumulativeSetsResult += setsCount;
    });

    console.log("[calculateWeeklyBreakdown] Final Weekly Data:", weeklyDataResult); // DEBUG
    console.log("[calculateWeeklyBreakdown] Final Reps Aggregate:", muscleRepsAggregateResult); // DEBUG
    console.log("[calculateWeeklyBreakdown] Final Load Aggregate:", muscleLoadAggregateResult); // DEBUG

    return {
      weeklyData: weeklyDataResult,
      cumulativeReps: cumulativeRepsResult,
      cumulativeSets: cumulativeSetsResult,
      muscleRepsAggregate: muscleRepsAggregateResult,
      muscleLoadAggregate: muscleLoadAggregateResult,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">
        Loading wrap-up...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6 relative">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Round Complete! 🎉</h1>
        <h2 className="text-xl text-zinc-400">{challenge?.title}</h2>
      </div>

      {/* Podium Section */}
      <div className="mb-12">
        <div className="flex justify-center items-end space-x-4">
          {rankedParticipants[1] && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-gray-400 overflow-hidden">
                <img
                  src={rankedParticipants[1].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[1].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-gray-400 font-bold">{rankedParticipants[1].pulsePoints.totalPoints}</div>
            </div>
          )}
          {rankedParticipants[0] && (
            <div className="text-center -mb-4">
              <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-yellow-400 overflow-hidden">
                <img
                  src={rankedParticipants[0].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[0].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-yellow-400 font-bold">{rankedParticipants[0].pulsePoints.totalPoints}</div>
            </div>
          )}
          {rankedParticipants[2] && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-amber-700 overflow-hidden">
                <img
                  src={rankedParticipants[2].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[2].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-amber-700 font-bold">{rankedParticipants[2].pulsePoints.totalPoints}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-12">
        <div className="mb-4 px-4 text-left">
          <h3 className="text-xl font-bold">Your Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="flex space-x-4 px-4">
            {/* Day Streak */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Flame className="w-8 h-8 text-orange-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === currentUser?.id)?.currentStreak) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Day Streak</div>
            </div>
            {/* Completion */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <TrendingUp className="w-8 h-8 text-primaryGreen" />
              </div>
              <div className="text-center text-2xl font-bold">
                {challenge ? Math.floor(((participants.find(p => p.userId === currentUser?.id)?.completedWorkouts.length || 0) / challenge.durationInDays) * 100) : 0}%
              </div>
              <div className="text-center text-sm text-gray-400">Completion</div>
            </div>
            {/* Encouraged */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Heart className="w-8 h-8 text-purple-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === currentUser?.id)?.encouragedUsers.length) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Encouraged</div>
            </div>
            {/* Check-ins */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <span className="w-8 h-8 flex items-center justify-center text-green-400 font-bold">✓</span>
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === currentUser?.id)?.checkIns.length) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Check-ins</div>
            </div>
            {/* Pulse Points */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Award className="w-8 h-8 text-blue-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === currentUser?.id)?.pulsePoints.totalPoints) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Pulse Points</div>
            </div>
            {/* Rank */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-center">
                    <Crown className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="text-center text-2xl font-bold">
                    {(() => {
                    const sorted = [...participants].sort((a, b) => b.pulsePoints.totalPoints - a.pulsePoints.totalPoints);
                    const userChallenge = participants.find(p => p.userId === currentUser?.id);
                    const rank = sorted.findIndex(p => p.userId === (userChallenge ? userChallenge.userId : '')) + 1;
                    return rank > 0 ? `#${rank}` : '-';
                    })()}
                </div>
                <div className="text-center text-sm text-gray-400">Rank</div>
                </div>
          </div>
        </div>
      </div>

      {/* Superlatives Section */}
      <div className="mb-12 px-4">
        <h3 className="text-2xl font-bold mb-6">Round Highlights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mostEncouraging && mostEncouraging.count > 0 && (
            <div className="bg-zinc-800 p-4 rounded-lg">
                <div className="flex items-center mb-4">
                <Heart className="w-6 h-6 text-red-400 mr-2" />
                <span className="font-bold">Most Encouraging</span>
                </div>
                <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                    <img
                    src={mostEncouraging.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={mostEncouraging.user.username}
                    className="w-full h-full object-cover"
                    />
                </div>
                <div>
                    <div className="font-bold">{mostEncouraging.user.username}</div>
                    <div className="text-sm text-zinc-400">{mostEncouraging.count} encouragements</div>
                </div>
                </div>
            </div>
            )}

          {topStreakHolder && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <Flame className="w-6 h-6 text-orange-400 mr-2" />
                <span className="font-bold">Streak Master</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={topStreakHolder.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={topStreakHolder.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{topStreakHolder.user.username}</div>
                  <div className="text-sm text-zinc-400">{topStreakHolder.count} day streak</div>
                </div>
              </div>
            </div>
          )}

          {topEarlyRiser && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <Sunrise className="w-6 h-6 text-yellow-400 mr-2" />
                <span className="font-bold">Early Bird</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={topEarlyRiser.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={topEarlyRiser.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{topEarlyRiser.user.username}</div>
                  <div className="text-sm text-zinc-400">{topEarlyRiser.count} early workouts</div>
                </div>
              </div>
            </div>
          )}

          {biggestComeback && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
                <span className="font-bold">Biggest Comeback</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={biggestComeback.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={biggestComeback.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{biggestComeback.user.username}</div>
                  <div className="text-sm text-zinc-400">+{biggestComeback.improvement}% improvement</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lifting Performance Section */}
      {totalVolumeLifted > 0 && (
        <LiftingPerformanceSection
          totalVolume={totalVolumeLifted}
          totalReps={totalReps}
          heaviestLift={heaviestLift}
          personalRecordsCount={personalRecords.length}
          mostImproved={weightProgressions[0]
            ? {
                exercise: weightProgressions[0].exercise,
                improvementPct:
                  ((weightProgressions[0].endWeight - weightProgressions[0].startWeight) /
                    Math.max(1, weightProgressions[0].startWeight)) * 100,
              }
            : undefined}
        />
      )}

      {/* Muscle Balance Section */}
      {Object.keys(muscleGroupBalance).length > 0 && (
        <MuscleBalanceSection
          muscleByReps={muscleGroupBalance}
          muscleByLoad={muscleGroupLoad}
          averageLoadPerRep={averageMuscleGroupLoad}
        />
      )}

      {/* Hidden shareable view for snapshot */}
      <div className="absolute top-0 left-0 -z-10 opacity-0">
        <ShareableAnalyticsView participants={participants} analyticsText={analyticsText} />
      </div>

      {/* When shareItems is set and activeSheet is true, render the ActivityView */}
      {activeSheet && shareItems.length > 0 && <ActivityView activityItems={shareItems} />}
    </div>
  );
};

export default RoundWrapup;
