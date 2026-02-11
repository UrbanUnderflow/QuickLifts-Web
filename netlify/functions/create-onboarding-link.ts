import type { Handler } from '@netlify/functions';
import { initAdmin } from './utils/getServiceAccount';
import * as crypto from 'crypto';

/**
 * create-onboarding-link
 *
 * Called by the admin onboarding page. Creates a Firebase Auth user with a random
 * temporary password (the real password will be set by the user later), writes the
 * Firestore user doc with the admin-supplied profile fields, creates a one-time
 * onboarding token, and returns the link the admin can send to the user.
 *
 * POST body:
 *   email       (required)  – user's email
 *   username    (required)  – desired username (3-20 chars, lowercase alphanumeric + underscore)
 *   displayName (optional)  – display name; defaults to username
 *   role        (optional)  – 'athlete' | 'coach', defaults to 'athlete'
 *   age         (optional)  – number
 *   gender      (optional)  – 'man' | 'woman' | "I'd rather self describe"
 *   notes       (optional)  – admin notes / onboarding steps summary
 */
export const handler: Handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
    }

    let body: any;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        };
    }

    const {
        email,
        username,
        displayName,
        role = 'athlete',
        age,
        gender,
        notes,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!email || typeof email !== 'string') {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing required field: email' }),
        };
    }

    if (!username || typeof username !== 'string') {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing required field: username' }),
        };
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Username must be 3-20 characters: lowercase letters, numbers, underscore only',
            }),
        };
    }

    try {
        const admin = initAdmin();
        const db = admin.firestore();
        const auth = admin.auth();

        // ── Check username availability ───────────────────────────────────
        const usernameSnap = await db.collection('usernames').doc(normalizedUsername).get();
        if (usernameSnap.exists) {
            return {
                statusCode: 409,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Username is already taken' }),
            };
        }

        // ── Check if email already exists in Firebase Auth ────────────────
        let existingUser: any = null;
        try {
            existingUser = await auth.getUserByEmail(email.trim().toLowerCase());
        } catch (e: any) {
            if (e.code !== 'auth/user-not-found') throw e;
        }

        if (existingUser) {
            return {
                statusCode: 409,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'An account with this email already exists' }),
            };
        }

        // ── Create Firebase Auth user with a random temporary password ────
        const tempPassword = crypto.randomBytes(32).toString('hex');
        const userRecord = await auth.createUser({
            email: email.trim().toLowerCase(),
            password: tempPassword,
            displayName: displayName || normalizedUsername,
        });

        const uid = userRecord.uid;

        // ── Claim the username ────────────────────────────────────────────
        await db.collection('usernames').doc(normalizedUsername).set({
            userId: uid,
            username: normalizedUsername,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ── Compute birthdate from age (approximate) ─────────────────────
        let birthdateTimestamp: number | null = null;
        if (age && typeof age === 'number' && age > 0) {
            const birthYear = new Date().getFullYear() - age;
            birthdateTimestamp = Math.floor(new Date(birthYear, 0, 1).getTime() / 1000);
        }

        // ── Create Firestore user document ────────────────────────────────
        const now = Math.floor(Date.now() / 1000);
        const userData: any = {
            id: uid,
            email: email.trim().toLowerCase(),
            username: normalizedUsername,
            displayName: displayName || normalizedUsername,
            role: role === 'coach' ? 'coach' : 'athlete',
            registrationComplete: false, // Will be set to true when password is chosen
            subscriptionType: 'Unsubscribed',
            subscriptionPlatform: 'web',
            level: 'novice',
            goal: [],
            bodyWeight: [],
            macros: {},
            profileImage: {
                profileImageURL: '',
                imageOffsetWidth: 0,
                imageOffsetHeight: 0,
            },
            bio: '',
            additionalGoals: '',
            blockedUsers: [],
            encouragement: [],
            isCurrentlyActive: false,
            videoCount: 0,
            creator: null,
            winner: null,
            featuredRoundIds: [],
            checkinsPrivacy: 'privateOnly',
            checkinsAccessList: [],
            createdAt: now,
            updatedAt: now,
            onboardingMethod: 'admin-invite', // flag for tracking
        };

        if (birthdateTimestamp) userData.birthdate = birthdateTimestamp;
        if (gender) userData.gender = gender;

        await db.collection('users').doc(uid).set(userData);

        // ── Generate a one-time onboarding token ─────────────────────────
        const token = crypto.randomBytes(48).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.collection('onboarding-tokens').doc(token).set({
            userId: uid,
            email: email.trim().toLowerCase(),
            username: normalizedUsername,
            token,
            used: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            adminNotes: notes || '',
        });

        // ── Build the onboarding link ────────────────────────────────────
        const baseUrl = process.env.URL || 'https://fitwithpulse.ai';
        const onboardingLink = `${baseUrl}/onboarding/set-password?token=${token}`;

        console.log('[create-onboarding-link] Created onboarding for:', email, '→', onboardingLink);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                userId: uid,
                username: normalizedUsername,
                onboardingLink,
                token,
                expiresAt: expiresAt.toISOString(),
            }),
        };
    } catch (error: any) {
        console.error('[create-onboarding-link] Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: error.message || 'Internal error' }),
        };
    }
};
