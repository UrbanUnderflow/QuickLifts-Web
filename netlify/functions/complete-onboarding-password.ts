import type { Handler } from '@netlify/functions';
import { initAdmin } from './utils/getServiceAccount';

/**
 * complete-onboarding-password
 *
 * Called from the public /onboarding/set-password page.
 * Validates the one-time token, updates the user's Firebase Auth password,
 * marks registration as complete, and invalidates the token.
 *
 * POST body:
 *   token       (required)  – the onboarding token from the URL
 *   password    (required)  – the new password chosen by the user (min 6 chars)
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

    const { token, password } = body;

    if (!token || typeof token !== 'string') {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing required field: token' }),
        };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Password must be at least 6 characters',
            }),
        };
    }

    try {
        const admin = initAdmin();
        const db = admin.firestore();
        const auth = admin.auth();

        // ── Look up the token ────────────────────────────────────────────
        const tokenRef = db.collection('onboarding-tokens').doc(token);
        const tokenSnap = await tokenRef.get();

        if (!tokenSnap.exists) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid or expired onboarding link' }),
            };
        }

        const tokenData = tokenSnap.data()!;

        // ── Validate token state ─────────────────────────────────────────
        if (tokenData.used) {
            return {
                statusCode: 410,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'This onboarding link has already been used. Please sign in with your credentials.',
                }),
            };
        }

        // Check expiration
        const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
        if (new Date() > expiresAt) {
            return {
                statusCode: 410,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'This onboarding link has expired. Please contact the team for a new link.',
                }),
            };
        }

        const userId = tokenData.userId;
        const email = tokenData.email;

        // ── Update the password in Firebase Auth ──────────────────────────
        await auth.updateUser(userId, { password });

        // ── Mark registration complete in Firestore ──────────────────────
        const now = Math.floor(Date.now() / 1000);
        await db.collection('users').doc(userId).update({
            registrationComplete: true,
            updatedAt: now,
            onboardingPasswordSetAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ── Invalidate the token ─────────────────────────────────────────
        await tokenRef.update({
            used: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('[complete-onboarding-password] Password set for user:', email, userId);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                email,
                message: 'Password set successfully. You can now sign in.',
            }),
        };
    } catch (error: any) {
        console.error('[complete-onboarding-password] Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: error.message || 'Internal error' }),
        };
    }
};
