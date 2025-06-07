import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "The Pulse Team";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!BREVO_API_KEY) {
    console.error("Brevo API key (BREVO_MARKETING_KEY) is not set.");
    return { statusCode: 500, body: JSON.stringify({ message: "Email service configuration error." }) };
  }

  try {
    const { email, name } = JSON.parse(event.body || "{}");

    if (!email || !name) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing email or name in request body." }) };
    }

    const subject = `🎉 Congratulations, ${name}! You're Approved for Pulse Programming!`;

    const gettingStartedGuideSummary = `
      <h2 style="color: #2563eb; font-size: 20px;">Welcome to the Pulse Founding 100 Coaches Program!</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #000000;">We're thrilled to have you on board. Here's a quick guide to get you started and make the most of Pulse:</p>
      <ul style="font-size: 16px; line-height: 1.6; padding-left: 20px; color: #000000;">
        <li style="margin-bottom: 10px;"><strong>Download the Pulse App:</strong> If you haven't already, grab it from the <a href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729" style="color: #2563eb; text-decoration: underline;">App Store</a>.</li>
        <li style="margin-bottom: 10px;"><strong>Set Up Your Profile:</strong> Add a great photo and a bio that showcases your unique expertise.</li>
        <li style="margin-bottom: 10px;"><strong>Create Your First Content:</strong>
          <ul style="padding-left: 20px; margin-top: 5px; color: #000000;">
            <li>Start with a <strong>Move</strong> (a single exercise video).</li>
            <li>Combine Moves into a <strong>Stack</strong> (a complete workout).</li>
            <li>Organize Stacks into a <strong>Round</strong> (a full training program or challenge).</li>
          </ul>
        </li>
        <li style="margin-bottom: 10px;"><strong>Experience Pulse:</strong> Try out your own workouts or join a Round to see Pulse from your community's perspective.</li>
      </ul>
      <p style="font-size: 16px; line-height: 1.6; color: #000000;">For more details and a visual walkthrough, check out our full <a href="https://fitwithpulse.ai/starter-pack" style="color: #2563eb; text-decoration: underline; font-weight: bold;">Getting Started Guide</a>.</p>
    `;

    const inspirationalMessage = `
      <h2 style="color: #2563eb; font-size: 20px; margin-top: 30px;">You're a Founding Coach!</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #000000;">You are now part of an exclusive group of founding coaches who will play a pivotal role in shaping the future of fitness programming with Pulse. We're not just building an app; we're building a community and a new way for talented trainers like you to share your passion, grow your reach, and make a real impact.</p>
      <p style="font-size: 16px; line-height: 1.6; color: #000000;">Your insights, feedback, and the incredible content you'll create are invaluable to us. We're committed to providing you with the tools and support you need to succeed. This is just the beginning of an exciting journey, and we're so glad you're here to build it with us.</p>
      <p style="font-size: 16px; line-height: 1.6; color: #000000;">Welcome to the Pulse team!</p>
      <p style="font-size: 16px; line-height: 1.6; margin-top: 20px; color: #000000;">Warmly,<br/><strong>The Pulse Team</strong></p>
    `;

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #000000; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            a { color: #2563eb; text-decoration: underline; }
            p { margin-bottom: 15px; color: #000000; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666666; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #2563eb; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>PULSE</h1>
              <p style="color: #666666; font-size: 14px; margin: 5px 0 0 0;">PROGRAMMING</p>
            </div>
            <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 15px;">Hi ${name},</h1>
            <p style="font-size: 18px; line-height: 1.6; color: #000000;">Fantastic news! Your application for <strong>Pulse Programming Beta</strong> and the <strong>Founding 100 Coaches Program</strong> has been approved!</p>
            ${gettingStartedGuideSummary}
            ${inspirationalMessage}
             <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Pulse. All rights reserved.</p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: email,
          name: name,
        },
      ],
      subject: subject,
      htmlContent: htmlContent,
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
        body: JSON.stringify({ message: "Failed to send email via Brevo.", details: errorBody })
      };
    }
    
    const responseData = await response.json();
    console.log("Email sent successfully via Brevo:", responseData);

    return { statusCode: 200, body: JSON.stringify({ message: "Approval email sent successfully." }) };

  } catch (error) {
    console.error("Error in send-approval-email function:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        message: "Internal server error while sending email.", 
        details: error.message 
      })
    };
  }
};

export { handler }; 