const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[SyncRevenueCat] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[SyncRevenueCat] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

async function fetchRevenueCatSubscriberWithKey(userId, apiKey, projectLabel, projectId) {
  // V2 API: Prefer project-scoped endpoint if projectId is provided
  const url = projectId
    ? `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}`
    : `https://api.revenuecat.com/v2/customers/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (res.status === 404) {
    console.warn(`[SyncRevenueCat] ${projectLabel} 404 for app_user_id`, { userId });
    return null; // caller will try other candidate IDs
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RevenueCat V2 error ${res.status}: ${text}`);
  }
  return await res.json();
}

function parseLatestExpiration(rcJson, projectLabel) {
  let latest = null;
  console.log(`[SyncRevenueCat] Raw RC V2 response for ${projectLabel}:`, JSON.stringify(rcJson, null, 2));
  try {
    // V2 API structure: customer.entitlements and customer.subscriptions
    const customer = rcJson?.customer || rcJson?.subscriber || rcJson; // Handle different response structures
    const entitlements = customer?.entitlements || {};
    console.log(`[SyncRevenueCat] V2 Entitlements for ${projectLabel}:`, Object.keys(entitlements));
    
    for (const key of Object.keys(entitlements)) {
      const entitlement = entitlements[key];
      const exp = entitlement?.expires_date || entitlement?.expiration_date; // Try both field names
      console.log(`[SyncRevenueCat] V2 Entitlement ${key} expires_date:`, exp, 'isActive:', entitlement?.is_active);
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d)) {
          if (!latest || d > latest) latest = d;
        }
      }
    }
    
    // Fallback: scan subscriptions map
    const subs = customer?.subscriptions || {};
    console.log(`[SyncRevenueCat] V2 Subscriptions for ${projectLabel}:`, Object.keys(subs));
    for (const key of Object.keys(subs)) {
      const subscription = subs[key];
      const exp = subscription?.expires_date || subscription?.expiration_date;
      console.log(`[SyncRevenueCat] V2 Subscription ${key} expires_date:`, exp);
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d)) {
          if (!latest || d > latest) latest = d;
        }
      }
    }
  } catch (e) {
    console.warn('[SyncRevenueCat] parseLatestExpiration error:', e);
  }
  console.log(`[SyncRevenueCat] Final latest expiration for ${projectLabel}:`, latest);
  return latest;
}

