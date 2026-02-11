#!/usr/bin/env node

/**
 * Nora Email Bridge — Gmail ↔ Agent Runner
 *
 * This script polls Gmail for new emails sent to nora@fitwithpulse.ai,
 * classifies the sender, writes the email as a task/command into Firestore,
 * and sends replies via Brevo.
 *
 * Security:
 *   - Accepts emails from anyone (internal + external)
 *   - Tags senders as 'internal' (@fitwithpulse.ai) or 'external'
 *   - Content guardrails prevent sharing sensitive info with external senders
 *
 * Requirements:
 *   1. Gmail API enabled in Google Cloud Console
 *   2. OAuth2 credentials (client_id, client_secret, refresh_token)
 *   3. BREVO_API_KEY for sending replies
 *   4. Firebase service account for Firestore
 *
 * Environment variables:
 *   GMAIL_CLIENT_ID       — Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET   — Google OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN   — OAuth2 refresh token (generated once via setup)
 *   GMAIL_USER_EMAIL      — The Gmail account to read from (e.g. tre@fitwithpulse.ai)
 *   BREVO_API_KEY         — Brevo transactional API key
 *   NORA_REPLY_EMAIL      — Reply-from address (default: nora@fitwithpulse.ai)
 *   ALLOWED_DOMAIN        — Allowed sender domain (default: fitwithpulse.ai)
 *   POLL_INTERVAL_MS      — How often to check Gmail in ms (default: 30000)
 *   AGENT_ID              — This agent's Firestore ID (default: nora)
 *
 * Usage:
 *   node scripts/emailBridge.js
 *
 * First-time setup (generates refresh token):
 *   node scripts/emailBridge.js --setup
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

/* ─── Configuration ───────────────────────────────────── */

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
let GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GMAIL_USER_EMAIL = process.env.GMAIL_USER_EMAIL || 'tre@fitwithpulse.ai';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const NORA_REPLY_EMAIL = process.env.NORA_REPLY_EMAIL || 'nora@fitwithpulse.ai';
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'fitwithpulse.ai';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
const AGENT_ID = process.env.AGENT_ID || 'nora';
const AGENT_NAME = process.env.AGENT_NAME || 'Nora';

const EMAILS_COLLECTION = 'nora-emails';       // Log of all processed emails
const COMMANDS_COLLECTION = 'agent-commands';     // Where agent runner picks up tasks
const PRESENCE_COLLECTION = 'agent-presence';

const TOKEN_FILE = path.join(__dirname, '..', '.gmail-token.json');

/* ─── Firebase Admin Init ─────────────────────────────── */

let app;
try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        || path.join(__dirname, '..', 'service-account.json');
    const serviceAccount = require(serviceAccountPath);
    app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: 'quicklifts-dd3f1.appspot.com',
    });
} catch (e) {
    console.log('⚠️  No service account found, trying default credentials...');
    app = initializeApp({ storageBucket: 'quicklifts-dd3f1.appspot.com' });
}

const db = getFirestore(app);
const bucket = getStorage(app).bucket();

/* ─── Gmail OAuth2 ────────────────────────────────────── */

let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Get a fresh access token using the refresh token.
 */
