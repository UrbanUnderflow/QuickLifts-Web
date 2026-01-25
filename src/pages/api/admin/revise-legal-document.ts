import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, currentContent, revisionPrompt, documentType, originalPrompt, requiresSignature } = req.body;

  if (!currentContent) {
    return res.status(400).json({ error: 'Missing required field: currentContent' });
  }

  if (!revisionPrompt || !revisionPrompt.trim()) {
    return res.status(400).json({ error: 'Missing or empty revisionPrompt. Please provide revision instructions or update only the title without calling this API.' });
  }

  const openaiApiKey = process.env.OPEN_AI_SECRET_KEY;
  
  if (!openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
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
            role: 'user',
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
        ],
        temperature: 0.2,
        // Increased from 4000 to 16384 (GPT-4o max) to prevent document truncation
        // TODO: Consider implementing a diff-based approach where we only send changed sections
        // and merge locally to reduce token usage for very large documents
        max_tokens: 16384
      })
    });

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
      
      return res.status(statusCode).json({ 
        error: userFriendlyMessage,
        errorType: errorType,
        details: process.env.NODE_ENV === 'development' ? errorData : undefined
      });
    }

    const data = await response.json();
    const revisedContent = data.choices[0]?.message?.content;

    if (!revisedContent) {
      return res.status(500).json({ error: 'No revised content generated' });
    }

    // Extract title if it changed
    const lines = revisedContent.split('\n').filter((line: string) => line.trim());
    let title = null;
    
    if (lines[0] && !lines[0].includes('EFFECTIVE DATE') && !lines[0].toLowerCase().startsWith('this')) {
      const potentialTitle = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      if (potentialTitle.length < 100) {
        title = potentialTitle;
      }
    }

    return res.status(200).json({
      success: true,
      content: revisedContent,
      title: title,
      documentId: documentId
    });

  } catch (error) {
    console.error('Error revising legal document:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to revise document' 
    });
  }
}
