import { Handler, HandlerEvent, HandlerContext, schedule } from "@netlify/functions";
import * as admin from 'firebase-admin';

/**
 * Netlify Scheduled Function: Send Draft Review Reminder Email
 * 
 * Runs on Saturday at 9am EST (14:00 UTC)
 * Only sends if it's the Saturday before the first Monday of a new month
 * 
 * This gives the founder 2 days to review the draft before the first Monday
 */

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = "hello@fitwithpulse.ai";
const SENDER_NAME = "Pulse Review Bot";
const FOUNDER_EMAIL = "tre@fitwithpulse.ai";
const FOUNDER_NAME = "Tremaine";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://fitwithpulse.ai';

// Initialize Firebase Admin
let db: admin.firestore.Firestore;

function initializeFirebase() {
  if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString());
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  
  db = admin.firestore();
}

function getMonthName(month: number): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[month - 1];
}

function isLastSaturdayBeforeFirstMonday(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Must be Saturday
  if (dayOfWeek !== 6) {
    return false;
  }
  
  // Check if Monday (2 days from now) is in a new month or is the 1st-7th
  const monday = new Date(now);
  monday.setDate(monday.getDate() + 2);
  
  // If Monday is in a different month than today, or Monday is the 1st
  // This means we're the Saturday before the first Monday
  const isNewMonth = monday.getMonth() !== now.getMonth();
  const mondayIsFirst = monday.getDate() === 1;
  const mondayIsFirstWeek = monday.getDate() <= 7 && monday.getDay() === 1;
  
  return isNewMonth || mondayIsFirst || mondayIsFirstWeek;
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

const sendDraftReminder: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("📧 Draft review reminder triggered");
  
  // Check if this is the right time to send (Saturday before first Monday)
  if (!isLastSaturdayBeforeFirstMonday()) {
    console.log("⏭️ Not the Saturday before first Monday, skipping...");
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'Not the Saturday before first Monday of the month'
      })
    };
  }
  
  if (!BREVO_API_KEY) {
    console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Email service not configured' })
    };
  }

  try {
    initializeFirebase();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    const monthName = getMonthName(month);

    console.log(`📧 Processing draft review for ${monthName} ${year}`);

    // Check if we have weekly contexts for this month
    const contextsSnapshot = await db.collection('reviewWeeklyContext')
      .where('year', '==', year)
      .where('month', '==', month)
      .get();

    const weeklyUpdatesCount = contextsSnapshot.size;

    if (weeklyUpdatesCount === 0) {
      console.log('⚠️ No weekly updates found for this month, skipping draft generation');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'No weekly updates to generate draft from' 
        })
      };
    }

    // Check if draft already exists
    const existingDraftSnapshot = await db.collection('reviewDrafts')
      .where('monthYear', '==', monthYear)
      .limit(1)
      .get();

    let draftId: string;

    if (!existingDraftSnapshot.empty) {
      draftId = existingDraftSnapshot.docs[0].id;
      console.log(`📝 Using existing draft: ${draftId}`);
    } else {
      // Create a placeholder draft
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          success: false,
          error: `Failed to send email: ${errorBody.message || 'Unknown error'}`
        })
      };
    }

    const responseData = await response.json();
    console.log("📧 Draft reminder email sent successfully:", responseData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        messageId: responseData.messageId,
        draftId,
        month: monthName,
        weeklyUpdatesCount
      })
    };

  } catch (error) {
    console.error("Error sending draft reminder email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error'
      })
    };
  }
};

// Schedule: Every Saturday at 9am EST (14:00 UTC)
// The function internally checks if it's the right Saturday to send
export const handler = schedule("0 14 * * 6", sendDraftReminder);

