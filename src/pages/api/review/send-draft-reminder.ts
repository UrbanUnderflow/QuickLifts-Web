import type { NextApiRequest, NextApiResponse } from 'next';
import { initAdmin } from '../../../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * API endpoint to send draft review reminder email
 * 
 * This should be triggered 2 days before the first Monday of each month
 * (typically on Saturday before the first Monday)
 * 
 * It generates a draft review and sends an email with a link to review it
 */

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Review Bot";
const FOUNDER_EMAIL = "tre@fitwithpulse.ai";
const FOUNDER_NAME = "Tremaine";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://fitwithpulse.ai';

interface SendDraftReminderResponse {
  success: boolean;
  messageId?: string;
  draftId?: string;
  error?: string;
}

function getMonthName(month: number): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[month - 1];
}

function getDraftReminderEmailContent(
  monthName: string, 
  year: number, 
  draftUrl: string,
  weeklyUpdatesCount: number
): string {
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
          .stats-box {
            background-color: #ecfdf5;
            border-left: 4px solid #10b981;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 0 8px 8px 0;
          }
          .stats-box p {
            margin: 0;
            color: #065f46;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
          }
          .cta-container {
            text-align: center;
            margin: 32px 0;
          }
          .checklist {
            background-color: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .checklist h4 {
            margin: 0 0 12px 0;
            color: #475569;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .checklist ul {
            margin: 0;
            padding-left: 0;
            list-style: none;
          }
          .checklist li {
            margin-bottom: 8px;
            padding-left: 24px;
            position: relative;
            color: #64748b;
          }
          .checklist li:before {
            content: "☐";
            position: absolute;
            left: 0;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center; 
            font-size: 12px; 
            color: #94a3b8; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Your ${monthName} Review is Ready</h1>
            <p>Review draft generated • Publish on Monday</p>
          </div>
          
          <div class="content">
            <p>Hey ${FOUNDER_NAME},</p>
            
            <p>Your <strong>${monthName} ${year}</strong> investor update draft is ready for review!</p>
            
            <div class="stats-box">
              <p>📊 Generated from <strong>${weeklyUpdatesCount} weekly update${weeklyUpdatesCount !== 1 ? 's' : ''}</strong> you provided this month.</p>
            </div>
            
            <div class="cta-container">
              <a href="${draftUrl}" class="cta-button">Review Your Draft →</a>
            </div>
            
            <div class="checklist">
              <h4>Before Publishing:</h4>
              <ul>
                <li>Check that metrics are accurate</li>
                <li>Review the AI-generated copy for accuracy</li>
                <li>Add any missing context or highlights</li>
                <li>Update "Looking Ahead" priorities if needed</li>
              </ul>
            </div>
            
            <p>Once you're happy with it, just click <strong>Publish</strong> to make it live.</p>
            
            <p>Best,<br>Your Review Bot 🤖</p>
          </div>
          
          <div class="footer">
            <p>Pulse Review Automation • ${monthName} ${year}</p>
            <p><a href="${BASE_URL}/admin/reviewTracker" style="color: #64748b;">Manage in Review Tracker</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendDraftReminderResponse>
) {
  // Allow both GET (for cron) and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Verify cron secret for automated calls
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  
  if (process.env.NODE_ENV === 'production' && cronSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!BREVO_API_KEY) {
    console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
    return res.status(500).json({ success: false, error: 'Email service configuration error' });
  }

  try {
    // Initialize Firebase Admin
    initAdmin();
    const db = getFirestore();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    const monthName = getMonthName(month);

    console.log(`📧 Generating draft review for ${monthName} ${year}`);

    // Check if we have weekly contexts for this month
    const contextsSnapshot = await db.collection('reviewWeeklyContext')
      .where('year', '==', year)
      .where('month', '==', month)
      .get();

    const weeklyUpdatesCount = contextsSnapshot.size;

    if (weeklyUpdatesCount === 0) {
      console.log('⚠️ No weekly updates found for this month, skipping draft generation');
      return res.status(200).json({ 
        success: true, 
        error: 'No weekly updates to generate draft from' 
      });
    }

    // Check if draft already exists
    const existingDraftSnapshot = await db.collection('reviewDrafts')
      .where('monthYear', '==', monthYear)
      .limit(1)
      .get();

    let draftId: string;

    if (!existingDraftSnapshot.empty) {
      // Use existing draft
      draftId = existingDraftSnapshot.docs[0].id;
      console.log(`📝 Using existing draft: ${draftId}`);
    } else {
      // We need to trigger draft generation
      // For now, we'll create a placeholder and let the user generate via the UI
      // In a full implementation, we'd call the AI generation here
      const draftRef = db.collection('reviewDrafts').doc();
      draftId = draftRef.id;
      
      await draftRef.set({
        id: draftId,
        monthYear,
        reviewType: 'month',
        title: `${monthName} ${year}: [Draft Pending]`,
        subtitle: monthName.toUpperCase() + ' ' + year,
        description: 'Draft pending generation. Click to generate.',
        featuredHighlights: [],
        metrics: [],
        businessHighlights: [],
        productHighlights: [],
        lookingAhead: [],
        status: 'draft',
        weeklyContextIds: contextsSnapshot.docs.map(d => d.id),
        createdAt: new Date(),
        updatedAt: new Date(),
        generatedAt: new Date(),
      });
      
      console.log(`📝 Created placeholder draft: ${draftId}`);
    }

    const draftUrl = `${BASE_URL}/review/draft/${draftId}`;
    const subject = `📝 Your ${monthName} Review Draft is Ready`;
    const htmlContent = getDraftReminderEmailContent(monthName, year, draftUrl, weeklyUpdatesCount);

    console.log(`📧 Sending draft reminder email for ${monthName} ${year}`);

    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: FOUNDER_EMAIL,
          name: FOUNDER_NAME,
        },
      ],
      subject,
      htmlContent,
      replyTo: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      headers: {
        'X-Review-Month': monthYear,
        'X-Email-Type': 'draft-review-reminder'
      }
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Brevo API Error:", response.status, errorBody);
      return res.status(response.status).json({ 
        success: false,
        error: `Failed to send email: ${errorBody.message || 'Unknown error'}`
      });
    }

    const responseData = await response.json();
    console.log("📧 Draft reminder email sent successfully:", responseData);

    return res.status(200).json({
      success: true,
      messageId: responseData.messageId,
      draftId
    });

  } catch (error) {
    console.error("Error sending draft reminder email:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
}

