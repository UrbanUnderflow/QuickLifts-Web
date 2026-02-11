import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = getFirestore();

        // Fetch legal documents ordered by createdAt desc
        const documentsSnapshot = await db
            .collection('legal-documents')
            .orderBy('createdAt', 'desc')
            .get();

        const documents = documentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Best-effort: fetch stakeholder directory for signer prefill
        let stakeholderDirectory: { id: string; name: string; email: string }[] = [];
        try {
            const stakeSnap = await db
                .collection('equity-stakeholders')
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();

            stakeholderDirectory = stakeSnap.docs
                .map(d => ({ id: d.id, ...(d.data() as any) }))
                .filter((s: any) => typeof s.email === 'string' && s.email.length > 0)
                .map((s: any) => ({ id: s.id, name: s.name || s.email, email: s.email }));
        } catch {
            // ignore stakeholder errors
        }

        // Best-effort: fetch signing requests
        let signingRequests: any[] = [];
        try {
            const signingSnap = await db
                .collection('signingRequests')
                .orderBy('createdAt', 'desc')
                .get();

            signingRequests = signingSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((r: any) => r.legalDocumentId);
        } catch {
            // ignore signing request errors
        }

        return res.status(200).json({
            documents,
            stakeholderDirectory,
            signingRequests,
        });
    } catch (error) {
        console.error('Error loading legal documents:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to load documents',
        });
    }
}
