import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface EmailSequence {
    subject: string;
    body: string;
    delayDays: number;
}

interface CampaignSettings {
    dailyLimit: number;
    scheduleFrom: string;
    scheduleTo: string;
    scheduleDays: number[];
    timezone: string;
    stopOnReply: boolean;
    stopOnAutoReply: boolean;
    linkTracking: boolean;
    openTracking: boolean;
    textOnly: boolean;
}

const DEFAULT_SETTINGS: CampaignSettings = {
    dailyLimit: 30,
    scheduleFrom: '08:00',
    scheduleTo: '13:00',
    scheduleDays: [1, 2, 3, 4, 5],
    timezone: 'America/Detroit',
    stopOnReply: true,
    stopOnAutoReply: false,
    linkTracking: false,
    openTracking: true,
    textOnly: true
};

const MAX_STRATEGY_CHARS = 180000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function parseJsonSafe(raw: string): any {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function normalizeBoolean(value: any, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', 'y', 'on', '1'].includes(normalized)) return true;
        if (['false', 'no', 'n', 'off', '0'].includes(normalized)) return false;
    }
    return fallback;
}

function normalizeNumber(value: any, fallback: number, min: number, max: number): number {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) return fallback;
    const rounded = Math.round(asNumber);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
}

function normalizeTimezone(value: any): string {
    if (typeof value !== 'string' || !value.trim()) return DEFAULT_SETTINGS.timezone;
    const tz = value.trim();
    const lowered = tz.toLowerCase();
    if (lowered === 'et' || lowered === 'est' || lowered === 'eastern') return 'America/Detroit';
    if (lowered === 'ct' || lowered === 'cst' || lowered === 'central') return 'America/Chicago';
    if (lowered === 'mt' || lowered === 'mst' || lowered === 'mountain') return 'America/Denver';
    if (lowered === 'pt' || lowered === 'pst' || lowered === 'pacific') return 'America/Los_Angeles';
    return tz;
}

function to24HourTime(value: any, fallback: string): string {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    const raw = value.trim().toLowerCase();

    const direct = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (direct) {
        const hh = direct[1].padStart(2, '0');
        return `${hh}:${direct[2]}`;
    }

    const ampm = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/);
    if (ampm) {
        let hh = Number(ampm[1]);
        const mm = ampm[2] || '00';
        const period = ampm[3];

        if (period === 'am') {
            if (hh === 12) hh = 0;
        } else if (hh < 12) {
            hh += 12;
        }

        if (hh >= 0 && hh <= 23) {
            return `${String(hh).padStart(2, '0')}:${mm}`;
        }
    }

    return fallback;
}

function parseScheduleDays(value: any): number[] {
    const dayMap: Record<string, number> = {
        sun: 0,
        sunday: 0,
        mon: 1,
        monday: 1,
        tue: 2,
        tues: 2,
        tuesday: 2,
        wed: 3,
        wednesday: 3,
        thu: 4,
        thur: 4,
        thurs: 4,
        thursday: 4,
        fri: 5,
        friday: 5,
        sat: 6,
        saturday: 6
    };

    const normalizeDay = (raw: any): number | null => {
        if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) return raw;
        if (typeof raw !== 'string') return null;
        const clean = raw.trim().toLowerCase();
        if (clean in dayMap) return dayMap[clean];
        return null;
    };

    if (Array.isArray(value)) {
        const parsed = value.map(normalizeDay).filter((day): day is number => day !== null);
        return parsed.length > 0 ? Array.from(new Set(parsed)).sort((a, b) => a - b) : DEFAULT_SETTINGS.scheduleDays;
    }

    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower.includes('mon') && lower.includes('fri') && (lower.includes('-') || lower.includes('to'))) {
            return [1, 2, 3, 4, 5];
        }
        if (lower.includes('every day') || lower.includes('daily') || lower.includes('all days')) {
            return [0, 1, 2, 3, 4, 5, 6];
        }
        const tokens = lower.split(/[,/]| and /g).map(token => token.trim());
        const parsed = tokens.map(normalizeDay).filter((day): day is number => day !== null);
        if (parsed.length > 0) {
            return Array.from(new Set(parsed)).sort((a, b) => a - b);
        }
    }

    return DEFAULT_SETTINGS.scheduleDays;
}

function normalizeSubject(raw: any): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/\(no subject/i.test(trimmed) || /^no subject$/i.test(trimmed)) return '';
    return trimmed;
}

