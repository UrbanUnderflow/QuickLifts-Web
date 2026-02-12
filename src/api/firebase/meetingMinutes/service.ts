import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { MeetingMinutes } from './types';

const COLLECTION = 'meeting-minutes';

export class MeetingMinutesService {
    /**
     * Save meeting minutes to Firestore
     */
    async save(minutes: Omit<MeetingMinutes, 'id' | 'createdAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION), {
            ...minutes,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    }

    /**
     * Get all meeting minutes, most recent first
     */
    async getAll(): Promise<MeetingMinutes[]> {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<MeetingMinutes, 'id'>),
        }));
    }

    /**
     * Get a single meeting minutes document
     */
    async getById(id: string): Promise<MeetingMinutes | null> {
        const docSnap = await getDoc(doc(db, COLLECTION, id));
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...(docSnap.data() as Omit<MeetingMinutes, 'id'>) };
    }

    /**
     * Delete meeting minutes
     */
    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION, id));
    }

    /**
     * Generate meeting minutes via the API route
     */
    async generate(
        chatId: string,
        messages: Array<{ from: string; content: string; responses: Record<string, { content: string; status: string }> }>,
        participants: string[],
        duration: string
    ): Promise<Omit<MeetingMinutes, 'id' | 'createdAt'>> {
        // Build transcript from messages
        const transcript = this.buildTranscript(messages, participants);
        const messageCount = messages.length;

        const res = await fetch('/api/agent/generateMinutes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, participants, messageCount }),
        });

        if (!res.ok) {
            throw new Error(`Failed to generate minutes: ${res.statusText}`);
        }

        const data = await res.json();

        return {
            chatId,
            duration,
            participants,
            messageCount,
            executiveSummary: data.executiveSummary || '',
            topicsDiscussed: data.topicsDiscussed || [],
            keyInsights: data.keyInsights || [],
            decisions: data.decisions || [],
            openQuestions: data.openQuestions || [],
            actionItems: data.actionItems || [],
        };
    }

    /**
     * Build a readable transcript from messages
     */
    private buildTranscript(
        messages: Array<{ from: string; content: string; responses: Record<string, { content: string; status: string }> }>,
        participants: string[]
    ): string {
        const agentNames: Record<string, string> = {
            nora: 'Nora',
            scout: 'Scout',
            admin: 'Tremaine',
        };

        const lines: string[] = [];

        for (const msg of messages) {
            const sender = agentNames[msg.from] || msg.from;
            if (msg.from === 'admin') {
                lines.push(`${sender}: ${msg.content}`);
            }

            // Add agent responses
            if (msg.responses) {
                for (const [agentId, resp] of Object.entries(msg.responses)) {
                    if (resp.status === 'completed' && resp.content) {
                        lines.push(`${agentNames[agentId] || agentId}: ${resp.content}`);
                    }
                }
            }
        }

        return lines.join('\n\n');
    }

    /**
     * Export minutes as markdown string
     */
    toMarkdown(minutes: MeetingMinutes): string {
        const date = minutes.createdAt instanceof Date
            ? minutes.createdAt
            : (minutes.createdAt as any)?.toDate?.() || new Date();

        const lines = [
            `# Round Table Meeting Minutes`,
            `**Date:** ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            `**Duration:** ${minutes.duration}`,
            `**Participants:** ${minutes.participants.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}`,
            `**Messages:** ${minutes.messageCount}`,
            '',
            `## Executive Summary`,
            minutes.executiveSummary,
            '',
        ];

        if (minutes.topicsDiscussed.length > 0) {
            lines.push('## Topics Discussed');
            for (const topic of minutes.topicsDiscussed) {
                lines.push(`### ${topic.title}`);
                lines.push(topic.summary);
                lines.push('');
            }
        }

        if (minutes.keyInsights.length > 0) {
            lines.push('## Key Insights');
            for (const insight of minutes.keyInsights) {
                lines.push(`- ${insight}`);
            }
            lines.push('');
        }

        if (minutes.decisions.length > 0) {
            lines.push('## Decisions & Positions');
            for (const decision of minutes.decisions) {
                lines.push(`- ${decision}`);
            }
            lines.push('');
        }

        if (minutes.openQuestions.length > 0) {
            lines.push('## Open Questions');
            for (const question of minutes.openQuestions) {
                lines.push(`- ${question}`);
            }
            lines.push('');
        }

        if (minutes.actionItems.length > 0) {
            lines.push('## Action Items');
            for (const item of minutes.actionItems) {
                lines.push(`- [ ] ${item.task} *(${item.owner})*`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }
}

export const meetingMinutesService = new MeetingMinutesService();
