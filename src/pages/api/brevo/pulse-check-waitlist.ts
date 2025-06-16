import type { NextApiRequest, NextApiResponse } from 'next';
import { handleBrevoSubscribe } from '../../../lib/brevoSubscribeHelper';
import { FirestoreWaitlistService } from '../../../lib/firestore-waitlist';
import * as Brevo from '@getbrevo/brevo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, name, userType = 'athlete' } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailFormat = /^\S+@\S+\.\S+$/;
  if (!emailFormat.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check if email already exists in Firestore
  try {
    const emailExists = await FirestoreWaitlistService.emailExists(email);
    if (emailExists) {
      return res.status(400).json({ 
        error: 'This email is already on the waitlist!' 
      });
    }
  } catch (firestoreCheckError) {
    console.warn('[Waitlist] Could not check email existence in Firestore:', firestoreCheckError);
    // Continue with the process even if Firestore check fails
  }

  let firestoreDocId: string | null = null;
  let brevoSuccess = false;
  let emailSuccess = false;
  let brevoError: string | undefined;
  let emailError: string | undefined;

  try {
    // 1. First, save to Firestore (primary backup)
    try {
      firestoreDocId = await FirestoreWaitlistService.addWaitlistEntry({
        email,
        name,
        userType,
        source: 'pulse-check-landing',
        utmCampaign: 'pulse-check-landing',
        brevoSyncStatus: 'pending',
        emailSentStatus: 'pending'
      });
      console.log('[Waitlist] Saved to Firestore successfully:', firestoreDocId);
    } catch (firestoreError) {
      console.error('[Waitlist] Firestore save failed:', firestoreError);
      // Continue with Brevo even if Firestore fails
    }

    // 2. Add to Brevo waitlist
    try {
      await handleBrevoSubscribe({
        email,
        listKey: 'pulse-check-waitlist',
        utmCampaign: 'pulse-check-landing',
        attributes: {
          FIRSTNAME: name || '',
          USER_TYPE: userType,
          WAITLIST_DATE: new Date().toISOString(),
          SOURCE: 'pulse-check-landing'
        },
      });
      brevoSuccess = true;
      console.log('[Waitlist] Brevo sync successful');

      // Update Firestore with success status
      if (firestoreDocId) {
        await FirestoreWaitlistService.updateBrevoSyncStatus(firestoreDocId, 'success');
      }
    } catch (error: any) {
      brevoError = error.message || 'Brevo sync failed';
      console.error('[Waitlist] Brevo sync failed:', brevoError);

      // Update Firestore with failure status
      if (firestoreDocId) {
        await FirestoreWaitlistService.updateBrevoSyncStatus(firestoreDocId, 'failed', brevoError);
      }
    }

    // 3. Send welcome email
    try {
      await sendWelcomeEmail(email, name);
      emailSuccess = true;
      console.log('[Waitlist] Welcome email sent successfully');

      // Update Firestore with email success status
      if (firestoreDocId) {
        await FirestoreWaitlistService.updateEmailSentStatus(firestoreDocId, 'success');
      }
    } catch (error: any) {
      emailError = error.message || 'Email send failed';
      console.error('[Waitlist] Welcome email failed:', emailError);

      // Update Firestore with email failure status
      if (firestoreDocId) {
        await FirestoreWaitlistService.updateEmailSentStatus(firestoreDocId, 'failed', emailError);
      }
    }

    // Determine response based on what succeeded
    if (firestoreDocId || brevoSuccess) {
      // Success if we saved to at least one system
      return res.status(200).json({ 
        success: true, 
        message: 'Successfully joined the waitlist!',
        details: {
          firestoreId: firestoreDocId,
          brevoSynced: brevoSuccess,
          emailSent: emailSuccess
        }
      });
    } else {
      // Both systems failed
      throw new Error('Failed to save to both Firestore and Brevo');
    }

  } catch (error: any) {
    console.error('[Waitlist] Complete failure:', error);
    return res.status(500).json({ 
      error: 'Failed to join waitlist. Please try again later.',
      details: {
        brevoError,
        emailError,
        firestoreId: firestoreDocId
      }
    });
  }
}

async function sendWelcomeEmail(email: string, name?: string) {
  if (!process.env.BREVO_MARKETING_KEY) {
    throw new Error('BREVO_MARKETING_KEY missing');
  }

  const client = new Brevo.TransactionalEmailsApi();
  client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY);

  const firstName = name || 'there';

  await client.sendTransacEmail({
    to: [{ email, name }],
    sender: { 
      email: 'hello@pulsecommunity.app', 
      name: 'Pulse Team' 
    },
    subject: 'Welcome to the Pulse Check Waitlist! 🚀',
    htmlContent: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #E0FE10; font-size: 28px; margin: 0;">Welcome to Pulse Check!</h1>
          <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Always-On Sport Psychology for Athletes & Coaches</p>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 20px 0;">
          <h2 style="color: #333; font-size: 20px; margin: 0 0 15px 0;">Hey ${firstName}! 👋</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 15px 0;">
            Thanks for joining the Pulse Check waitlist! You're now part of an exclusive group getting early access to the future of sport psychology.
          </p>
          
          <h3 style="color: #333; font-size: 18px; margin: 20px 0 10px 0;">What is Pulse Check?</h3>
          <ul style="color: #555; line-height: 1.6; padding-left: 20px;">
            <li><strong>Daily Check-in Bot:</strong> Smart mood tracking that understands athletic context</li>
            <li><strong>Bio-Sync Context:</strong> Your biometric data explains your mental state</li>
            <li><strong>AI Corner-Man Chat:</strong> Instant answers to training and performance questions</li>
            <li><strong>Escalation Loop:</strong> Seamless connection to your coach when needed</li>
          </ul>
          
          <h3 style="color: #333; font-size: 18px; margin: 20px 0 10px 0;">What's Next?</h3>
          <p style="color: #555; line-height: 1.6; margin: 0;">
            We're putting the finishing touches on Pulse Check and will email you as soon as it's ready. 
            In the meantime, you can check out our main Pulse app for community workouts and training.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729" 
             style="display: inline-block; background: #E0FE10; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Download Pulse App
          </a>
        </div>
        
        <div style="text-align: center; color: #888; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>Thanks for being part of the Pulse community!</p>
          <p>The Pulse Team</p>
        </div>
      </div>
    `,
    textContent: `
Hey ${firstName}!

Thanks for joining the Pulse Check waitlist! You're now part of an exclusive group getting early access to the future of sport psychology.

What is Pulse Check?
- Daily Check-in Bot: Smart mood tracking that understands athletic context
- Bio-Sync Context: Your biometric data explains your mental state  
- AI Corner-Man Chat: Instant answers to training and performance questions
- Escalation Loop: Seamless connection to your coach when needed

What's Next?
We're putting the finishing touches on Pulse Check and will email you as soon as it's ready. In the meantime, you can check out our main Pulse app for community workouts and training.

Download Pulse App: https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729

Thanks for being part of the Pulse community!
The Pulse Team
    `
  });
} 