function parseEmailFromText(strategyText: string): string {
    const match = strategyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/);
    return match ? match[0].toLowerCase() : '';
}

function deriveSettingsFromText(strategyText: string): Partial<CampaignSettings> {
    const lowered = strategyText.toLowerCase();
    const derived: Partial<CampaignSettings> = {};

    const dailyLimitMatch = strategyText.match(/daily send limit[^0-9]*([0-9]{1,4})/i) || strategyText.match(/daily send[^0-9]*([0-9]{1,4})/i);
    if (dailyLimitMatch) {
        derived.dailyLimit = normalizeNumber(dailyLimitMatch[1], DEFAULT_SETTINGS.dailyLimit, 1, 1000);
    }

    const scheduleLine = strategyText.match(/schedule[^|\n]*\|?\s*([^\n]+)/i);
    if (scheduleLine) {
        const val = scheduleLine[1];
        if (/mon/i.test(val) && /fri/i.test(val)) {
            derived.scheduleDays = [1, 2, 3, 4, 5];
        }
        const fromTo = val.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (fromTo) {
            derived.scheduleFrom = to24HourTime(fromTo[1], DEFAULT_SETTINGS.scheduleFrom);
            derived.scheduleTo = to24HourTime(fromTo[2], DEFAULT_SETTINGS.scheduleTo);
        }
        if (/\bet\b|\beastern\b/i.test(val)) derived.timezone = 'America/Detroit';
    }

    if (/stop on reply[^a-z]*(yes|true|on|✅)/i.test(lowered)) derived.stopOnReply = true;
    if (/stop on reply[^a-z]*(no|false|off|❌)/i.test(lowered)) derived.stopOnReply = false;
    if (/link tracking[^a-z]*(yes|true|on|✅)/i.test(lowered)) derived.linkTracking = true;
    if (/link tracking[^a-z]*(no|false|off|❌)/i.test(lowered)) derived.linkTracking = false;
    if (/open tracking[^a-z]*(yes|true|on|✅)/i.test(lowered)) derived.openTracking = true;
    if (/open tracking[^a-z]*(no|false|off|❌)/i.test(lowered)) derived.openTracking = false;
    if (/text only[^a-z]*(yes|true|on|✅)/i.test(lowered)) derived.textOnly = true;
    if (/text only[^a-z]*(no|false|off|❌)/i.test(lowered)) derived.textOnly = false;

    return derived;
}

function fallbackSequencesFromText(strategyText: string): EmailSequence[] {
    const headingRegex = /^###\s+Email\s+\d+[^\n]*?\(Day\s*(\d+)\)/gim;
    const matches: Array<{ index: number; day: number; raw: string }> = [];

    let match: RegExpExecArray | null = headingRegex.exec(strategyText);
    while (match) {
        matches.push({
            index: match.index,
            day: Number(match[1]) || 0,
            raw: match[0]
        });
        match = headingRegex.exec(strategyText);
    }

    if (matches.length === 0) return [];

    const sequences: EmailSequence[] = [];

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i < matches.length - 1 ? matches[i + 1].index : strategyText.length;
        const block = strategyText.slice(start, end);

        const subjectMatch = block.match(/\*\*Subject:\*\*\s*(.+)/i);
        const subject = normalizeSubject(subjectMatch ? subjectMatch[1] : '');

        const bodyLines = block
            .split('\n')
            .filter(line => line.trim().startsWith('>'))
            .map(line => line.replace(/^\s*>\s?/, '').trimEnd());

        const body = bodyLines.join('\n').trim();
        if (!body) continue;

        const absoluteDay = matches[i].day;
        const previousAbsoluteDay = i === 0 ? 0 : matches[i - 1].day;
        const delayDays = i === 0 ? 0 : Math.max(1, absoluteDay - previousAbsoluteDay);

        sequences.push({
            subject,
            body,
            delayDays
        });
    }

    return sequences;
}

