import type { NextApiRequest, NextApiResponse } from 'next';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../../../netlify/functions/utils/emailSequenceHelpers';

/**
 * API endpoint to send weekly check-in email for review automation
 * 
 * This should be triggered by a cron job every Friday at 9am
 * The email asks the founder how the week went
 */

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Review Bot";
const FOUNDER_EMAIL = "tre@fitwithpulse.ai";
const FOUNDER_NAME = "Tremaine";

interface SendWeeklyCheckinResponse {
  success: boolean;
  messageId?: string;
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

function getCurrentMonthName(): string {
  return new Date().toLocaleString('default', { month: 'long' });
}

function getWeeklyCheckinEmailContent(weekNumber: number, monthName: string): string {
  const year = new Date().getFullYear();
  
  return `
    <html>
      <head>
        <style>
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f8fafc; 
            color: #334155; 
            line-height: 1.6;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background-color: #ffffff; 
            padding: 40px; 
            border-radius: 12px; 
            border: 1px solid #e2e8f0; 
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0;
          }
          .header p {
            color: #64748b;
            font-size: 14px;
            margin-top: 8px;
          }
          .content {
            font-size: 16px;
            line-height: 1.8;
          }
          .prompt-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 0 8px 8px 0;
          }
          .prompt-box h3 {
            margin: 0 0 8px 0;
            color: #92400e;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .prompt-box p {
            margin: 0;
            color: #78350f;
            font-size: 15px;
          }
          .examples {
            background-color: #f1f5f9;
            padding: 16px 20px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .examples h4 {
            margin: 0 0 12px 0;
            color: #475569;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .examples ul {
            margin: 0;
            padding-left: 20px;
            color: #64748b;
          }
          .examples li {
            margin-bottom: 6px;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center; 
            font-size: 12px; 
            color: #94a3b8; 
          }
          .cta {
            text-align: center;
            margin-top: 24px;
          }
          .cta p {
            color: #64748b;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Weekly Check-in</h1>
            <p>Week ${weekNumber} of ${monthName} ${year}</p>
          </div>
          
          <div class="content">
            <p>Hey ${FOUNDER_NAME},</p>
            
            <p>It's time for your weekly update. How did the week go?</p>
            
            <div class="prompt-box">
              <h3>💬 Just Reply to This Email</h3>
              <p>Share what happened this week - wins, challenges, progress on features, meetings, metrics... anything notable.</p>
            </div>
            
            <div class="examples">
              <h4>Ideas for what to include:</h4>
              <ul>
                <li>Key wins or milestones</li>
                <li>Features shipped or progress made</li>
                <li>Important meetings or partnerships</li>
                <li>User/subscriber updates</li>
                <li>Revenue or metrics changes</li>
                <li>Challenges or blockers</li>
                <li>What you're focused on next week</li>
              </ul>
            </div>
            
            <div class="cta">
              <p>Your reply will be saved and used to generate your monthly investor update automatically.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Pulse Review Automation • ${monthName} ${year}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendWeeklyCheckinResponse>
) {
  // Allow both GET (for cron) and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Verify cron secret for automated calls
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  
  // Only require secret in production
  if (process.env.NODE_ENV === 'production' && cronSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const weekNumber = getWeekNumber();
    const monthName = getCurrentMonthName();
    const year = new Date().getFullYear();
    
    const subject = `📊 Week ${weekNumber} Check-in: How did ${monthName} Week ${weekNumber} go?`;
    const htmlContent = getWeeklyCheckinEmailContent(weekNumber, monthName);

    console.log(`📧 Sending weekly check-in email for Week ${weekNumber} of ${monthName} ${year}`);

    const reviewWeekKey = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-W${weekNumber}`;
    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: FOUNDER_EMAIL,
      toName: FOUNDER_NAME,
      subject,
      htmlContent,
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      replyTo: {
        email: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      headers: {
        'X-Review-Week': reviewWeekKey,
        'X-Email-Type': 'weekly-review-checkin',
      },
      idempotencyKey: buildEmailDedupeKey(['review-api-weekly-checkin-v1', reviewWeekKey]),
      idempotencyMetadata: {
        sequence: 'review-api-weekly-checkin',
        reviewWeekKey,
      },
      dailyRecipientMetadata: {
        sequence: 'review-api-weekly-checkin',
        reviewWeekKey,
      },
    });

    if (!sendResult.success) {
      console.error("Brevo API Error:", sendResult.error);
      return res.status(502).json({ 
        success: false,
        error: `Failed to send email: ${sendResult.error || 'Unknown error'}`
      });
    }

    console.log("📧 Weekly check-in email sent successfully:", sendResult.messageId);

    return res.status(200).json({
      success: true,
      messageId: sendResult.messageId
    });

  } catch (error) {
    console.error("Error sending weekly check-in email:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
}

