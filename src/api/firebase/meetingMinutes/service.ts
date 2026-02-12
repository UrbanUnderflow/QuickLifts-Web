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
            valueInsights: data.valueInsights || [],
            strategicDecisions: data.strategicDecisions || [],
            nextActions: data.nextActions || [],
            highlights: data.highlights || [],
            risksOrOpenQuestions: data.risksOrOpenQuestions || [],
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

    toHTML(minutes: MeetingMinutes): string {
        const date = minutes.createdAt instanceof Date
            ? minutes.createdAt
            : (minutes.createdAt as any)?.toDate?.() || new Date();

        const formatList = (items: string[]) =>
            items.length
                ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
                : '';

        const formatTopics = (topics: { title: string; summary: string }[]) =>
            topics.length
                ? topics.map(topic => `
                    <div class="mm-topic">
                        <h4>${topic.title}</h4>
                        <p>${topic.summary}</p>
                    </div>
                `).join('')
                : '';

        const formatActionItems = (items: { task: string; owner: string }[]) =>
            items.length
                ? items.map(item => `
                    <div class="mm-action-item">
                        <span class="mm-action-task">${item.task}</span>
                        <span class="mm-action-owner">${item.owner}</span>
                    </div>
                `).join('')
                : '';

        const styles = `
            <style>
                body { font-family: 'Inter', Arial, sans-serif; background: #fafafa; color: #0f172a; margin: 0; padding: 24px; }
                .mm-container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(15,23,42,0.08); }
                .mm-header { border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
                .mm-title { font-size: 24px; margin: 0; color: #111827; }
                .mm-meta { margin: 8px 0 0; color: #475569; font-size: 13px; }
                .mm-section { margin-bottom: 24px; }
                .mm-section h3 { margin: 0 0 8px; font-size: 16px; color: #111827; }
                .mm-section p { margin: 0; line-height: 1.5; color: #1f2937; }
                .mm-topic { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; }
                .mm-topic h4 { margin: 0 0 4px; font-size: 14px; color: #1d4ed8; }
                .mm-topic p { margin: 0; font-size: 13px; color: #334155; }
                ul { padding-left: 18px; margin: 8px 0 0; color: #1f2937; }
                li { margin-bottom: 6px; font-size: 13px; }
                .mm-action-item { display: flex; justify-content: space-between; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
                .mm-action-owner { color: #6366f1; font-weight: 600; }
            </style>
        `;

        return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <title>Meeting Minutes</title>
                    ${styles}
                </head>
                <body>
                    <div class="mm-container">
                        <div class="mm-header">
                            <h1 class="mm-title">Round Table Meeting Minutes</h1>
                            <p class="mm-meta">
                                ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                · ${minutes.duration} · ${minutes.messageCount} messages · Participants: ${minutes.participants.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                            </p>
                        </div>
                        <section class="mm-section">
                            <h3>Executive Summary</h3>
                            <p>${minutes.executiveSummary || 'No summary provided.'}</p>
                        </section>
                        ${minutes.topicsDiscussed.length ? `
                            <section class="mm-section">
                                <h3>Topics Discussed</h3>
                                ${formatTopics(minutes.topicsDiscussed)}
                            </section>
                        ` : ''}
                        ${minutes.keyInsights.length ? `
                            <section class="mm-section">
                                <h3>Key Insights</h3>
                                ${formatList(minutes.keyInsights)}
                            </section>
                        ` : ''}
                        ${minutes.decisions.length ? `
                            <section class="mm-section">
                                <h3>Decisions & Positions</h3>
                                ${formatList(minutes.decisions)}
                            </section>
                        ` : ''}
                        ${minutes.openQuestions.length ? `
                            <section class="mm-section">
                                <h3>Open Questions</h3>
                                ${formatList(minutes.openQuestions)}
                            </section>
                        ` : ''}
                        ${minutes.actionItems.length ? `
                            <section class="mm-section">
                                <h3>Action Items</h3>
                                ${formatActionItems(minutes.actionItems)}
                            </section>
                        ` : ''}
                    </div>
                </body>
            </html>
        `;
    }
}

export const meetingMinutesService = new MeetingMinutesService();