function sanitizeSettings(rawSettings: any, strategyText: string): CampaignSettings {
    const textDerived = deriveSettingsFromText(strategyText);
    const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};

    return {
        dailyLimit: normalizeNumber(source.dailyLimit ?? textDerived.dailyLimit, DEFAULT_SETTINGS.dailyLimit, 1, 1000),
        scheduleFrom: to24HourTime(source.scheduleFrom ?? textDerived.scheduleFrom, DEFAULT_SETTINGS.scheduleFrom),
        scheduleTo: to24HourTime(source.scheduleTo ?? textDerived.scheduleTo, DEFAULT_SETTINGS.scheduleTo),
        scheduleDays: parseScheduleDays(source.scheduleDays ?? textDerived.scheduleDays),
        timezone: normalizeTimezone(source.timezone ?? textDerived.timezone),
        stopOnReply: normalizeBoolean(source.stopOnReply ?? textDerived.stopOnReply, DEFAULT_SETTINGS.stopOnReply),
        stopOnAutoReply: normalizeBoolean(source.stopOnAutoReply, DEFAULT_SETTINGS.stopOnAutoReply),
        linkTracking: normalizeBoolean(source.linkTracking ?? textDerived.linkTracking, DEFAULT_SETTINGS.linkTracking),
        openTracking: normalizeBoolean(source.openTracking ?? textDerived.openTracking, DEFAULT_SETTINGS.openTracking),
        textOnly: normalizeBoolean(source.textOnly ?? textDerived.textOnly, DEFAULT_SETTINGS.textOnly)
    };
}

function sanitizeSequences(rawSequences: any, strategyText: string): EmailSequence[] {
    const source = Array.isArray(rawSequences) ? rawSequences : [];

    const normalized = source
        .map((seq: any, index: number) => {
            const body = typeof seq?.body === 'string'
                ? seq.body.trim()
                : typeof seq?.content === 'string'
                    ? seq.content.trim()
                    : typeof seq?.message === 'string'
                        ? seq.message.trim()
                        : '';

            let delay = normalizeNumber(
                seq?.delayDays ?? seq?.delay_days ?? seq?.delay ?? seq?.daysAfterPrevious ?? (index === 0 ? 0 : 3),
                index === 0 ? 0 : 3,
                0,
                60
            );

            if (index > 0 && delay === 0) delay = 3;

            return {
                subject: normalizeSubject(seq?.subject),
                body,
                delayDays: delay
            };
        })
        .filter((seq: EmailSequence) => seq.body.length > 0);

    if (normalized.length > 0) {
        normalized[0].delayDays = 0;
        return normalized;
    }

    return fallbackSequencesFromText(strategyText);
}

function isLikelyReadableText(raw: string): boolean {
    if (!raw || raw.trim().length < 20) return false;
    const sample = raw.slice(0, 4000);
    let printable = 0;

    for (let i = 0; i < sample.length; i++) {
        const code = sample.charCodeAt(i);
        const isCommonControl = code === 9 || code === 10 || code === 13;
        const isAsciiPrintable = code >= 32 && code <= 126;
        const isExtended = code >= 160;
        if (isCommonControl || isAsciiPrintable || isExtended) printable++;
    }

    return printable / sample.length > 0.7;
}

function buildUserPrompt(strategyText: string, fileName: string, mimeType: string, campaignTitle?: string): string {
    return `Parse this outreach campaign strategy into structured JSON for campaign automation.

Campaign title: ${campaignTitle || 'Unknown campaign'}
File name: ${fileName || 'Unknown'}
File type: ${mimeType || 'Unknown'}

Return JSON with EXACT top-level keys:
- sendingEmail (string)
- campaignSettings (object)
- emailSequences (array)

Rules:
- emailSequences must be in send order (earliest to latest).
- For emailSequences.delayDays, use RELATIVE delay from previous email. First email must have delayDays = 0.
- If a sequence says "(no subject)", return an empty subject string.
- Preserve placeholders like {{firstName}}, {{goal}}, {{level}} exactly.
- campaignSettings keys:
  - dailyLimit (number)
  - scheduleFrom (HH:MM 24h)
  - scheduleTo (HH:MM 24h)
  - scheduleDays (array of day numbers where Sun=0, Mon=1 ... Sat=6)
  - timezone (IANA timezone string)
  - stopOnReply (boolean)
  - stopOnAutoReply (boolean)
  - linkTracking (boolean)
  - openTracking (boolean)
  - textOnly (boolean)
- Use safe defaults if missing:
  dailyLimit=30, scheduleFrom=08:00, scheduleTo=13:00, scheduleDays=[1,2,3,4,5], timezone=America/Detroit,
  stopOnReply=true, stopOnAutoReply=false, linkTracking=false, openTracking=true, textOnly=true.

Strategy content:
"""${strategyText}"""`;
}

