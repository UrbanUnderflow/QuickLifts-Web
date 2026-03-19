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
                'Reset specs must define valid re-engagement as two consecutive correct responses on the refocused task.',
                'Reset specs must define false starts as responses during the disruption phase before the reset signal.',
                'Attentional Shifting must stay multi-source and Pressure Stability must stay modifier-stratified.',
                'Do not let modifier packaging change the task identity; if the disruption creates a new problem, treat it as a build defect.'
            );
            break;
        case 'Noise Gate':
            guidance.push(
                'Noise Gate specs must define Distractor Cost explicitly and report RT shift beside it.',
                'False alarms must be distractor-directed responses and must be classified by distractor type.',
                'Channel Vulnerability must be broken down by channel or distractor class, not flattened into one unlabeled score.'
            );
            break;
        case 'Brake Point':
            guidance.push(
                'Brake Point specs must define valid Go behavior, Stop Latency, and the 150 ms artifact floor explicitly.',
                'False alarms must be classified by No-Go type such as obvious, fakeout, and late-reveal.',
                'Over-inhibition must be tracked so slowing down cannot masquerade as better inhibitory control.'
            );
            break;
        case 'Signal Window':
            guidance.push(
                'Signal Window specs must define the valid response as the first committed response after display onset.',
                'Correct Read Under Time Pressure must preserve both read quality and decision latency instead of reducing to generic speed.',
                'Window Utilization and decoy susceptibility must remain interpretable supporting outputs.'
            );
            break;
        case 'Sequence Shift':
            guidance.push(
                'Sequence Shift specs must define the post-shift scoring window explicitly, usually the first 3-5 trials after a rule change.',
                'Old-rule intrusions must be separated from novel errors.',
                'Switch Cost must remain visible beside update accuracy, and the 150 ms artifact floor must be preserved.'
            );
            break;
        case 'Endurance Lock':
            guidance.push(
                'Endurance Lock specs must use fixed or formulaic block segmentation rather than flexible prose like "first 2-3 minutes."',
                'Define baseline, middle, and finish blocks explicitly so Baseline Performance, Degradation Onset, and Degradation Slope are reproducible.',
                'If late-session pressure exists, define named normalized pressure profiles rather than treating scoring weight, consequence, and time pressure as interchangeable.',
                'Training-mode adaptation may tune load inside family bounds, but it may not change the task identity, block schema, or headline measurement logic.'
            );
            break;
        default:
            break;
    }

    switch (archetype) {
        case 'visual_channel':
            guidance.push(
                'Visual-channel variants should define runtime modifiers concretely, including modifier co-occurrence and tier rules.',
                'Analytics vocabularies should enumerate display-state tags such as contrast, density, and peripheral load instead of using vague placeholders.'
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
                'Fatigue-load variants should define one named modifier profile, one fixed or formulaic block structure, and one schema-grade analytics vocabulary for block identity, device class, delivery surface, and modifier profile identifiers.'
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
            'Endurance Lock visual-channel variants must still use fixed or formulaic six-block segmentation with explicit baseline, middle, and finish windows.',
            'Define one named visual profile per published module and do not mix clutter, peripheral-bait, or contrast-decay profile ids inside a single build.',
            'Use schema-grade enums for visual profile id, visual density tier, peripheral load tier, contrast profile, block identity, device class, and delivery surface.'
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