async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt - 60000) {
        return accessToken;
    }

    // Try loading refresh token from file if not in env
    if (!GMAIL_REFRESH_TOKEN && fs.existsSync(TOKEN_FILE)) {
        const stored = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        GMAIL_REFRESH_TOKEN = stored.refresh_token;
    }

    if (!GMAIL_REFRESH_TOKEN) {
        throw new Error('No GMAIL_REFRESH_TOKEN configured. Run: node scripts/emailBridge.js --setup');
    }

    const body = new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
    });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Failed to refresh token: ${err}`);
    }

    const data = await resp.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return accessToken;
}

/**
 * Call the Gmail API.
 */
async function gmailApi(endpoint, options = {}) {
    const token = await getAccessToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`;
    const resp = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gmail API error (${resp.status}): ${err}`);
    }

    return resp.json();
}

/* ─── Email Parsing ───────────────────────────────────── */

function decodeBase64Url(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function getHeader(headers, name) {
    const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
}

function extractSenderEmail(from) {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

function extractSenderName(from) {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : '';
}

/**
 * Extract the plain-text body from a Gmail message payload.
 */
function extractBody(payload) {
    // Simple single-part message
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    // Multipart — look for text/plain first, then text/html
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64Url(part.body.data);
            }
        }
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
                // Strip HTML tags for plain text
                return decodeBase64Url(part.body.data).replace(/<[^>]*>/g, '').trim();
            }
        }
        // Nested multipart
        for (const part of payload.parts) {
            if (part.parts) {
                const nested = extractBody(part);
                if (nested) return nested;
            }
        }
    }

    return '';
}

/**
 * Clean up the email body — remove quoted replies and signatures.
 */
function cleanEmailBody(body) {
    // Remove everything after common reply markers
    const markers = [
        /^On .+ wrote:$/m,
        /^>.*$/m,
        /^--\s*$/m,
        /^_{5,}$/m,
        /^-{5,}$/m,
        /^Sent from my/m,
        /^Get Outlook for/m,
    ];

    let cleaned = body;
    for (const marker of markers) {
        const match = cleaned.match(marker);
        if (match) {
            cleaned = cleaned.substring(0, match.index).trim();
            break;
        }
    }

    return cleaned.trim();
}

/* ─── Sender Classification ───────────────────────────── */

/**
 * Classify sender as 'internal' (team) or 'external'.
 * Internal senders get full access; external senders get content-guarded responses.
 */
function classifySender(email) {
    const domain = email.split('@')[1];
    return domain === ALLOWED_DOMAIN ? 'internal' : 'external';
}

/* ─── Firestore: Track Processed Emails ───────────────── */

async function isEmailProcessed(messageId) {
    const snap = await db.collection(EMAILS_COLLECTION).doc(messageId).get();
    return snap.exists;
}

async function markEmailProcessed(messageId, emailData) {
    await db.collection(EMAILS_COLLECTION).doc(messageId).set({
        ...emailData,
        processedAt: FieldValue.serverTimestamp(),
    });
}

/* ─── Create Agent Command from Email ─────────────────── */

async function createAgentCommand(emailData) {
    const senderType = classifySender(emailData.senderEmail);

    const docRef = await db.collection(COMMANDS_COLLECTION).add({
        from: `email:${emailData.senderEmail}`,
        to: AGENT_ID,
        type: 'email',
        content: emailData.body,
        metadata: {
            subject: emailData.subject,
            senderName: emailData.senderName,
            senderEmail: emailData.senderEmail,
            senderType,  // 'internal' or 'external'
            gmailMessageId: emailData.messageId,
            gmailThreadId: emailData.threadId,
            receivedAt: emailData.receivedAt,
        },
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`📋 Created agent command (${senderType}): ${docRef.id}`);
    return docRef.id;
}

/* ─── Send Reply via Brevo ────────────────────────────── */

async function sendReply(toEmail, toName, subject, bodyText, uploadedLinks = []) {
    if (!BREVO_API_KEY) {
        console.error('❌ No BREVO_API_KEY set — cannot send reply.');
        return null;
    }

    // Build the reply HTML
    const linksHtml = uploadedLinks.length > 0
        ? `<div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:8px;">
             <p style="margin:0 0 8px 0;font-weight:600;font-size:13px;">📎 Attached Files:</p>
             ${uploadedLinks.map(l => `<a href="${l.url}" style="display:block;color:#6366f1;font-size:13px;margin-bottom:4px;">${l.name}</a>`).join('')}
           </div>`
        : '';

    const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:18px;">⚡</span>
        </div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#111;">Nora</div>
          <div style="font-size:11px;color:#6b7280;">Director of System Ops · Pulse</div>
        </div>
      </div>
      <div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap;">${escapeHtml(bodyText)}</div>
      ${linksHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="font-size:11px;color:#9ca3af;margin:0;">
          This reply was generated by Nora, Pulse's AI ops agent. For urgent issues, contact tre@fitwithpulse.ai directly.
        </p>
      </div>
    </div>`;

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

    const payload = {
        sender: { name: `Nora (Pulse)`, email: NORA_REPLY_EMAIL },
        to: [{ email: toEmail, name: toName || toEmail }],
        subject: replySubject,
        htmlContent: html,
        replyTo: { email: NORA_REPLY_EMAIL, name: 'Nora' },
        tags: ['nora-reply'],
    };

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error(`❌ Brevo error: ${err?.message || resp.status}`);
        return null;
    }

    const data = await resp.json();
    console.log(`📧 Reply sent to ${toEmail} (messageId: ${data?.messageId})`);
    return data?.messageId;
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ─── File Upload to Firebase Storage ─────────────────── */

/**
 * Upload a file to Firebase Storage and return the public URL.
 * For when Nora needs to attach a file to an email reply.
 */
