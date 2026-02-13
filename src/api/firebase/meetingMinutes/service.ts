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
            minutes.executiveSummary || 'No summary provided.',
            '',
        ];

        if (minutes.highlights?.length) {
            lines.push('## Highlights');
            for (const highlight of minutes.highlights) {
                lines.push(`- **${highlight.speaker}:** ${highlight.summary}`);
            }
            lines.push('');
        }

        if (minutes.valueInsights?.length) {
            lines.push('## Value Insights');
            for (const insight of minutes.valueInsights) {
                lines.push(`- **${insight.title}:** ${insight.takeaway} _(Impact: ${insight.impact})_`);
            }
            lines.push('');
        }

        if (minutes.strategicDecisions?.length) {
            lines.push('## Strategic Decisions');
            for (const decision of minutes.strategicDecisions) {
                lines.push(`- ${decision}`);
            }
            lines.push('');
        }

        if (minutes.nextActions?.length) {
            lines.push('## Next Actions');
            for (const action of minutes.nextActions) {
                lines.push(`- [ ] ${action.task} *(Owner: ${action.owner}${action.due ? `, Due: ${action.due}` : ''})*`);
            }
            lines.push('');
        }

        if (minutes.risksOrOpenQuestions?.length) {
            lines.push('## Risks & Open Questions');
            for (const risk of minutes.risksOrOpenQuestions) {
                lines.push(`- ${risk}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    toHTML(minutes: MeetingMinutes): string {
        const date = minutes.createdAt instanceof Date
            ? minutes.createdAt
            : (minutes.createdAt as any)?.toDate?.() || new Date();

        const section = (title: string, body: string) => body ? `
            <section class="mm-section">
                <h3>${title}</h3>
                ${body}
            </section>
        ` : '';

        const formatInsights = minutes.valueInsights?.length
            ? minutes.valueInsights.map(insight => `
                <div class="mm-topic">
                    <h4>${insight.title}</h4>
                    <p>${insight.takeaway}</p>
                    <p class="mm-topic-impact">Impact: ${insight.impact}</p>
                </div>
            `).join('')
            : '';

        const formatList = (items?: string[]) => items && items.length
            ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
            : '';

        const formatActions = minutes.nextActions?.length
            ? minutes.nextActions.map(action => `
                <div class="mm-action-item">
                    <span class="mm-action-task">${action.task}</span>
                    <span class="mm-action-owner">${action.owner}${action.due ? ` (Due: ${action.due})` : ''}</span>
                </div>
            `).join('')
            : '';

        const formatHighlights = minutes.highlights?.length
            ? `<ul>${minutes.highlights.map(h => `<li><strong>${h.speaker}:</strong> ${h.summary}</li>`).join('')}</ul>`
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
                .mm-topic-impact { margin-top: 6px; font-size: 12px; color: #0f172a; font-weight: 600; }
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
                        ${section('Executive Summary', `<p>${minutes.executiveSummary || 'No summary provided.'}</p>`)}
                        ${section('Highlights', formatHighlights)}
                        ${section('Value Insights', formatInsights)}
                        ${section('Strategic Decisions', formatList(minutes.strategicDecisions))}
                        ${section('Next Actions', formatActions)}
                        ${section('Risks & Open Questions', formatList(minutes.risksOrOpenQuestions))}
                    </div>
                </body>
            </html>
        `;
    }

}

export const meetingMinutesService = new MeetingMinutesService();
