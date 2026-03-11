import type { NextApiRequest, NextApiResponse } from 'next';

// Increase body size limit for large legal documents
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

// ============================================================================
// SECTION-BASED DOCUMENT EDITING
// ============================================================================

interface DocumentSection {
    header: string;
    headerKey: string;
    content: string;
    startIndex: number;
}

function parseDocumentSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const headerRegex = /^(## .+)$/gm;
    const matches = [...content.matchAll(headerRegex)];

    if (matches.length === 0) {
        return [{ header: '## Document', headerKey: 'document', content, startIndex: 0 }];
    }

    if (matches[0].index && matches[0].index > 0) {
        const preamble = content.slice(0, matches[0].index).trim();
        if (preamble) {
            sections.push({ header: '## Preamble', headerKey: 'preamble', content: preamble + '\n\n', startIndex: 0 });
        }
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const header = match[1];
        const startIndex = match.index!;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index! : content.length;
        const sectionContent = content.slice(startIndex, endIndex);
        const headerKey = header.replace(/^##\s*/, '').toLowerCase().replace(/[^\w\s]/g, '').trim();
        sections.push({ header, headerKey, content: sectionContent, startIndex });
    }

    return sections;
}

function rebuildDocument(sections: DocumentSection[]): string {
    return sections.map(s => s.content).join('');
}

function applySectionEdits(
    originalContent: string,
    edits: Array<{ headerKey: string; newContent: string; action: 'replace' | 'insert_after' | 'delete' }>
): { content: string; appliedCount: number; failures: string[] } {
    const sections = parseDocumentSections(originalContent);
    const failures: string[] = [];
    let appliedCount = 0;

    for (const edit of edits) {
        const normalizedKey = edit.headerKey.toLowerCase().replace(/[^\w\s]/g, '').trim();

        const sectionIndex = sections.findIndex(s => {
            if (s.headerKey === normalizedKey) return true;
            if (s.headerKey.includes(normalizedKey) || normalizedKey.includes(s.headerKey)) return true;
            const editNum = normalizedKey.match(/^(\d+)/)?.[1];
            const sectionNum = s.headerKey.match(/^(\d+)/)?.[1];
            if (editNum && sectionNum && editNum === sectionNum) return true;
            return false;
        });

        if (sectionIndex === -1) {
            failures.push(`Section not found: "${edit.headerKey}"`);
            continue;
        }

        if (edit.action === 'replace') {
            let newContent = edit.newContent.trim();
            if (!newContent.endsWith('\n\n')) newContent += '\n\n';
            sections[sectionIndex].content = newContent;
            appliedCount++;
        } else if (edit.action === 'insert_after') {
            let newContent = edit.newContent.trim();
            if (!newContent.endsWith('\n\n')) newContent += '\n\n';
            sections.splice(sectionIndex + 1, 0, {
                header: newContent.match(/^## .+/m)?.[0] || '## New Section',
                headerKey: 'inserted',
                content: newContent,
                startIndex: -1,
            });
            appliedCount++;
        } else if (edit.action === 'delete') {
            sections.splice(sectionIndex, 1);
            appliedCount++;
        }
    }

    return { content: rebuildDocument(sections), appliedCount, failures };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('[revise-legal-document] Request received');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        console.error('[revise-legal-document] Missing OPENAI_API_KEY');
        return res.status(500).json({ error: 'OpenAI API key not configured (OPENAI_API_KEY)' });
    }

    const { documentId, currentContent, revisionPrompt, documentType, originalPrompt, requiresSignature, mode } = req.body;

    console.log('[revise-legal-document] mode:', mode, '| contentLength:', currentContent?.length, '| prompt:', revisionPrompt?.substring(0, 80));

    if (!currentContent) {
        return res.status(400).json({ error: 'Missing required field: currentContent' });
    }
    if (!revisionPrompt || !String(revisionPrompt).trim()) {
        return res.status(400).json({ error: 'Missing or empty revisionPrompt.' });
    }

    const shouldUseSections = mode === 'sections';

    try {
        let messages: { role: 'system' | 'user'; content: string }[];

        if (shouldUseSections) {
            const docSections = parseDocumentSections(currentContent);
            console.log('[revise-legal-document] Parsed', docSections.length, 'sections');

            const sectionSummary = docSections.map((s, i) => {
                const preview = s.content.slice(0, 200).replace(/\n/g, ' ').trim();
                return `[${i}] ${s.header}\n    Preview: ${preview}...`;
            }).join('\n');

            messages = [
                {
                    role: 'system',
                    content: `You are a document revision assistant using SECTION-BASED editing.

The document has been parsed into numbered sections. You will:
1. Identify which sections need changes based on the revision instructions
2. Return COMPLETE replacement content for those sections

RESPONSE FORMAT (JSON only):
{
  "edits": [
    {
      "sectionIndex": 0,
      "headerKey": "1 purpose",
      "action": "replace",
      "newContent": "## 1. Purpose\\n\\nNew content here..."
    }
  ],
  "summary": "Brief description of changes"
}

RULES:
- action can be: "replace", "insert_after", or "delete"
- newContent must include the ## header line for replace/insert_after
- Use proper markdown formatting (## for headers, ### for subsections, - for bullets)
- Preserve section numbering unless specifically asked to renumber
- Keep edits minimal - only edit sections that need changes

requiresSignature: ${Boolean(requiresSignature) ? 'TRUE' : 'FALSE'}
- If FALSE: remove signature blocks from any edited sections
- If TRUE: preserve or add signature sections as needed`,
                },
                {
                    role: 'user',
                    content: `DOCUMENT SECTIONS:
${sectionSummary}

FULL SECTION CONTENTS:
${docSections.map((s, i) => `\n--- SECTION [${i}] ---\n${s.content}\n--- END SECTION [${i}] ---`).join('\n')}

REVISION INSTRUCTIONS:
${revisionPrompt}

Return only the JSON object with your edits.`,
                },
            ];
        } else {
            messages = [
                {
                    role: 'system',
                    content: `You are a document revision assistant. Revise the document according to the instructions.
- Preserve existing structure and numbering unless asked to change it.
- Use proper markdown formatting (## headers, - bullets, **bold**).
- Output ONLY the revised document text, no preamble or explanation.
requiresSignature: ${Boolean(requiresSignature) ? 'TRUE' : 'FALSE'}
- If FALSE: remove signature blocks.
- If TRUE: preserve or add signature sections.`,
                },
                {
                    role: 'user',
                    content: `Here is the document:\n---\n${currentContent}\n---\n\nOriginal context: ${originalPrompt || 'N/A'}\nDocument type: ${documentType || 'Legal Document'}\n\nRevision instructions:\n${revisionPrompt}\n\nReturn the complete revised document.`,
                },
            ];
        }

        const requestBody = shouldUseSections
            ? {
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.2,
                max_tokens: 8000,
                response_format: { type: 'json_object' },
            }
            : {
                model: 'gpt-4o',
                messages,
                temperature: 0.2,
                max_tokens: 16384,
            };

        console.log('[revise-legal-document] Calling OpenAI with model:', (requestBody as any).model);

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
            body: JSON.stringify(requestBody),
        });

        console.log('[revise-legal-document] OpenAI response status:', openaiRes.status);

        if (!openaiRes.ok) {
            const errorData = await openaiRes.json().catch(() => ({}));
            const errMsg = (errorData as any)?.error?.message || `OpenAI returned ${openaiRes.status}`;
            console.error('[revise-legal-document] OpenAI error:', errMsg);
            return res.status(500).json({ error: errMsg });
        }

        const data = await openaiRes.json();
        const aiContent = data.choices?.[0]?.message?.content;
        if (!aiContent) {
            return res.status(500).json({ error: 'No content generated by AI' });
        }

        console.log('[revise-legal-document] AI content length:', aiContent.length);

        if (shouldUseSections) {
            const extractJSON = (raw: string): any => {
                try { return JSON.parse(raw); } catch { /* continue */ }
                const cbMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (cbMatch) { try { return JSON.parse(cbMatch[1].trim()); } catch { /* continue */ } }
                const jMatch = raw.match(/\{[\s\S]*"edits"[\s\S]*\}/);
                if (jMatch) { try { return JSON.parse(jMatch[0]); } catch { /* continue */ } }
                return null;
            };

            const parsed = extractJSON(aiContent);
            if (parsed && Array.isArray(parsed?.edits)) {
                const docSections = parseDocumentSections(currentContent);
                const edits = parsed.edits.map((edit: any) => {
                    let headerKey = edit.headerKey || '';
                    if (typeof edit.sectionIndex === 'number' && docSections[edit.sectionIndex]) {
                        headerKey = docSections[edit.sectionIndex].headerKey;
                    }
                    return { headerKey, newContent: edit.newContent || '', action: edit.action || 'replace' };
                });

                const result = applySectionEdits(currentContent, edits);
                console.log('[revise-legal-document] Applied', result.appliedCount, 'edits, failures:', result.failures);

                if (result.failures.length > 0 && result.appliedCount === 0) {
                    return res.status(500).json({ error: 'Failed to apply section edits', failures: result.failures, mode: 'sections' });
                }

                return res.status(200).json({
                    success: true,
                    mode: 'sections',
                    content: result.content,
                    appliedCount: result.appliedCount,
                    failures: result.failures,
                    summary: parsed.summary,
                    documentId,
                });
            }

            console.error('[revise-legal-document] Failed to parse AI JSON:', aiContent.substring(0, 300));
            return res.status(500).json({ error: 'Failed to parse section edits from AI response', rawPreview: aiContent.substring(0, 300) });
        }

        return res.status(200).json({ success: true, mode: 'full', content: aiContent, documentId });
    } catch (error) {
        console.error('[revise-legal-document] Caught error:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to revise document' });
    }
}