async function uploadFile(filePath, destinationName) {
    const timestamp = Date.now();
    const dest = `nora-uploads/${timestamp}_${destinationName || path.basename(filePath)}`;

    await bucket.upload(filePath, {
        destination: dest,
        metadata: {
            metadata: {
                uploadedBy: AGENT_ID,
                uploadedAt: new Date().toISOString(),
            },
        },
    });

    // Make publicly readable
    await bucket.file(dest).makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log(`📤 Uploaded: ${dest} → ${url}`);
    return { name: destinationName || path.basename(filePath), url };
}

/* ─── Main Poll Loop ──────────────────────────────────── */

let lastCheckTimestamp = null;

async function pollInbox() {
    try {
        // Build Gmail search query: only emails to nora@, not already replied to
        const query = `to:${NORA_REPLY_EMAIL} is:unread newer_than:1d`;

        const listResp = await gmailApi(`messages?q=${encodeURIComponent(query)}&maxResults=10`);

        if (!listResp.messages || listResp.messages.length === 0) {
            return; // No new messages
        }

        console.log(`\n📬 Found ${listResp.messages.length} unread email(s) for Nora`);

        for (const msg of listResp.messages) {
            // Skip if already processed
            if (await isEmailProcessed(msg.id)) continue;

            // Fetch full message
            const fullMsg = await gmailApi(`messages/${msg.id}?format=full`);
            const headers = fullMsg.payload?.headers || [];

            const from = getHeader(headers, 'From');
            const subject = getHeader(headers, 'Subject');
            const date = getHeader(headers, 'Date');
            const messageIdHeader = getHeader(headers, 'Message-ID');

            const senderEmail = extractSenderEmail(from);
            const senderName = extractSenderName(from) || senderEmail.split('@')[0];
            const senderType = classifySender(senderEmail);

            console.log(`   Sender type: ${senderType === 'internal' ? '🏠 internal' : '🌐 external'}`);

            // Extract body text
            const rawBody = extractBody(fullMsg.payload);
            const body = cleanEmailBody(rawBody);

            if (!body.trim()) {
                console.log(`⚠️  Empty body from ${senderEmail}, skipping`);
                await markEmailProcessed(msg.id, { senderEmail, subject, status: 'skipped', reason: 'empty_body' });
                continue;
            }

            const emailData = {
                messageId: msg.id,
                threadId: fullMsg.threadId,
                senderEmail,
                senderName,
                subject,
                body,
                receivedAt: date,
                messageIdHeader,
            };

            console.log(`\n📨 New email from ${senderName} (${senderEmail})`);
            console.log(`   Subject: ${subject}`);
            console.log(`   Body: "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`);

            // Store in Firestore
            await markEmailProcessed(msg.id, { ...emailData, status: 'received' });

            // Create an agent command for Nora to process
            await createAgentCommand(emailData);

            // Mark as read in Gmail
            await gmailApi(`messages/${msg.id}/modify`, {
                method: 'POST',
                body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
            });

            // Send acknowledgment (optional — Nora's agent runner will send the real reply)
            await sendReply(
                senderEmail,
                senderName,
                subject,
                `Hi ${senderName},\n\nThanks for reaching out! I've received your message and I'm working on it.\n\nI'll follow up shortly with a detailed response.\n\n— Nora`,
            );
        }

    } catch (err) {
        console.error(`❌ Poll error: ${err.message}`);
    }
}

/* ─── Watch for Completed Email Responses ─────────────── */

/**
 * Listen for completed email commands and send the response via email.
 * When the agent runner completes an email command, it sets status='completed'
 * and includes a response — we then send that as a reply via Brevo.
 */
function startResponseListener() {
    console.log('📡 Listening for email response completions...');

    const query = db.collection(COMMANDS_COLLECTION)
        .where('to', '==', AGENT_ID)
        .where('type', '==', 'email')
        .where('status', '==', 'completed');

    return query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added' || change.type === 'modified') {
                const doc = change.doc;
                const data = doc.data();

                // Check if we already sent the reply
                if (data.emailReplySent) return;

                const meta = data.metadata || {};
                const senderEmail = meta.senderEmail;
                const senderName = meta.senderName;
                const subject = meta.subject;
                const response = data.response;

                if (!senderEmail || !response) return;

                console.log(`\n📤 Sending email reply to ${senderEmail}...`);

                // Parse any uploaded file links from the response
                const uploadedLinks = data.uploadedLinks || [];

                const messageId = await sendReply(
                    senderEmail,
                    senderName,
                    subject || 'Re: Your message',
                    response,
                    uploadedLinks,
                );

                // Mark as sent so we don't send again
                await doc.ref.update({
                    emailReplySent: true,
                    emailReplyMessageId: messageId,
                    emailReplySentAt: FieldValue.serverTimestamp(),
                });
            }
        });
    });
}

