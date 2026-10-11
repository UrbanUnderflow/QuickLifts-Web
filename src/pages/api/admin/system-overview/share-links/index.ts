import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from './_auth';
import { createPasscodeHash } from '../../../../../lib/systemOverviewShareAccess';

import { SNAPSHOT_SECTION_ID, loadSnapshotArtifacts, snapshotArtifactHtml } from '../../../../../lib/systemOverviewSnapshotArtifacts';

const COLLECTION = 'systemOverviewShareLinks';

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) => value?.toDate?.().toISOString?.() || null;

// Firestore docs cap at 1MB; leave headroom for snapshotText + metadata.
const MAX_SNAPSHOT_HTML_LENGTH = 700_000;

// The HTML originates from our own admin-rendered React DOM, but strip active
// content anyway since the share page renders it for unauthenticated visitors.
const sanitizeSnapshotHtml = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let html = raw;
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed']) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }
  html = html.replace(/<(?:link|meta|base)\b[^>]*\/?>/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, ' $1="#"');
  if (html.length > MAX_SNAPSHOT_HTML_LENGTH) return '';
  return html;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = admin.firestore();

  if (req.method === 'GET') {
    try {
      const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : '';
      const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(100).get();

      const links = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            token: docSnap.id,
            sectionId: data.sectionId || '',
            systemId: data.systemId || '',
            sectionLabel: data.sectionLabel || '',
            sectionDescription: data.sectionDescription || '',
            snapshotText: data.snapshotText || '',
            passcodeProtected: Boolean(data.passcodeProtected),
            createdByEmail: data.createdByEmail || '',
            createdAt: toIso(data.createdAt),
            revokedAt: toIso(data.revokedAt),
            shareUrl: data.shareUrl || '',
          };
        })
        .filter((link) => !sectionId || link.sectionId === sectionId);

      return res.status(200).json({ links });
    } catch (error) {
      console.error('[system-overview-share] Failed to list links:', error);
      return res.status(500).json({ error: 'Failed to list share links.' });
    }
  }

  if (req.method === 'POST') {
    const { sectionId, systemId, sectionLabel, sectionDescription, snapshotText, snapshotHtml, passcode } = req.body || {};

    if (!sectionId || !systemId || !sectionLabel || !snapshotText) {
      return res.status(400).json({ error: 'sectionId, systemId, sectionLabel, and snapshotText are required.' });
    }

    if (sectionId === SNAPSHOT_SECTION_ID && (typeof passcode !== 'string' || passcode.trim().length < 8)) {
      return res.status(400).json({ error: 'Snapshot integration shares require a passcode of at least 8 characters.' });
    }
    if (sectionId === SNAPSHOT_SECTION_ID && process.env.NODE_ENV === 'production' && !process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET && !process.env.NEXTAUTH_SECRET) {
      return res.status(503).json({ error: 'Protected sharing is not configured.' });
    }
    try {
      const token = randomBytes(24).toString('hex');
      const snapshotArtifacts = sectionId === SNAPSHOT_SECTION_ID ? await loadSnapshotArtifacts() : null;
      const safeSnapshotHtml = snapshotArtifacts ? snapshotArtifactHtml(token, snapshotArtifacts) : sanitizeSnapshotHtml(snapshotHtml);
      const safeSnapshotText = snapshotArtifacts ? snapshotArtifacts.map(item => `${item.name}\n\n${item.content}`).join('\n\n') : snapshotText;
      if (snapshotArtifacts && Buffer.byteLength(JSON.stringify(snapshotArtifacts)) + Buffer.byteLength(safeSnapshotHtml) + Buffer.byteLength(safeSnapshotText) > 850000) {
        return res.status(413).json({ error: 'Snapshot documents are too large to share.' });
      }
      const expiresAt = snapshotArtifacts ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      const shareUrl = `${baseUrl}/shared/system-overview/${token}`;
      const trimmedPasscode = typeof passcode === 'string' ? passcode.trim() : '';
      const passcodeHash = trimmedPasscode ? createPasscodeHash(trimmedPasscode) : null;

      await db.collection(COLLECTION).doc(token).set({
        sectionId,
        systemId,
        sectionLabel,
        sectionDescription: sectionDescription || '',
        snapshotText: safeSnapshotText,
        snapshotHtml: safeSnapshotHtml,
        ...(snapshotArtifacts ? { snapshotArtifacts, expiresAt } : {}),
        passcodeProtected: Boolean(passcodeHash),
        passcodeSalt: passcodeHash?.salt || null,
        passcodeHash: passcodeHash?.hash || null,
        createdByEmail: adminUser.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedAt: null,
        revokedByEmail: null,
        shareUrl,
      });

      return res.status(200).json({
        link: {
          token,
          sectionId,
          systemId,
          sectionLabel,
          sectionDescription: sectionDescription || '',
          snapshotText: safeSnapshotText,
          expiresAt,
          passcodeProtected: Boolean(passcodeHash),
          createdByEmail: adminUser.email,
          createdAt: new Date().toISOString(),
          revokedAt: null,
          shareUrl,
        },
      });
    } catch (error) {
      console.error('[system-overview-share] Failed to create link:', error);
      return res.status(500).json({ error: 'Failed to create share link.' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
