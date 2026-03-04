/**
 * Game Level Progress Service
 * 
 * Manages tier/level progression for mental training games.
 * This is game-agnostic infrastructure — any game with tiers (Kill Switch, etc.)
 * stores and reads its progression data through this service.
 * 
 * Firestore path: game-level-progress/{userId}/games/{gameType}
 */

import { db } from '../config';
import {
    doc,
    getDoc,
    setDoc,
} from 'firebase/firestore';
import {
    GameLevelProgress,
    TierSessionRecord,
    TierAdvancementResult,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTION = 'game-level-progress';
const SUB_COLLECTION = 'games';

// How many sessions at a tier before you can advance
const MIN_SESSIONS_FOR_ADVANCEMENT = 3;
// How many of the last N sessions must qualify
const QUALIFYING_SESSION_COUNT = 2; // out of 3
// Max tier history to keep (prevent unbounded growth)
const MAX_TIER_HISTORY = 10;

// Tier-specific recovery targets (in seconds)
const TIER_RECOVERY_TARGETS: Record<number, number> = {
    1: 3.0,  // Foundation
    2: 2.0,  // Sharpening
    3: 1.5,  // Pressure
    4: 1.0,  // Elite
};

// Max consistency index (std dev) to qualify
const MAX_CONSISTENCY_INDEX = 0.8;
// Min resilience score (%) to qualify
const MIN_RESILIENCE_SCORE = 70;
// Max tier
const MAX_TIER = 4;

// ============================================================================
// SERVICE
// ============================================================================

export const gameLevelProgressService = {

    /**
     * Get a user's progress for a specific game
     */
    async getProgress(userId: string, gameType: string): Promise<GameLevelProgress> {
        const docRef = doc(db, COLLECTION, userId, SUB_COLLECTION, gameType);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            // Return default progress (Tier 1, no history)
            return {
                userId,
                gameType,
                currentTier: 1,
                tierHistory: [],
                totalSessions: 0,
                lastPlayedAt: 0,
                unlockedTiers: [1],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        const data = snap.data();
        return {
            userId: data.userId ?? userId,
            gameType: data.gameType ?? gameType,
            currentTier: data.currentTier ?? 1,
            tierHistory: data.tierHistory ?? [],
            totalSessions: data.totalSessions ?? 0,
            bestAvgRecoveryTime: data.bestAvgRecoveryTime,
            lastPlayedAt: data.lastPlayedAt ?? 0,
            unlockedTiers: data.unlockedTiers ?? [1],
            createdAt: data.createdAt ?? Date.now(),
            updatedAt: data.updatedAt ?? Date.now(),
        };
    },

    /**
     * Record a session and check for tier advancement
     * Returns the updated progress AND whether advancement happened
     */
    async recordSession(
        userId: string,
        gameType: string,
        session: TierSessionRecord
    ): Promise<{ progress: GameLevelProgress; advanced: boolean; advancementResult: TierAdvancementResult }> {
        const progress = await this.getProgress(userId, gameType);
        const now = Date.now();

        // Add session to history (keep last MAX_TIER_HISTORY for current tier)
        const updatedHistory = [...progress.tierHistory, session]
            .filter(s => s.tier === session.tier)
            .slice(-MAX_TIER_HISTORY);

        // Update best recovery time
        const bestRecovery = progress.bestAvgRecoveryTime
            ? Math.min(progress.bestAvgRecoveryTime, session.avgRecoveryTime)
            : session.avgRecoveryTime;

        // Check advancement
        const advancementResult = this.checkAdvancement(updatedHistory, session.tier);

        // If advancing, update tier and unlocked tiers
        let newTier = progress.currentTier;
        let newUnlocked = [...progress.unlockedTiers];
        let advanced = false;

        if (advancementResult.canAdvance && advancementResult.nextTier) {
            newTier = advancementResult.nextTier;
            if (!newUnlocked.includes(newTier)) {
                newUnlocked.push(newTier);
                newUnlocked.sort((a, b) => a - b);
            }
            advanced = true;
        }

        const updatedProgress: GameLevelProgress = {
            ...progress,
            currentTier: newTier,
            tierHistory: advanced ? [] : updatedHistory, // Reset history when advancing
            totalSessions: progress.totalSessions + 1,
            bestAvgRecoveryTime: bestRecovery,
            lastPlayedAt: now,
            unlockedTiers: newUnlocked,
            updatedAt: now,
        };

        // Save to Firestore
        const docRef = doc(db, COLLECTION, userId, SUB_COLLECTION, gameType);
        await setDoc(docRef, updatedProgress, { merge: true });

        return { progress: updatedProgress, advanced, advancementResult };
    },

    /**
     * Check if a user can advance to the next tier
     */
    checkAdvancement(
        tierHistory: TierSessionRecord[],
        currentTier: number
    ): TierAdvancementResult {
        const result: TierAdvancementResult = {
            canAdvance: false,
            nextTier: currentTier < MAX_TIER ? currentTier + 1 : null,
            qualifyingSessions: 0,
            requiredSessions: MIN_SESSIONS_FOR_ADVANCEMENT,
            metTargetCount: 0,
            consistencyCount: 0,
            resilienceCount: 0,
            reasons: [],
        };

        // Can't advance past max tier
        if (currentTier >= MAX_TIER) {
            result.nextTier = null;
            result.reasons.push('Already at Elite tier');
            return result;
        }

        // Need minimum sessions
        const sessionsAtTier = tierHistory.filter(s => s.tier === currentTier);
        if (sessionsAtTier.length < MIN_SESSIONS_FOR_ADVANCEMENT) {
            result.qualifyingSessions = sessionsAtTier.length;
            result.reasons.push(
                `Need ${MIN_SESSIONS_FOR_ADVANCEMENT} sessions at this tier (${sessionsAtTier.length} completed)`
            );
            return result;
        }

        // Check last 3 sessions
        const lastThree = sessionsAtTier.slice(-MIN_SESSIONS_FOR_ADVANCEMENT);

        // Count qualifying metrics
        result.metTargetCount = lastThree.filter(s => s.metTarget).length;
        result.consistencyCount = lastThree.filter(s => s.consistencyIndex < MAX_CONSISTENCY_INDEX).length;
        result.resilienceCount = lastThree.filter(s => s.resilienceScore >= MIN_RESILIENCE_SCORE).length;

        // Check each criterion
        const targetMet = result.metTargetCount >= QUALIFYING_SESSION_COUNT;
        const consistencyMet = result.consistencyCount >= QUALIFYING_SESSION_COUNT;
        const resilienceMet = result.resilienceCount >= QUALIFYING_SESSION_COUNT;

        if (!targetMet) {
            const target = TIER_RECOVERY_TARGETS[currentTier] ?? 3.0;
            result.reasons.push(
                `Recovery target (< ${target.toFixed(1)}s): ${result.metTargetCount}/${MIN_SESSIONS_FOR_ADVANCEMENT} sessions`
            );
        }
        if (!consistencyMet) {
            result.reasons.push(
                `Consistency (< ${MAX_CONSISTENCY_INDEX}s variance): ${result.consistencyCount}/${MIN_SESSIONS_FOR_ADVANCEMENT} sessions`
            );
        }
        if (!resilienceMet) {
            result.reasons.push(
                `Resilience (≥ ${MIN_RESILIENCE_SCORE}%): ${result.resilienceCount}/${MIN_SESSIONS_FOR_ADVANCEMENT} sessions`
            );
        }

        result.qualifyingSessions = sessionsAtTier.length;
        result.canAdvance = targetMet && consistencyMet && resilienceMet;

        return result;
    },

    /**
     * Manually set a user's tier (admin override)
     */
    async setTier(userId: string, gameType: string, tier: number): Promise<void> {
        const progress = await this.getProgress(userId, gameType);
        const newUnlocked = [...new Set([...progress.unlockedTiers, tier])].sort((a, b) => a - b);

        const docRef = doc(db, COLLECTION, userId, SUB_COLLECTION, gameType);
        await setDoc(docRef, {
            ...progress,
            currentTier: tier,
            tierHistory: [], // Reset history for new tier
            unlockedTiers: newUnlocked,
            updatedAt: Date.now(),
        }, { merge: true });
    },

    /**
     * Allow user to select a previously unlocked tier
     */
    async selectTier(userId: string, gameType: string, tier: number): Promise<boolean> {
        const progress = await this.getProgress(userId, gameType);
        if (!progress.unlockedTiers.includes(tier)) {
            return false; // Can't select a locked tier
        }

        const docRef = doc(db, COLLECTION, userId, SUB_COLLECTION, gameType);
        await setDoc(docRef, {
            currentTier: tier,
            tierHistory: progress.tierHistory.filter(s => s.tier === tier), // Keep only relevant history
            updatedAt: Date.now(),
        }, { merge: true });

        return true;
    },
};
