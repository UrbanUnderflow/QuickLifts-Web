import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '2mb',
        },
    },
};

interface VariantGenerationRequest {
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
    seedSpec?: string;
}

const DEFAULT_MODEL = 'gpt-4.1';
const MAX_SPEC_CHARS = 120_000;

type VariantMetadata = NonNullable<VariantGenerationRequest['variant']>;

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

function getFamilyGoldStandardGuidance(variant: VariantMetadata) {
    const family = variant.family || '';
    const archetype = resolveArchetype(variant);
    const guidance: string[] = [];

    switch (family) {
        case 'Reset':
            guidance.push(
                'Reset specs must keep one left-or-right classification task in matched reference and post-interruption trials.',
                'Reset specs must define post-disruption re-engagement cost as the median within-pair response-time difference using only valid correct responses and withhold it unless six valid correct matched pairs remain.',
                'Reference and post-interruption accuracy, premature responses, timeouts, and the actual reset interval must stay separate from the response-time estimate.',
                'The task may support an Attentional Shifting hypothesis, but it must not produce recovery, resilience, readiness, or mental-toughness labels.',
                'Do not let modifier packaging change the task identity; if the disruption creates a new problem, treat it as a build defect.'
            );
            break;
        case 'Noise Gate':
            guidance.push(
                'Noise Gate must keep the called number visible and use the same visual-search field in reference and distraction rounds; do not turn it into a memory task.',
                'A visual condition may add one salient wrong marker and an audio condition may add crowd sound, but neither may hide or replace the matching number.',
                'Noise Gate specs must define Distractor Cost explicitly and calculate response-time shift as the median within-pair difference from at least three valid correct matched pairs.',
                'False alarms must be distractor-directed responses and must be classified by distractor type.',
                'Channel Vulnerability must be broken down by channel or distractor class, not flattened into one unlabeled score.'
            );
            break;
        case 'Brake Point':
            guidance.push(
                'Brake Point must use a dominant left-or-right go task and delayed stop signals on one quarter of scored trials; no Brake response button is allowed.',
                'The stop-signal delay must use the declared 50 ms staircase within the 100-700 ms range; every failed stop response, including a premature response, moves the next delay down.',
                'The standard 64-trial rep uses stop success as its core measure and never emits a stop-time estimate.',
                'A stop-time estimate may be emitted only after at least 150 valid go trials and 50 stop trials, 25-75% stop success, complete stop-signal-delay capture, no more than 10% go omissions, at least 80% go accuracy, and a passed failed-stop-versus-go race-model check.',
                'Go accuracy, correct go RT, omissions, stop success, mean stop-signal delay, and premature responses must remain separate.'
            );
            break;
        case 'Signal Window':
            guidance.push(
                'Signal Window must use a nine-arrow majority-direction task with balanced left and right answers and 5/9, 6/9, and 7/9 evidence levels.',
                'Response time must begin at arrow-field onset, and response keys must remain available while the field is visible.',
                'Decision accuracy and correct-response time must remain separate, with condition-level results and wrong-choice, timeout, and premature-response rates.',
                'Withhold overall correct-response time unless six valid correct responses remain and withhold an evidence-level response time unless two valid correct responses remain in that level.',
                'Position, labels, styling, or accessibility text must never reveal the correct direction.'
            );
            break;
        case 'Sequence Shift':
            guidance.push(
                'Sequence Shift must use cued letter-number classification with stable vowel-or-odd and consonant-or-even response keys.',
                'Rule, response side, repeat or switch status, and congruency must be cross-balanced with one fixed cue-to-stimulus interval and response window.',
                'Switch response-time cost must use correct artifact-valid trials, require at least eight valid repeat and eight valid switch trials, and keep accuracy visible beside response time.',
                'Old-rule responses count as perseverative errors only on eligible incongruent switch trials.'
            );
            break;
        case 'Endurance Lock':
            guidance.push(
                'Endurance Lock must use one visual-only signal-detection task with the same display, rule, 1500 ms response window, and scoring across six blocks.',
                'Only the 1500-3500 ms foreperiod may vary unpredictably within the scored session.',
                'The headline response-time change must be a fitted slope and must be withheld unless at least 24 valid responses remain and every scored block contains at least three.',
                'Responses at or above the declared 500 ms threshold, false starts, timeouts, variability, and per-block valid counts must stay separate, and the task must not identify fatigue or its cause.'
            );
            break;
        default:
            break;
    }

    switch (archetype) {
        case 'visual_channel':
            guidance.push(
                'Visual-channel packaging may change framing or assets outside scored trials, but it may not change the canonical scored task or timing.',
                'Any scored visual manipulation requires a separately balanced protocol and cannot silently replace the family measurement contract.'
            );
            break;
        case 'audio_channel':
            guidance.push(
                'Audio-channel variants should log audio route, output-device class, and sound subtype tags using canonical enums.'
            );
            break;
        case 'combined_channel':
            guidance.push(
                'Combined-channel variants should define overlap timing, per-channel trigger tags, and approved co-occurrence rules.'
            );
            break;
        case 'sport_context':
            guidance.push(
                'Sport-context variants should keep the underlying task stable while making sport, scenario, and phase-of-play tags inspectable.'
            );
            break;
        case 'fatigue_load':
            guidance.push(
                'Fatigue-load naming is packaging only: it may not ramp difficulty, stakes, clutter, cadence, rest, or display load over canonical scored trials or support a causal fatigue claim.'
            );
            break;
        case 'trial':
            guidance.push(
                'Trial variants must define a fully locked profile with fixed seed, device class, duration, modifier profile, and validity rules.'
            );
            break;
        default:
            break;
    }

    if (family === 'Endurance Lock' && archetype === 'visual_channel') {
        guidance.push(
            'Endurance Lock visual-channel packaging must keep the same visual signal, display load, rule, response window, and scoring in all six scored blocks.',
            'If visual load is the research question, define a separate counterbalanced protocol; do not call its condition effect a time-on-task or fatigue effect.'
        );
    }

    if (guidance.length > 0) {
        guidance.push(
            'Athlete-facing instructions must say exactly what appears and what action to take; do not use metaphors such as live target or pressure starts.',
            'Athlete-facing copy must not moralize performance with labels such as clean, poor, weak, failed, or elite brain, and must spell out response time instead of RT.',
            'Every result explanation must remain task-specific and state what the task does not establish about competition, readiness, diagnosis, or stable traits.'
        );
    }

    return guidance;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { variant, seedSpec } = (req.body || {}) as VariantGenerationRequest;
    if (!variant?.name || !variant?.family || !seedSpec?.trim()) {
        return res.status(400).json({ error: 'Missing required fields: variant.name, variant.family, seedSpec' });
    }

    const trimmedSeed = seedSpec.trim();
    if (trimmedSeed.length > MAX_SPEC_CHARS) {
        return res.status(400).json({ error: `Seed spec exceeds ${MAX_SPEC_CHARS} characters` });
    }

    const model = sanitizeModelName(process.env.PULSECHECK_SPEC_GENERATION_MODEL);
    const openai = new OpenAI({ apiKey });
    const familyGuidance = getFamilyGoldStandardGuidance(variant);

    try {
        const completion = await openai.chat.completions.create({
            model,
            temperature: 0.2,
            max_completion_tokens: 3600,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'You are the PulseCheck variant spec generator. ' +
                        'Write production-grade registry specs for mental performance sims. ' +
                        'Treat the provided seed spec as the canonical section template, then strengthen it into a gold-standard draft for the given variant. ' +
                        'Preserve the numbered section layout and registry tone. ' +
                        'Be concrete about modifier matrices, trial profiles, analytics vocabularies, assignment logic, and family boundary protections. ' +
                        'Treat each family as having its own gold-standard publishing rules; do not produce generic placeholder sections when the family implies a stricter standard. ' +
                        'Keep strong existing lines from the scaffold whenever possible instead of rewriting everything. ' +
                        'Prioritize improving the weakest sections rather than expanding every section. ' +
                        'Return valid JSON only with exactly this shape: {"summary":"...", "generatedSpecRaw":"full spec text"}',
                },
                {
                    role: 'user',
                    content:
                        `Variant metadata:\n${JSON.stringify(variant, null, 2)}\n\n` +
                        `Family-specific gold-standard requirements:\n- ${familyGuidance.join('\n- ')}\n\n` +
                        `Seed spec scaffold:\n${trimmedSeed}\n\n` +
                        'Generate the strongest first-pass spec you can for this variant. ' +
                        'Aim for a concise governing spec, not a bloated rewrite. ' +
                        'If the family guidance calls for schema-grade enums, fixed profiles, or formulaic segmentation, actually write those into the spec. ' +
                        'If the seed already contains good language, preserve it and only improve what is weak or underspecified.',
                },
            ],
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: 'No AI generation content returned' });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            console.error('[generate-variant-spec] Failed to parse AI response:', error);
            return res.status(500).json({ error: 'Invalid AI generation response format' });
        }

        const generatedSpecRaw = typeof parsed?.generatedSpecRaw === 'string' && parsed.generatedSpecRaw.trim()
            ? parsed.generatedSpecRaw.trim()
            : trimmedSeed;
        const summary = typeof parsed?.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : 'AI generation completed.';

        return res.status(200).json({
            success: true,
            model,
            summary,
            generatedSpecRaw,
        });
    } catch (error: any) {
        console.error('[generate-variant-spec] AI generation failed:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to generate variant spec',
        });
    }
}
