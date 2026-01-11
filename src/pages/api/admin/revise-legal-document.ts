import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, currentContent, revisionPrompt, documentType, originalPrompt } = req.body;

  if (!currentContent || !revisionPrompt) {
    return res.status(400).json({ error: 'Missing required fields: currentContent and revisionPrompt' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  
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
            content: `You are a legal document revision assistant. You will receive an existing legal document and specific revision instructions. Your job is to:

1. Carefully read the existing document
2. Apply the requested changes precisely as instructed
3. Maintain the overall structure and formatting of the document
4. Keep all unchanged sections exactly as they were
5. Ensure legal language consistency throughout

IMPORTANT RULES:
- Only modify the sections specified in the revision instructions
- Preserve all signature blocks and formal elements
- Maintain professional legal language
- If asked to fill in placeholders like [Company Name], replace them with the provided values
- Keep section numbering consistent
- Return the COMPLETE revised document, not just the changed parts`
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
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ error: 'Failed to revise document' });
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
