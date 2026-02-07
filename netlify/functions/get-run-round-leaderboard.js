const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
    }
}

const db = admin.firestore();

/**
 * Fetches run leaderboard data for a Run Round challenge
 * 
 * Query Parameters:
 * - challengeId: The challenge/round ID
 * - startDate: Challenge start date (Unix timestamp in seconds)
 * - endDate: Challenge end date (Unix timestamp in seconds)
 * - leaderboardMetric: The metric to sort by (totalDistance, runsCompleted, etc.)
 * - allowTreadmill: Whether to include treadmill runs (true/false)
 */
exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const {
            challengeId,
            startDate,
            endDate,
            leaderboardMetric = 'totalDistance',
            allowTreadmill = 'true'
        } = event.queryStringParameters || {};

        if (!challengeId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'challengeId is required' })
            };
        }

        const startTimestamp = startDate ? parseFloat(startDate) : null;
        const endTimestamp = endDate ? parseFloat(endDate) : null;
        const includeTreadmill = allowTreadmill === 'true';

        console.log(`📊 Fetching run leaderboard for challenge ${challengeId}`);
        console.log(`   Date range: ${startDate} to ${endDate}`);
        console.log(`   Metric: ${leaderboardMetric}`);
        console.log(`   Include treadmill: ${includeTreadmill}`);

        // Step 1: Get all participants (userChallenges) for this challenge
        const userChallengesSnapshot = await db
            .collection('userChallenges')
            .where('challengeId', '==', challengeId)
            .get();

        const participants = [];
        userChallengesSnapshot.forEach(doc => {
            const data = doc.data();
            participants.push({
                id: doc.id,
                ...data,
                userId: data.userId,
                username: data.username || 'Unknown',
                profileImageURL: data.profileImage?.profileImageURL || null
            });
        });

        console.log(`   Found ${participants.length} participants`);

        // Step 2: For each participant, fetch their run summaries within the date range
        const leaderboardEntries = [];

        for (const participant of participants) {
            const userId = participant.userId;
            if (!userId) continue;

            // Fetch runSummaries for this user
            let runSummariesQuery = db
                .collection('users')
                .doc(userId)
                .collection('runSummaries');

            const runSnapshot = await runSummariesQuery.get();

            let runs = [];
            runSnapshot.forEach(doc => {
                const data = doc.data();

                // Parse timestamps - handle both Firestore Timestamps and raw numbers
                let createdAt = null;
                if (data.createdAt) {
                    if (data.createdAt.toDate) {
                        createdAt = data.createdAt.toDate().getTime() / 1000;
                    } else if (typeof data.createdAt === 'number') {
                        createdAt = data.createdAt;
                    }
                }

                let completedAt = null;
                if (data.completedAt) {
                    if (data.completedAt.toDate) {
                        completedAt = data.completedAt.toDate().getTime() / 1000;
                    } else if (typeof data.completedAt === 'number') {
                        completedAt = data.completedAt;
                    }
                }

                const runDate = completedAt || createdAt;

                // Filter by date range
                if (startTimestamp && runDate && runDate < startTimestamp) {
                    return;
                }
                if (endTimestamp && runDate && runDate > endTimestamp) {
                    return;
                }

                // Filter treadmill runs if not allowed
                const location = data.location || 'outdoor';
                if (!includeTreadmill && location === 'treadmill') {
                    return;
                }

                // Ignore synthetic treadmill runs (to avoid duplicates)
                if (doc.id.startsWith('treadmill-')) {
                    return;
                }

                runs.push({
                    id: doc.id,
                    distance: data.distance || 0,
                    duration: data.duration || 0,
                    averagePace: data.averagePace || 0,
                    location: location,
                    completedAt: completedAt,
                    createdAt: createdAt
                });
            });

            // Also fetch fatBurnSummaries (treadmill workouts)
            if (includeTreadmill) {
                const fatBurnSnapshot = await db
                    .collection('users')
                    .doc(userId)
                    .collection('fatBurnSummaries')
                    .get();

                fatBurnSnapshot.forEach(doc => {
                    const data = doc.data();
                    const equipment = data.equipment || '';

                    // Only include treadmill sessions with distance
                    if (equipment !== 'treadmill') return;

                    const distance = data.distance || 0;
                    if (distance <= 0) return;

                    // Parse timestamps
                    let createdAt = null;
                    if (data.createdAt) {
                        if (data.createdAt.toDate) {
                            createdAt = data.createdAt.toDate().getTime() / 1000;
                        } else if (typeof data.createdAt === 'number') {
                            createdAt = data.createdAt;
                        }
                    }

                    let completedAt = null;
                    if (data.completedAt) {
                        if (data.completedAt.toDate) {
                            completedAt = data.completedAt.toDate().getTime() / 1000;
                        } else if (typeof data.completedAt === 'number') {
                            completedAt = data.completedAt;
                        }
                    }

                    const runDate = completedAt || createdAt;

                    // Filter by date range
                    if (startTimestamp && runDate && runDate < startTimestamp) {
                        return;
                    }
                    if (endTimestamp && runDate && runDate > endTimestamp) {
                        return;
                    }

                    runs.push({
                        id: `treadmill-${doc.id}`,
                        distance: distance,
                        duration: data.duration || 0,
                        averagePace: data.averagePace || 0,
                        location: 'treadmill',
                        completedAt: completedAt,
                        createdAt: createdAt
                    });
                });
            }

            // Calculate metrics based on runs
            const totalDistance = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
            const totalRuns = runs.length;
            const totalDuration = runs.reduce((sum, run) => sum + (run.duration || 0), 0);

            // Calculate average pace
            let averagePace = 0;
            const runsWithPace = runs.filter(r => r.averagePace > 0 && r.averagePace < 30);
            if (runsWithPace.length > 0) {
                averagePace = runsWithPace.reduce((sum, r) => sum + r.averagePace, 0) / runsWithPace.length;
            }

            // Calculate streak (consecutive days with runs)
            let streakDays = 0;
            if (runs.length > 0) {
                const runDates = runs
                    .map(r => r.completedAt || r.createdAt)
                    .filter(d => d)
                    .map(d => {
                        const date = new Date(d * 1000);
                        date.setHours(0, 0, 0, 0);
                        return date.getTime();
                    });

                const uniqueDates = [...new Set(runDates)].sort((a, b) => b - a);

                if (uniqueDates.length > 0) {
                    streakDays = 1;
                    const oneDay = 24 * 60 * 60 * 1000;
                    for (let i = 0; i < uniqueDates.length - 1; i++) {
                        if (uniqueDates[i] - uniqueDates[i + 1] === oneDay) {
                            streakDays++;
                        } else {
                            break;
                        }
                    }
                }
            }

            // Calculate metric value based on leaderboardMetric
            let metricValue = 0;
            let formattedValue = '';

            switch (leaderboardMetric) {
                case 'totalDistance':
                    metricValue = totalDistance;
                    formattedValue = `${totalDistance.toFixed(1)} mi`;
                    break;
                case 'runsCompleted':
                    metricValue = totalRuns;
                    formattedValue = `${totalRuns} runs`;
                    break;
                case 'totalTime':
                    metricValue = totalDuration;
                    const minutes = Math.floor(totalDuration / 60);
                    formattedValue = `${minutes} min`;
                    break;
                case 'averagePace':
                    metricValue = averagePace > 0 ? averagePace : 999;
                    if (averagePace > 0) {
                        const paceMin = Math.floor(averagePace);
                        const paceSec = Math.round((averagePace - paceMin) * 60);
                        formattedValue = `${paceMin}:${paceSec.toString().padStart(2, '0')} /mi`;
                    } else {
                        formattedValue = '—';
                    }
                    break;
                case 'streakDays':
                    metricValue = streakDays;
                    formattedValue = `${streakDays} days`;
                    break;
                default:
                    metricValue = totalDistance;
                    formattedValue = `${totalDistance.toFixed(1)} mi`;
            }

            leaderboardEntries.push({
                id: participant.id,
                rank: 0, // Will be set after sorting
                userId: userId,
                username: participant.username,
                profileImageURL: participant.profileImageURL,
                metricValue: metricValue,
                formattedValue: formattedValue,
                totalDistance: totalDistance,
                totalRuns: totalRuns,
                totalDuration: totalDuration,
                averagePace: averagePace,
                streakDays: streakDays
            });
        }

        // Step 3: Sort leaderboard entries by metric value
        const lowerIsBetter = leaderboardMetric === 'averagePace' || leaderboardMetric === 'fastestTime';

        leaderboardEntries.sort((a, b) => {
            if (lowerIsBetter) {
                // For pace/time, handle the case where no runs exist (metricValue = 999)
                if (a.metricValue === 999 && b.metricValue === 999) return 0;
                if (a.metricValue === 999) return 1;
                if (b.metricValue === 999) return -1;
                return a.metricValue - b.metricValue;
            } else {
                return b.metricValue - a.metricValue;
            }
        });

        // Assign ranks
        leaderboardEntries.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        console.log(`✅ Leaderboard calculated with ${leaderboardEntries.length} entries`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                leaderboard: leaderboardEntries,
                count: leaderboardEntries.length,
                challengeId: challengeId,
                leaderboardMetric: leaderboardMetric
            })
        };

    } catch (error) {
        console.error('Error fetching run round leaderboard:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch run round leaderboard',
                details: error.message
            })
        };
    }
};