/* ─── OAuth2 Setup Flow ───────────────────────────────── */

async function runSetup() {
    console.log('\n🔐 Gmail OAuth2 Setup\n');
    console.log('This will generate a refresh token for reading Gmail.\n');

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
        console.error('❌ Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables first.');
        console.log('\nTo get these:');
        console.log('  1. Go to https://console.cloud.google.com/apis/credentials');
        console.log('  2. Create an OAuth 2.0 Client ID (type: Desktop App)');
        console.log('  3. Copy the client ID and client secret');
        console.log('  4. Enable the Gmail API at https://console.cloud.google.com/apis/library/gmail.googleapis.com');
        process.exit(1);
    }

    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GMAIL_CLIENT_ID}&` +
        `redirect_uri=http://localhost:3456&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent`;

    console.log('1. Open this URL in your browser:\n');
    console.log(`   ${authUrl}\n`);
    console.log('2. Sign in with the Google account that has nora@fitwithpulse.ai');
    console.log('3. Grant access to Gmail');
    console.log('4. You will be redirected to localhost — the code will be captured automatically.\n');

    // Start a temporary local server to catch the redirect
    return new Promise((resolve) => {
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url, 'http://localhost:3456');
            const code = url.searchParams.get('code');

            if (!code) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>Error: No authorization code received</h1>');
                return;
            }

            try {
                // Exchange the authorization code for tokens
                const tokenBody = new URLSearchParams({
                    code,
                    client_id: GMAIL_CLIENT_ID,
                    client_secret: GMAIL_CLIENT_SECRET,
                    redirect_uri: 'http://localhost:3456',
                    grant_type: 'authorization_code',
                });

                const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: tokenBody.toString(),
                });

                const tokenData = await tokenResp.json();

                if (tokenData.error) {
                    throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
                }

                // Save the refresh token
                fs.writeFileSync(TOKEN_FILE, JSON.stringify({
                    refresh_token: tokenData.refresh_token,
                    created_at: new Date().toISOString(),
                }, null, 2));

                console.log('\n✅ Success! Refresh token saved to .gmail-token.json');
                console.log('\nYou can now run: node scripts/emailBridge.js');
                console.log('\nOr set GMAIL_REFRESH_TOKEN in your environment:');
                console.log(`   GMAIL_REFRESH_TOKEN="${tokenData.refresh_token}"\n`);

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0b;color:white;">
                    <div style="text-align:center;">
                        <h1>✅ Gmail Connected!</h1>
                        <p>Nora can now read and reply to emails.</p>
                        <p style="color:#71717a;">You can close this tab.</p>
                    </div>
                    </body></html>
                `);
            } catch (err) {
                console.error(`\n❌ Error exchanging code: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<h1>Error: ${err.message}</h1>`);
            }

            server.close();
            resolve();
        });

        server.listen(3456, () => {
            console.log('⏳ Waiting for authorization redirect on http://localhost:3456...\n');
        });
    });
}

/* ─── Main ────────────────────────────────────────────── */

async function main() {
    // Check for setup mode
    if (process.argv.includes('--setup')) {
        await runSetup();
        process.exit(0);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   📧 Nora Email Bridge                  ║');
    console.log('║   Polling: nora@fitwithpulse.ai         ║');
    console.log('║   Access: open (content-guarded)        ║');
    console.log(`║   Interval: ${(POLL_INTERVAL_MS / 1000).toFixed(0)}s                        ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // Validate config
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
        console.error('❌ Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET');
        console.log('   Run: node scripts/emailBridge.js --setup');
        process.exit(1);
    }

    if (!BREVO_API_KEY) {
        console.warn('⚠️  No BREVO_API_KEY set — replies will be logged but not sent.');
    }

    // Verify Gmail access
    try {
        await getAccessToken();
        console.log('✅ Gmail API connected');
    } catch (err) {
        console.error(`❌ Gmail auth failed: ${err.message}`);
        console.log('   Run: node scripts/emailBridge.js --setup');
        process.exit(1);
    }

    // Start listening for completed email responses
    const unsubscribe = startResponseListener();

    // Run initial poll
    await pollInbox();

    // Start polling loop
    const pollTimer = setInterval(pollInbox, POLL_INTERVAL_MS);

    // Graceful shutdown
    const shutdown = () => {
        console.log('\n👋 Shutting down email bridge...');
        clearInterval(pollTimer);
        if (typeof unsubscribe === 'function') unsubscribe();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('📬 Email bridge is running. Ctrl+C to stop.\n');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
