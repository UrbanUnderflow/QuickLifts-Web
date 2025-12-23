import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Webhook to capture email replies from Brevo
 * 
 * This endpoint receives inbound emails (replies to weekly check-ins)
 * and stores them as weekly context in Firestore
 * 
 * Brevo Inbound Parsing webhook should be configured to send to this URL
 */

interface BrevoInboundEmail {
  // Standard Brevo inbound fields
  From: {
    Address: string;
    Name?: string;
  };
  To: {
    Address: string;
    Name?: string;
  }[];
  Subject: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  MessageId?: string;
  // Custom headers we set
  Headers?: {
    'X-Review-Week'?: string;
    'X-Email-Type'?: string;
  }[];
  // Raw text content (preferred for context)
  RawTextBody?: string;
  StrippedTextReply?: string;
}

interface CaptureReplyResponse {
  success: boolean;
  contextId?: string;
  error?: string;
}

function getWeekNumber(): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfWeek = startOfMonth.getDay();
  const offsetDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const dayOfMonth = now.getDate();
  return Math.ceil((dayOfMonth + offsetDay) / 7);
}

function cleanEmailReply(text: string): string {
  if (!text) return '';
  
  // Remove common email reply artifacts
  let cleaned = text
    // Remove quoted text markers
    .replace(/^>.*$/gm, '')
    // Remove "On [date], [name] wrote:" patterns
    .replace(/On .+ wrote:$/gm, '')
    // Remove email signatures (common patterns)
    .replace(/^--\s*$/gm, '')
    .replace(/^Sent from my .+$/gim, '')
    .replace(/^Get Outlook for .+$/gim, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return cleaned;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CaptureReplyResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // Firebase Admin is initialized on import
    const db = getFirestore();
    
    // Parse the inbound email
    const email = req.body as BrevoInboundEmail;
    
    console.log('📨 Received inbound email:', {
      from: email.From?.Address,
      subject: email.Subject,
      hasTextBody: !!email.TextBody,
      hasHtmlBody: !!email.HtmlBody
    });

    // Extract the reply content (prefer stripped/text over HTML)
    const replyContent = cleanEmailReply(
      email.StrippedTextReply || email.TextBody || ''
    );

    if (!replyContent || replyContent.length < 10) {
      console.warn('⚠️ Empty or too short reply received');
      return res.status(200).json({ 
        success: true, 
        error: 'Reply content too short or empty' 
      });
    }

    // Determine the week/month/year
    const now = new Date();
    const weekNumber = getWeekNumber();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Create weekly context entry
    const contextRef = db.collection('reviewWeeklyContext').doc();
    const contextData = {
      id: contextRef.id,
      weekNumber,
      month,
      year,
      content: replyContent,
      source: 'email',
      emailSubject: email.Subject,
      emailFrom: email.From?.Address,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await contextRef.set(contextData);

    console.log(`✅ Weekly context saved from email reply:`, {
      id: contextRef.id,
      weekNumber,
      month,
      year,
      contentLength: replyContent.length
    });

    return res.status(200).json({
      success: true,
      contextId: contextRef.id
    });

  } catch (error) {
    console.error("Error capturing email reply:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
}

