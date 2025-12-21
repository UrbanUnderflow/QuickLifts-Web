import { Handler, HandlerEvent, HandlerContext, schedule } from "@netlify/functions";

/**
 * Netlify Scheduled Function: Send Weekly Review Check-in Email
 * 
 * Runs every Friday at 9am EST (14:00 UTC)
 * Sends an email asking the founder how the week went
 */

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = "hello@fitwithpulse.ai";
const SENDER_NAME = "Pulse Review Bot";
const FOUNDER_EMAIL = "tre@fitwithpulse.ai";
const FOUNDER_NAME = "Tremaine";

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
  const addUpdateUrl = `https://fitwithpulse.ai/admin/reviewTracker?action=add&week=${weekNumber}&month=${monthName}&year=${year}`;
  
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
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 24px;
            margin: 24px 0;
            border-radius: 12px;
            text-align: center;
          }
          .prompt-box h3 {
            margin: 0 0 12px 0;
            color: #d7ff00;
            font-size: 16px;
            font-weight: 600;
          }
          .prompt-box p {
            margin: 0 0 20px 0;
            color: #a1a1a1;
            font-size: 14px;
          }
          .add-button {
            display: inline-block;
            background-color: #d7ff00;
            color: #000000;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
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
              <h3>📝 Add Your Weekly Update</h3>
              <p>Share wins, challenges, progress, metrics - anything notable from this week.</p>
              <a href="${addUpdateUrl}" class="add-button">Add Week ${weekNumber} Update</a>
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
              <p>Your updates will be used to generate your monthly investor review automatically.</p>
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

const sendWeeklyCheckin: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("📧 Weekly review check-in triggered");
  
  if (!BREVO_API_KEY) {
    console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Email service not configured' })
    };
  }

  try {
    const weekNumber = getWeekNumber();
    const monthName = getCurrentMonthName();
    const year = new Date().getFullYear();
    
    const subject = `📊 Week ${weekNumber} Check-in: How did ${monthName} Week ${weekNumber} go?`;
    const htmlContent = getWeeklyCheckinEmailContent(weekNumber, monthName);

    console.log(`📧 Sending weekly check-in email for Week ${weekNumber} of ${monthName} ${year}`);

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
        'X-Review-Week': `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-W${weekNumber}`,
        'X-Email-Type': 'weekly-review-checkin'
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
    console.log("📧 Weekly check-in email sent successfully:", responseData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        messageId: responseData.messageId,
        week: weekNumber,
        month: monthName
      })
    };

  } catch (error) {
    console.error("Error sending weekly check-in email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error'
      })
    };
  }
};

// Schedule: Every Friday at 9am EST (14:00 UTC)
// Cron: minute hour day-of-month month day-of-week
// 0 14 * * 5 = At 14:00 (2pm UTC / 9am EST) on Friday
export const handler = schedule("0 14 * * 5", sendWeeklyCheckin);

