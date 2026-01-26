import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { documentId, currentContent, revisionPrompt, documentType, originalPrompt, requiresSignature, mode, excerpts } = body;

    const hasExcerpts = Array.isArray(excerpts) && excerpts.some((e: any) => typeof e === 'string' && e.trim().length > 0);
    const shouldUsePatches = mode === 'patches' && hasExcerpts;

    if (!currentContent && !shouldUsePatches) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Missing required field: currentContent (or provide mode=\"patches\" with excerpts[])' }) 
      };
    }

    if (!revisionPrompt || !revisionPrompt.trim()) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Missing or empty revisionPrompt. Please provide revision instructions or update only the title without calling this API.' }) 
      };
    }

    const openaiApiKey = process.env.OPEN_AI_SECRET_KEY;
    
    if (!openaiApiKey) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'OpenAI API key not configured' }) 
      };
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 25_000);

    const buildLegacyMessages = () => ([
      {
        role: 'system' as const,
        content: `You are a document revision assistant for professional business/legal/technical documents. You will receive:
1) an existing document
2) the original context/prompt
3) revision instructions

Your job is to produce a CLEAN, final, fully revised document that INTEGRATES the requested changes into the existing structure.

FORMATTING RULES (CRITICAL FOR RENDERING):
- For bullet lists, ALWAYS use "- " (dash followed by space) at the start of each item. Example:
  - First item
  - Second item
  - Third item
- For numbered lists, use "1. ", "2. ", etc. (number, period, space). Example:
  1. First step
  2. Second step
- For sub-bullets/nested items, use "  - " (two spaces, dash, space)
- DO NOT use plain text lists without bullet markers
- DO NOT use "•" Unicode bullets - use "-" or "*" instead
- Use "## " for section headers, "### " for subsections
- Use "**text**" for bold emphasis

CORE BEHAVIOR (CRITICAL):
- Do NOT append new sections like "ADDITIONAL CONTENT FROM ORIGINAL PROMPT" or "NOTES" that dump instructions verbatim.
- If the revision says content is missing, you MUST weave that content into the appropriate existing sections (or create properly numbered sections and include them in the Table of Contents if truly new).
- Do NOT paste the user's prompt as a block. Convert it into prose/bullets in the correct places.
- Preserve existing intent and keep unchanged sections as-is unless the revision requires edits.
- Keep numbering consistent. If you add a section, update the TOC and renumber accordingly.
- Preserve signature blocks and formal elements if present.
- Replace placeholder tokens like [Company Name], [Insert Date], [Amount] when the revision provides the real values. If not provided, leave placeholders but DO NOT introduce new placeholders.

SIGNATURE RULE (STRICT):
- requiresSignature is ${Boolean(requiresSignature) ? 'TRUE' : 'FALSE'}.
- If requiresSignature is FALSE: remove/avoid signature blocks, signature lines, and "IN WITNESS WHEREOF" sections. Do not add signature placeholders.
- If requiresSignature is TRUE: keep signature sections if present; if missing and appropriate, add a standard signature section at the end.

OUTPUT FORMAT (STRICT):
- Return ONLY the revised document text.
- No preamble, no explanation, no analysis.

QUALITY BAR:
- The result should read as if a human authored a single cohesive document, not a stitched-together paste.`
      },
      {
        role: 'user' as const,
        content: `Here is the original document that needs revision:

---
${currentContent}
---

Original context/prompt for this document: ${originalPrompt || 'Not provided'}
Document type: ${documentType || 'Legal Document'}

Please apply the following revisions:
${revisionPrompt}

Return the complete revised document with all changes applied.`
      }
    ]);

    const buildPatchMessages = () => {
      const safeExcerpts = (Array.isArray(excerpts) ? excerpts : [])
        .filter((e: any) => typeof e === 'string' && e.trim().length > 0)
        .slice(0, 10)
        .map((e: string) => e.length > 5000 ? e.slice(0, 5000) : e);

      const system = `You are a document revision assistant. You will receive:
1) EXCERPTS from a longer document (NOT the full document)
2) the original context/prompt (optional)
3) revision instructions

Your job is to return a JSON object ONLY (no markdown) containing patches that can be applied to the FULL document locally.

CRITICAL RULES:
- Anchors MUST be copied verbatim from the provided EXCERPTS (exact substring match).
- Prefer patches that target a single, specific location using unique anchors.
- Do NOT invent anchors and do NOT paraphrase anchors.
- Keep patches as small as possible while fully applying the revision.

PATCH TYPES (choose the safest):
- replace_exact: { "type":"replace_exact","old_text":"...","new_text":"..." }
- replace_between: { "type":"replace_between","start_anchor":"...","end_anchor":"...","new_text":"...","keep_anchors":true }
- insert_after: { "type":"insert_after","after_anchor":"...","insert_text":"..." }
- delete_between: { "type":"delete_between","start_anchor":"...","end_anchor":"...","keep_anchors":true }

OUTPUT FORMAT (STRICT):
{ "patches": [ ... ], "summary": "short optional" }

NOTES:
- Use keep_anchors=true unless you are certain anchors should be removed.
- If you need to replace a paragraph, use replace_exact with the exact old paragraph text if it is unique.`;

      const user = `EXCERPTS (verbatim, use these for anchors only):

${safeExcerpts.map((e: string, i: number) => `--- EXCERPT ${i + 1} ---\n${e}\n--- END EXCERPT ${i + 1} ---`).join('\n\n')}

Original context/prompt for this document: ${originalPrompt || 'Not provided'}
Document type: ${documentType || 'Legal Document'}
requiresSignature: ${Boolean(requiresSignature) ? 'TRUE' : 'FALSE'}

Revision instructions:
${revisionPrompt}

Return ONLY the JSON object.`;

      return [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: user },
      ];
    };

    const requestBody = shouldUsePatches
      ? {
          model: 'gpt-4o-mini',
          messages: buildPatchMessages(),
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
        }
      : {
          model: 'gpt-4o',
          messages: buildLegacyMessages(),
          temperature: 0.2,
          max_tokens: 16384,
        };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error('OpenAI API error:', errorData);
      
      // Handle specific OpenAI error types
      const errorType = errorData?.error?.type || errorData?.error?.code;
      const errorMessage = errorData?.error?.message || 'Unknown error';
      
      let userFriendlyMessage = 'Failed to revise document';
      let statusCode = 500;
      
      if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
        userFriendlyMessage = 'OpenAI API quota exceeded. This could be due to rate limits, account tier limits, or payment method issues. Please check your OpenAI account settings or try again later.';
        statusCode = 429; // Too Many Requests
      } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
        userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        statusCode = 429;
      } else if (errorType === 'invalid_api_key' || errorMessage.includes('API key')) {
        userFriendlyMessage = 'OpenAI API key is invalid or missing. Please check your configuration.';
        statusCode = 500;
      } else if (errorMessage) {
        // Include the actual error message for debugging
        userFriendlyMessage = `OpenAI API error: ${errorMessage}`;
      }
      
      return { 
        statusCode, 
        headers, 
        body: JSON.stringify({ 
          error: userFriendlyMessage,
          errorType: errorType,
          details: process.env.NODE_ENV === 'development' ? errorData : undefined
        }) 
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: shouldUsePatches ? 'No patch JSON generated' : 'No revised content generated' }) 
      };
    }

    // Patch mode: parse JSON and return patches
    if (shouldUsePatches) {
      try {
        const parsed = JSON.parse(content);
        const patches = Array.isArray(parsed?.patches) ? parsed.patches : [];
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            mode: 'patches',
            patches,
            summary: typeof parsed?.summary === 'string' ? parsed.summary : undefined,
            documentId,
          }),
        };
      } catch (e: any) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to parse patch JSON from model output',
            detail: process.env.NODE_ENV === 'development' ? (e?.message || String(e)) : undefined,
          }),
        };
      }
    }

    const revisedContent = content;

    // Extract title if it changed (legacy mode)
    const lines = revisedContent.split('\n').filter((line: string) => line.trim());
    let title = null;
    if (lines[0] && !lines[0].includes('EFFECTIVE DATE') && !lines[0].toLowerCase().startsWith('this')) {
      const potentialTitle = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      if (potentialTitle.length < 100) title = potentialTitle;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        mode: 'full',
        content: revisedContent,
        title: title,
        documentId: documentId
      })
    };

  } catch (error) {
    console.error('Error revising legal document:', error);
    const isAbort = (error as any)?.name === 'AbortError';
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: isAbort
          ? 'TimeoutError: Task timed out after 25 seconds'
          : (error instanceof Error ? error.message : 'Failed to revise document')
      }) 
    };
  }
};

export { handler };
