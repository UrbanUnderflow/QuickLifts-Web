import { Handler } from '@netlify/functions';

// ============================================================================
// SECTION-BASED DOCUMENT EDITING
// Parse documents by ## headers, edit sections atomically
// ============================================================================

interface DocumentSection {
  header: string;      // The full header line (e.g., "## 8. Fees and Payment")
  headerKey: string;   // Normalized key for matching (e.g., "8. fees and payment")
  content: string;     // Everything from this header to the next (includes header)
  startIndex: number;  // Position in original document
}

/**
 * Parse a document into sections based on ## headers
 */
function parseDocumentSections(content: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const headerRegex = /^(## .+)$/gm;
  const matches = [...content.matchAll(headerRegex)];
  
  if (matches.length === 0) {
    // No headers found - treat entire document as one section
    return [{
      header: '## Document',
      headerKey: 'document',
      content: content,
      startIndex: 0
    }];
  }
  
  // Add preamble (content before first header) if any
  if (matches[0].index && matches[0].index > 0) {
    const preamble = content.slice(0, matches[0].index).trim();
    if (preamble) {
      sections.push({
        header: '## Preamble',
        headerKey: 'preamble',
        content: preamble + '\n\n',
        startIndex: 0
      });
    }
  }
  
  // Extract each section
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const header = match[1];
    const startIndex = match.index!;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const sectionContent = content.slice(startIndex, endIndex);
    
    // Create normalized key: lowercase, remove special chars, keep numbers and words
    const headerKey = header
      .replace(/^##\s*/, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
    
    sections.push({
      header,
      headerKey,
      content: sectionContent,
      startIndex
    });
  }
  
  return sections;
}

/**
 * Reconstruct document from sections
 */
function rebuildDocument(sections: DocumentSection[]): string {
  return sections.map(s => s.content).join('');
}

/**
 * Apply section edits to document
 */
function applySectionEdits(
  originalContent: string,
  edits: Array<{ headerKey: string; newContent: string; action: 'replace' | 'insert_after' | 'delete' }>
): { content: string; appliedCount: number; failures: string[] } {
  const sections = parseDocumentSections(originalContent);
  const failures: string[] = [];
  let appliedCount = 0;
  
  for (const edit of edits) {
    const normalizedKey = edit.headerKey.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Find matching section (fuzzy match on key)
    const sectionIndex = sections.findIndex(s => {
      // Exact match
      if (s.headerKey === normalizedKey) return true;
      // Partial match (key contains or is contained by)
      if (s.headerKey.includes(normalizedKey) || normalizedKey.includes(s.headerKey)) return true;
      // Number-based match (e.g., "8" matches "8 fees and payment")
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
      // Ensure new content ends with proper spacing
      let newContent = edit.newContent.trim();
      if (!newContent.endsWith('\n\n')) {
        newContent += '\n\n';
      }
      sections[sectionIndex].content = newContent;
      appliedCount++;
    } else if (edit.action === 'insert_after') {
      // Insert new section after the matched one
      let newContent = edit.newContent.trim();
      if (!newContent.endsWith('\n\n')) {
        newContent += '\n\n';
      }
      sections.splice(sectionIndex + 1, 0, {
        header: newContent.match(/^## .+/m)?.[0] || '## New Section',
        headerKey: 'inserted',
        content: newContent,
        startIndex: -1 // Will be recalculated
      });
      appliedCount++;
    } else if (edit.action === 'delete') {
      sections.splice(sectionIndex, 1);
      appliedCount++;
    }
  }
  
  return {
    content: rebuildDocument(sections),
    appliedCount,
    failures
  };
}

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
    const { documentId, currentContent, revisionPrompt, documentType, originalPrompt, requiresSignature, mode, excerpts, sections: inputSections } = body;

    const hasExcerpts = Array.isArray(excerpts) && excerpts.some((e: any) => typeof e === 'string' && e.trim().length > 0);
    const shouldUsePatches = mode === 'patches' && hasExcerpts;
    const shouldUseSections = mode === 'sections' && currentContent;

    if (!currentContent && !shouldUsePatches && !shouldUseSections) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Missing required field: currentContent' }) 
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

    // ========================================================================
    // SECTION-BASED MODE: Fast, reliable section replacement
    // ========================================================================
    const buildSectionMessages = () => {
      // Parse document into sections
      const docSections = parseDocumentSections(currentContent);
      
      // Build a concise section map for the AI
      const sectionSummary = docSections.map((s, i) => {
        const preview = s.content.slice(0, 200).replace(/\n/g, ' ').trim();
        return `[${i}] ${s.header}\n    Preview: ${preview}...`;
      }).join('\n');
      
      const system = `You are a document revision assistant using SECTION-BASED editing.

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
- For insert_after: new section is inserted AFTER the referenced section
- Keep edits minimal - only edit sections that need changes

requiresSignature: ${Boolean(requiresSignature) ? 'TRUE' : 'FALSE'}
- If FALSE: remove signature blocks from any edited sections
- If TRUE: preserve or add signature sections as needed`;

      const user = `DOCUMENT SECTIONS:
${sectionSummary}

FULL SECTION CONTENTS:
${docSections.map((s, i) => `\n--- SECTION [${i}] ---\n${s.content}\n--- END SECTION [${i}] ---`).join('\n')}

REVISION INSTRUCTIONS:
${revisionPrompt}

Return only the JSON object with your edits.`;

      return [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: user },
      ];
    };

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

CRITICAL RULES (MUST FOLLOW):
1. The document MAY HAVE FORMATTING ERRORS like missing newlines, concatenated text, or duplicate phrases.
   Example: "### 8.1 General StructureFees shall" (missing newline between header and content)
   Example: "This survives.This survives." (duplicated without space)
   
2. You MUST use EXACTLY what appears in the EXCERPTS, including any formatting errors.
   - If excerpt shows "StructureFees" (concatenated), use "StructureFees" in old_text
   - Do NOT "fix" or "correct" the old_text - copy the EXACT corrupted text
   
3. Anchors and old_text MUST be copied CHARACTER-FOR-CHARACTER from excerpts.
   - Do NOT add newlines that aren't there
   - Do NOT add spaces that aren't there
   - Do NOT remove text that is there
   
4. KEEP PATCHES SMALL AND EFFICIENT:
   - For replace_exact: Use the SHORTEST unique text that identifies the location (50-150 chars ideal)
   - Do NOT copy entire paragraphs if a unique phrase will do
   - Example: Instead of old_text="## 1. Purpose\n\nThis Agreement governs the licensing and use of..." (300+ chars)
     Use: old_text="## 1. Purpose" with replace_between or insert_after
   - Prefer replace_between with short anchors over replace_exact with long old_text
   
5. Prefer patches that target a single, specific location using unique anchors.

PATCH TYPES (choose the safest):
- replace_exact: { "type":"replace_exact","old_text":"...","new_text":"..." }
- replace_between: { "type":"replace_between","start_anchor":"...","end_anchor":"...","new_text":"...","keep_anchors":true }
- insert_after: { "type":"insert_after","after_anchor":"...","insert_text":"..." }
- delete_between: { "type":"delete_between","start_anchor":"...","end_anchor":"...","keep_anchors":true }

OUTPUT FORMAT (STRICT):
{ "patches": [ ... ], "summary": "short optional" }

NOTES:
- Use keep_anchors=true unless you are certain anchors should be removed.
- If you need to replace a paragraph, use replace_exact with the exact old paragraph text if it is unique.
- The new_text CAN and SHOULD have proper formatting (correct newlines, etc.) - only old_text must match the corrupted document exactly.`;

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

    const requestBody = shouldUseSections
      ? {
          model: 'gpt-4o-mini',
          messages: buildSectionMessages(),
          temperature: 0.2,
          max_tokens: 8000, // Sections can be long
          response_format: { type: 'json_object' },
        }
      : shouldUsePatches
      ? {
          model: 'gpt-4o-mini',
          messages: buildPatchMessages(),
          temperature: 0.2,
          max_tokens: 4000,
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

    // Section mode: parse JSON and apply section edits
    if (shouldUseSections) {
      const extractJSON = (rawContent: string): any => {
        try { return JSON.parse(rawContent); } catch { /* continue */ }
        const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
        }
        const jsonMatch = rawContent.match(/\{[\s\S]*"edits"[\s\S]*\}/);
        if (jsonMatch) {
          try { return JSON.parse(jsonMatch[0]); } catch { /* continue */ }
        }
        return null;
      };

      const parsed = extractJSON(content);
      
      if (parsed && Array.isArray(parsed?.edits)) {
        // Convert AI response to our edit format
        const docSections = parseDocumentSections(currentContent);
        const edits = parsed.edits.map((edit: any) => {
          // Resolve section by index or headerKey
          let headerKey = edit.headerKey || '';
          if (typeof edit.sectionIndex === 'number' && docSections[edit.sectionIndex]) {
            headerKey = docSections[edit.sectionIndex].headerKey;
          }
          return {
            headerKey,
            newContent: edit.newContent || '',
            action: edit.action || 'replace'
          };
        });
        
        const result = applySectionEdits(currentContent, edits);
        
        if (result.failures.length > 0 && result.appliedCount === 0) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Failed to apply section edits',
              failures: result.failures,
              mode: 'sections'
            }),
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            mode: 'sections',
            content: result.content,
            appliedCount: result.appliedCount,
            failures: result.failures,
            summary: parsed.summary,
            documentId,
          }),
        };
      }

      // Parsing failed
      console.error('[revise-legal-document] Failed to parse section edits:', content.substring(0, 500));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to parse section edits from AI response',
          rawPreview: content.substring(0, 300),
        }),
      };
    }

    // Patch mode: parse JSON and return patches
    if (shouldUsePatches) {
      // Helper function to extract JSON from potentially wrapped content
      const extractJSON = (rawContent: string): any => {
        // Strategy 1: Try direct parse
        try {
          return JSON.parse(rawContent);
        } catch {
          // Continue to other strategies
        }

        // Strategy 2: Extract from markdown code blocks
        const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          try {
            return JSON.parse(codeBlockMatch[1].trim());
          } catch {
            // Continue
          }
        }

        // Strategy 3: Find JSON object pattern in the response
        const jsonMatch = rawContent.match(/\{[\s\S]*"patches"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            // Continue
          }
        }

        // Strategy 4: Try to find any valid JSON object
        const anyJsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (anyJsonMatch) {
          try {
            return JSON.parse(anyJsonMatch[0]);
          } catch {
            // Give up
          }
        }

        return null;
      };

      const parsed = extractJSON(content);
      
      if (parsed && Array.isArray(parsed?.patches)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            mode: 'patches',
            patches: parsed.patches,
            summary: typeof parsed?.summary === 'string' ? parsed.summary : undefined,
            documentId,
          }),
        };
      }

      // Parsing failed - provide detailed error
      console.error('[revise-legal-document] Failed to parse AI response:', content.substring(0, 500));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to parse patch JSON from model output. The AI may have returned invalid JSON or non-JSON content.',
          rawPreview: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
        }),
      };
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