async function parseWithOpenAIText(
    openai: OpenAI,
    strategyText: string,
    fileName: string,
    mimeType: string,
    campaignTitle?: string
): Promise<any> {
    const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: 2800,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: 'You convert campaign strategy documents into strict JSON for automation. Return JSON only.'
            },
            {
                role: 'user',
                content: buildUserPrompt(strategyText, fileName, mimeType, campaignTitle)
            }
        ]
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    return parseJsonSafe(content) || {};
}

async function parseWithOpenAIFile(
    openai: OpenAI,
    fileDataBase64: string,
    fileName: string,
    mimeType: string,
    campaignTitle?: string
): Promise<any> {
    const response = await openai.responses.create({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_output_tokens: 2800,
        text: {
            format: {
                type: 'json_schema',
                name: 'campaign_strategy_parse',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sendingEmail: { type: 'string' },
                        campaignSettings: {
                            type: 'object',
                            additionalProperties: true,
                            properties: {
                                dailyLimit: { type: 'number' },
                                scheduleFrom: { type: 'string' },
                                scheduleTo: { type: 'string' },
                                scheduleDays: {
                                    type: 'array',
                                    items: { type: 'number' }
                                },
                                timezone: { type: 'string' },
                                stopOnReply: { type: 'boolean' },
                                stopOnAutoReply: { type: 'boolean' },
                                linkTracking: { type: 'boolean' },
                                openTracking: { type: 'boolean' },
                                textOnly: { type: 'boolean' }
                            }
                        },
                        emailSequences: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                    subject: { type: 'string' },
                                    body: { type: 'string' },
                                    delayDays: { type: 'number' }
                                },
                                required: ['subject', 'body', 'delayDays']
                            }
                        }
                    },
                    required: ['sendingEmail', 'campaignSettings', 'emailSequences']
                }
            }
        },
        input: [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: buildUserPrompt(
                            '',
                            fileName,
                            mimeType,
                            campaignTitle
                        )
                    },
                    {
                        type: 'input_file',
                        filename: fileName || 'campaign-strategy',
                        file_data: fileDataBase64
                    }
                ]
            }
        ]
    });

    return parseJsonSafe(response.output_text || '{}') || {};
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    try {
        const {
            strategyText: incomingStrategyText,
            fileName,
            mimeType,
            fileDataBase64,
            campaignTitle
        } = req.body || {};

        const safeFileName = typeof fileName === 'string' ? fileName : 'campaign-strategy';
        const safeMimeType = typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
        const strategyText = typeof incomingStrategyText === 'string'
            ? incomingStrategyText.slice(0, MAX_STRATEGY_CHARS)
            : '';
        const base64File = typeof fileDataBase64 === 'string' ? fileDataBase64 : '';

        if (!strategyText && !base64File) {
            return res.status(400).json({ error: 'Either strategyText or fileDataBase64 is required' });
        }

        const openai = new OpenAI({ apiKey });

        let parsedFromModel: any = {};
        if (isLikelyReadableText(strategyText)) {
            parsedFromModel = await parseWithOpenAIText(openai, strategyText, safeFileName, safeMimeType, campaignTitle);
        } else if (base64File) {
            parsedFromModel = await parseWithOpenAIFile(openai, base64File, safeFileName, safeMimeType, campaignTitle);
        } else {
            parsedFromModel = await parseWithOpenAIText(openai, strategyText, safeFileName, safeMimeType, campaignTitle);
        }

        const parsedSettingsSource = parsedFromModel?.campaignSettings || parsedFromModel?.settings || parsedFromModel;
        const parsedSequencesSource = parsedFromModel?.emailSequences || parsedFromModel?.sequences;

        const emailSequences = sanitizeSequences(parsedSequencesSource, strategyText);
        if (emailSequences.length === 0) {
            return res.status(422).json({
                error: 'Could not extract any email sequences from the uploaded strategy. Try a text-based file or paste clearer sequence sections.'
            });
        }

        const campaignSettings = sanitizeSettings(parsedSettingsSource, strategyText);

        const sendingEmailCandidate = typeof parsedFromModel?.sendingEmail === 'string'
            ? parsedFromModel.sendingEmail.trim().toLowerCase()
            : typeof parsedFromModel?.email === 'string'
                ? parsedFromModel.email.trim().toLowerCase()
                : parseEmailFromText(strategyText);

        const sendingEmail = sendingEmailCandidate || '';

        return res.status(200).json({
            success: true,
            parsed: {
                emailSequences,
                campaignSettings,
                sendingEmail
            }
        });
    } catch (error: any) {
        console.error('[Outreach Strategy Parse] Error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to parse campaign strategy'
        });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '8mb'
        }
    }
};
