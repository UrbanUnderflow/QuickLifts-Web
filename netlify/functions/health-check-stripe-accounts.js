// Health check function to monitor for missing Stripe account IDs
// This helps us catch and fix account linking issues before users notice

const { db } = require('./config/firebase');
const Stripe = require('stripe');

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    console.log('[HealthCheck] Starting Stripe account health check...');

    if (!db) {
      throw new Error('Firebase database not available');
    }

    if (!stripe) {
      throw new Error('Stripe not available');
    }

    // Get all users who have completed onboarding but might be missing stripeAccountId
    const usersSnapshot = await db.collection('users')
      .where('creator.onboardingStatus', '==', 'complete')
      .get();

    console.log(`[HealthCheck] Found ${usersSnapshot.size} users with completed onboarding`);

    const issues = [];
    const fixedAccounts = [];
    let healthyAccounts = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Check if they're missing stripeAccountId
      if (!userData.creator?.stripeAccountId) {
        console.warn(`[HealthCheck] User ${userId} has completed onboarding but missing stripeAccountId`);
        
        const issue = {
          userId,
          email: userData.email,
          username: userData.username,
          onboardingStatus: userData.creator?.onboardingStatus,
          onboardingCompletedAt: userData.creator?.onboardingCompletedAt,
          issue: 'missing_stripe_account_id',
          severity: 'critical'
        };

        // Attempt to find and fix the account automatically
        try {
          const accounts = await stripe.accounts.list({ limit: 100 });
          const userAccounts = accounts.data.filter(account => 
            account.email === userData.email || 
            (account.business_profile && account.business_profile.support_email === userData.email)
          );

          if (userAccounts.length > 0) {
            const stripeAccount = userAccounts[0];
            
            // Auto-fix the missing account ID
            await db.collection("users").doc(userId).update({
              'creator.stripeAccountId': stripeAccount.id,
              'creator.accountType': stripeAccount.type,
              'creator.healthCheckFixed': new Date(),
              'creator.lastLinked': new Date()
            });

            console.log(`[HealthCheck] AUTO-FIXED: Linked account ${stripeAccount.id} to user ${userId}`);
            
            fixedAccounts.push({
              ...issue,
              stripeAccountId: stripeAccount.id,
              status: 'auto_fixed',
              fixedAt: new Date()
            });
          } else {
            console.error(`[HealthCheck] Could not find Stripe account for user ${userId} (${userData.email})`);
            issues.push({
              ...issue,
              status: 'needs_manual_fix',
              reason: 'no_stripe_account_found'
            });
          }
        } catch (fixError) {
          console.error(`[HealthCheck] Failed to auto-fix user ${userId}:`, fixError);
          issues.push({
            ...issue,
            status: 'auto_fix_failed',
            error: fixError.message
          });
        }
      } else {
        // Account looks healthy
        healthyAccounts++;
      }
    }

    // Prepare health check report
    const report = {
      timestamp: new Date(),
      totalUsersChecked: usersSnapshot.size,
      healthyAccounts,
      issuesFound: issues.length,
      accountsAutoFixed: fixedAccounts.length,
      issues,
      fixedAccounts,
      summary: {
        healthy: healthyAccounts,
        critical_issues: issues.filter(i => i.severity === 'critical').length,
        auto_fixed: fixedAccounts.length,
        needs_manual_fix: issues.filter(i => i.status === 'needs_manual_fix').length
      }
    };

    console.log('[HealthCheck] Health check completed:', report.summary);

    // Log critical issues for monitoring/alerting
    if (issues.length > 0) {
      console.error(`[HealthCheck] ALERT: Found ${issues.length} critical account linking issues!`);
      issues.forEach(issue => {
        console.error(`[HealthCheck] CRITICAL: User ${issue.userId} (${issue.email}) - ${issue.issue}`);
      });
    }

    // Log successful fixes
    if (fixedAccounts.length > 0) {
      console.log(`[HealthCheck] SUCCESS: Auto-fixed ${fixedAccounts.length} account linking issues`);
      fixedAccounts.forEach(fix => {
        console.log(`[HealthCheck] FIXED: User ${fix.userId} linked to account ${fix.stripeAccountId}`);
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        healthCheck: report
      })
    };

  } catch (error) {
    console.error('[HealthCheck] Health check failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Health check failed'
      })
    };
  }
};

module.exports = { handler }; 