function extractRcIdentifiers(rcJson) {
  try {
    const customer = rcJson?.customer || rcJson?.subscriber || rcJson || {};
    const ids = new Set();
    if (customer.app_user_id) ids.add(customer.app_user_id);
    if (Array.isArray(customer.aliases)) customer.aliases.forEach((a) => a && ids.add(a));
    if (Array.isArray(customer.app_user_ids)) customer.app_user_ids.forEach((a) => a && ids.add(a));
    // Attributes may contain email
    const attrs = customer.attributes || customer.subscriber_attributes || {};
    const rcEmail = attrs.email?.value || attrs.email_address?.value || attrs['E - mail']?.value || null;
    return { ids: Array.from(ids), rcEmail };
  } catch (_) {
    return { ids: [], rcEmail: null };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
  }

  const { userId } = body;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  try {
    // Map API keys to project labels and optional project IDs (V2)
    const keyConfigs = [];
    if (process.env.REVENUECAT_API_KEY_QUICKLIFTS) {
      keyConfigs.push({
        key: process.env.REVENUECAT_API_KEY_QUICKLIFTS,
        label: 'quicklifts',
        projectId: process.env.REVENUECAT_PROJECT_ID_QUICKLIFTS || process.env.REVENUECAT_PROJECT_ID
      });
    }
    if (process.env.REVENUECAT_API_KEY_PULSECHECK) {
      keyConfigs.push({
        key: process.env.REVENUECAT_API_KEY_PULSECHECK,
        label: 'pulsecheck',
        projectId: process.env.REVENUECAT_PROJECT_ID_PULSECHECK || process.env.REVENUECAT_PROJECT_ID
      });
    }
    if (process.env.REVENUECAT_API_KEY && !keyConfigs.some(k => k.key === process.env.REVENUECAT_API_KEY)) {
      keyConfigs.push({
        key: process.env.REVENUECAT_API_KEY,
        label: 'default',
        projectId: process.env.REVENUECAT_PROJECT_ID || null
      });
    }

    const keys = keyConfigs.map(k => k.key);

    if (!keys.length) {
      console.warn('[SyncRevenueCat] Missing RC envs', {
        hasDefault: !!process.env.REVENUECAT_API_KEY,
        hasQuicklifts: !!process.env.REVENUECAT_API_KEY_QUICKLIFTS,
        hasPulsecheck: !!process.env.REVENUECAT_API_KEY_PULSECHECK,
      });
      throw new Error('Missing REVENUECAT_API_KEY or project-specific keys');
    }

    // Build candidate identifiers for RC lookup: Firebase uid + common aliases
    let userEmail = null;
    let username = null;
    let rcAppUserId = null;
    let rcAliases = [];
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data();
        userEmail = ud?.email || null;
        username = ud?.username || null;
        rcAppUserId = ud?.rcAppUserId || ud?.revenuecat?.appUserId || null;
        if (Array.isArray(ud?.revenuecat?.aliases)) rcAliases = rcAliases.concat(ud.revenuecat.aliases.filter(Boolean));
      }
    } catch (_) {}
    try {
      const subSnap = await db.collection('subscriptions').doc(userId).get();
      if (subSnap.exists) {
        const sd = subSnap.data();
        if (!rcAppUserId && sd?.rcAppUserId) rcAppUserId = sd.rcAppUserId;
        if (Array.isArray(sd?.rcAliases)) rcAliases = rcAliases.concat(sd.rcAliases.filter(Boolean));
      }
    } catch (_) {}

    const candidates = Array.from(new Set([userId, username, userEmail, rcAppUserId, ...rcAliases].filter(Boolean)));
    console.log('[SyncRevenueCat] Attempting RC sync with', {
      userId,
      candidates,
      keyCount: keyConfigs.length,
      projectIds: keyConfigs.map(k => ({ label: k.label, projectId: k.projectId ? 'set' : 'unset' }))
    });

    let latestExpiration = null;
    let latestSourceProject = null;
    let latestRcJson = null;
    let discoveredIds = new Set();
    let discoveredEmail = null;
    let tried = 0;
    for (const cfg of keyConfigs) {
      const projectLabel = cfg.label;
      const projectId = cfg.projectId || null;

      for (const candidate of candidates) {
        tried++;
        try {
          const rc = await fetchRevenueCatSubscriberWithKey(candidate, cfg.key, projectLabel, projectId);
          if (!rc) {
            console.log('[SyncRevenueCat] No RC record for candidate', { project: projectLabel, candidate });
            continue;
          }
          const exp = parseLatestExpiration(rc, projectLabel);
          console.log('[SyncRevenueCat] fetched', { project: projectLabel, candidate, hasExpiration: !!exp, tried });
          if (exp && (!latestExpiration || exp > latestExpiration)) {
            latestExpiration = exp;
            latestSourceProject = projectLabel;
            latestRcJson = rc;
          }
          const meta = extractRcIdentifiers(rc);
          meta.ids.forEach((v) => discoveredIds.add(v));
          if (meta.rcEmail && !discoveredEmail) discoveredEmail = meta.rcEmail;
          if (exp) break; // stop trying other candidates for this project once we have an expiration
        } catch (e) {
          console.warn(`[SyncRevenueCat] fetch error for project ${projectLabel} candidate ${candidate}:`, e.message);
        }
      }
    }

    if (!latestExpiration) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No expiration found from any RevenueCat project' }) };
    }

    // Upsert iOS subscription doc for this user and append to plans (append-only)
    // Use userId as the subscription document ID
    const subRef = db.collection('subscriptions').doc(userId);
    // userEmail and username already read above
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Math.floor(latestExpiration.getTime() / 1000);

    await subRef.set({
      userId,
      userEmail,
      username,
      platform: 'ios',
      source: 'revenuecat',
      sourceProject: latestSourceProject,
      rcAppUserId: Array.from(discoveredIds)[0] || null,
      rcAliases: Array.from(discoveredIds),
      updatedAt: admin.firestore.Timestamp.fromMillis(nowSec * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Determine plan type from product identifier if available in RC data
    let planType = null;
    try {
      const customer = latestRcJson?.customer || latestRcJson?.subscriber || latestRcJson;
      const entitlements = customer?.entitlements || {};
      const anyEnt = Object.values(entitlements)[0] || {};
      const productId = anyEnt?.product_identifier || anyEnt?.productId || '';
      if (productId === 'pc_1w') planType = 'pulsecheck-weekly';
      else if (productId === 'pc_1m') planType = 'pulsecheck-monthly';
      else if (productId === 'pc_1y') planType = 'pulsecheck-annual';
    } catch (_) {}

    // Append to plans. If planType is unknown, use a generic iOS RC label so client can compute active by expiration
    if (!planType) planType = 'ios-revenuecat';
    {
      const snap = await subRef.get();
      const data = snap.data() || {};
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const sameType = plans.filter(p => p && p.type === planType);
      const latestSame = sameType.reduce((acc, p) => {
        const e = typeof p.expiration === 'number' ? p.expiration : 0;
        return !acc || e > acc ? e : acc;
      }, 0);
      if (Math.abs(latestSame - expSec) >= 1) {
        await subRef.update({
          plans: admin.firestore.FieldValue.arrayUnion({
            type: planType,
            expiration: expSec,
            createdAt: nowSec,
            updatedAt: nowSec,
            platform: 'ios',
            productId: null,
          })
        });
      }
    }

    // Store RC identifiers on user profile for future lookups
    try {
      const uref = db.collection('users').doc(userId);
      const updates = {
        revenuecat: {
          appUserId: Array.from(discoveredIds)[0] || rcAppUserId || null,
          aliases: Array.from(discoveredIds),
          email: discoveredEmail || userEmail || null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      };
      await uref.set(updates, { merge: true });
    } catch (e) {
      console.warn('[SyncRevenueCat] failed to persist user.revenuecat metadata', e.message);
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Synced', latestExpiration, sourceProject: latestSourceProject }) };
  } catch (error) {
    console.error('[SyncRevenueCat] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


