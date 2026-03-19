import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '2mb',
        },
    },
};

type AuditSeverity = 'error' | 'warning';

interface AuditFinding {
    severity: AuditSeverity;
    code: string;
    message: string;
}

interface VariantAuditRequest {
    variant?: {
        name?: string;
        family?: string;
        familyStatus?: string;
        mode?: string;
        priority?: string;
        specStatus?: string;
        archetype?: string;
        publishedModuleId?: string | null;
        buildStatus?: string | null;
    };
    rawSpec?: string;
    deterministicFindings?: AuditFinding[];
}

interface VariantAuditResponse {
    summary: string;
    findings: AuditFinding[];
}

const DEFAULT_MODEL = 'gpt-5.4';
const MAX_SPEC_CHARS = 120_000;

type VariantMetadata = NonNullable<VariantAuditRequest['variant']>;

function sanitizeModelName(raw: string | undefined) {
    const candidate = (raw || DEFAULT_MODEL).trim();
    if (!candidate) return DEFAULT_MODEL;
    return candidate.replace(/^openai\//i, '');
}

function resolveArchetype(variant: VariantMetadata) {
    const explicit = variant.archetype?.trim();
    if (explicit) return explicit;

    const name = (variant.name || '').toLowerCase();
    if (name.includes('short daily')) return 'short_daily';
    if (name.includes('extended trial') || name.includes('trial-only') || name.includes('field-read trial')) return 'trial';
    if (name.includes('immersive') || name.includes('vision pro') || name.includes('chamber') || name.includes('tunnel')) return 'immersive';
    if (name.includes('sport') || name.includes('playbook') || name.includes('pre-shot') || name.includes('field-read') || name.includes('shot-clock')) return 'sport_context';
    if (name.includes('visual') || name.includes('clutter') || name.includes('spotlight') || name.includes('peripheral')) return 'visual_channel';
    if (name.includes('audio') || name.includes('crowd') || name.includes('whistle') || name.includes('commentary')) return 'audio_channel';
    if (name.includes('combined') || name.includes('mixed') || name.includes('multi-source') || name.includes('dual-channel') || name.includes('overload')) return 'combined_channel';
    if (name.includes('cognitive') || name.includes('provocation') || name.includes('ambiguous') || name.includes('confidence') || name.includes('late reveal')) return 'cognitive_pressure';
    if (name.includes('fatigue') || name.includes('late') || name.includes('long') || name.includes('burn') || name.includes('endurance')) return 'fatigue_load';
    if (name.includes('false') || name.includes('fakeout') || name.includes('decoy') || name.includes('bait') || name.includes('go/no-go')) return 'decoy_discrimination';
    return 'baseline';
}

function getFamilyAuditFocus(variant: VariantMetadata) {
    const family = variant.family || '';
    const archetype = resolveArchetype(variant);
    const focus: string[] = [];

    switch (family) {
        case 'Reset':
            focus.push('verify valid re-engagement, false-start logic, multi-source Attentional Shifting, and modifier-stratified Pressure Stability');
            break;
        case 'Noise Gate':
            focus.push('verify Distractor Cost formula, distractor-directed false alarms, and channel-vulnerability breakdowns');
            break;
        case 'Brake Point':
            focus.push('verify valid Go rules, No-Go subtype classification, Stop Latency precision, and over-inhibition handling');
            break;
        case 'Signal Window':
            focus.push('verify first-commit rules, read-versus-latency decomposition, decoy handling, and window-utilization logic');
            break;
        case 'Sequence Shift':
            focus.push('verify post-shift window definition, old-rule intrusion handling, switch-cost logic, and artifact-floor precision');
            break;
        case 'Endurance Lock':
            focus.push('verify fixed or formulaic block segmentation, reproducible baseline/mid/finish logic, normalized fatigue or late-pressure profiles, and schema-grade analytics vocabularies');
            break;
        default:
            break;
    }

    switch (archetype) {
        case 'visual_channel':
            focus.push('flag any visual-channel variant that lacks concrete modifier definitions, co-occurrence tiers, or display-state enums');
            break;
        case 'audio_channel':
            focus.push('flag missing audio-route, output-device, or sound-subtype schema');
            break;
        case 'combined_channel':
            focus.push('flag missing overlap timing rules or per-channel attribution');
            break;
        case 'sport_context':
            focus.push('flag any sport-context draft that changes the underlying task instead of just contextual packaging');
            break;
        case 'fatigue_load':
            focus.push('flag flexible windows, undefined modifier profiles, missing block enums, or unclear training-mode adaptation boundaries');
            break;
        case 'trial':
            focus.push('flag any missing fixed-profile, validity, seed, or device constraints');
            break;
        default:
            break;
    }

    if (family === 'Endurance Lock' && archetype === 'visual_channel') {
        focus.push('flag any Endurance Lock visual-channel draft that reverts to flexible baseline windows, placeholder modifier matrices, or non-schema visual vocabularies');
    }

    return focus;
}

function sanitizeFinding(raw: any, index: number): AuditFinding | null {
    const severity: AuditSeverity = raw?.severity === 'error' ? 'error' : 'warning';
    const code = typeof raw?.code === 'string' && raw.code.trim()
        ? raw.code.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_')
        : `ai_finding_${index + 1}`;
    const message = typeof raw?.message === 'string' ? raw.message.trim() : '';
    if (!message) return null;
    return { severity, code, message };
}

function sanitizeResponse(raw: any): VariantAuditResponse {
    const findings = Array.isArray(raw?.findings)
        ? raw.findings
            .map((finding: any, index: number) => sanitizeFinding(finding, index))
            .filter((finding: AuditFinding | null): finding is AuditFinding => Boolean(finding))
            .slice(0, 8)
        : [];

    return {
        summary: typeof raw?.summary === 'string' && raw.summary.trim()
            ? raw.summary.trim()
            : 'AI review completed without a structured summary.',
        findings,
    };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { variant, rawSpec, deterministicFindings = [] } = (req.body || {}) as VariantAuditRequest;
    if (!variant?.name || !variant?.family || !rawSpec?.trim()) {
        return res.status(400).json({ error: 'Missing required fields: variant.name, variant.family, rawSpec' });
    }

    const trimmedSpec = rawSpec.trim();
    if (trimmedSpec.length > MAX_SPEC_CHARS) {
        return res.status(400).json({ error: `Spec exceeds ${MAX_SPEC_CHARS} characters` });
    }

    const model = sanitizeModelName(process.env.PULSECHECK_SPEC_AUDIT_MODEL);
    const openai = new OpenAI({ apiKey });
    const auditFocus = getFamilyAuditFocus(variant);

    try {
        const completion = await openai.chat.completions.create({
            model,
            temperature: 0.1,
            max_completion_tokens: 1200,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'You are the PulseCheck variant spec gold-standard auditor. ' +
                        'You review sim variant specs for publish quality. Preserve the numbered section structure, the family boundary, and the registry voice. ' +
                        'Return valid JSON only with this exact shape: ' +
                        '{"summary":"...", "findings":[{"severity":"warning|error","code":"snake_case_code","message":"..."}]}. ' +
                        'Use findings only for material issues that still remain after deterministic checks. ' +
                        'Apply family-specific publishing standards instead of generic writing advice. ' +
                        'Do not rewrite the full spec in this step. Focus on concise, high-signal quality review.',
                },
                {
                    role: 'user',
                    content:
                        `Variant metadata:\n${JSON.stringify(variant, null, 2)}\n\n` +
                        `Deterministic findings already identified:\n${JSON.stringify(deterministicFindings, null, 2)}\n\n` +
                        `Family-specific audit focus:\n- ${auditFocus.join('\n- ')}\n\n` +
                        `Current spec:\n${trimmedSpec}\n\n` +
                        'Review this toward gold-standard quality. ' +
                        'Be especially concrete about modifier matrices, trial profiles, analytics vocabularies, and maturity/status language when they are underspecified. ' +
                        'Do not remove sections. Preserve the numbered section layout. Return only the summary and findings JSON.',
                },
            ],
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'No AI audit content returned' });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            console.error('[audit-variant-spec] Failed to parse AI response:', error);
            return res.status(500).json({ error: 'Invalid AI audit response format' });
        }

        const audit = sanitizeResponse(parsed);
        return res.status(200).json({
            success: true,
            model,
            summary: audit.summary,
            findings: audit.findings,
            suggestedSpecRaw: trimmedSpec,
        });
    } catch (error: any) {
        console.error('[audit-variant-spec] AI audit failed:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to run AI variant spec audit',
        });
    }
}
