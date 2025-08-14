# Smart Prize Distribution Retry System

This document explains the smart retry system for failed prize distributions.

## Problem Solved

Previously, prize distributions would fail due to insufficient funds in the platform Stripe account, and manual intervention was required to resend confirmation emails once funds became available.

## Solution

The smart retry system automatically:
1. **Checks Stripe balance daily**
2. **Identifies failed prize distributions** 
3. **Sends retry emails to hosts** when sufficient funds are available
4. **Tracks retry attempts** and results

## Components

### 1. Smart Retry Function
**File**: `netlify/functions/smart-retry-prize-distribution.js`
- Runs daily via GitHub Actions
- Checks current Stripe balance
- Finds failed prize assignments (`distributionStatus: 'failed'` or `'partially_distributed'`)
- Calculates required amounts for each prize
- Sends retry emails when funds are sufficient

### 2. Enhanced Email Function  
**File**: `netlify/functions/send-host-validation-email.js`
- Updated to handle retry attempts (`isRetryAttempt` flag)
- Different subject line for retries: `🔄 RETRY: Prize Distribution Ready`
- Clear retry notification in email content
- Explains that funds are now available

### 3. Daily Automation
**File**: `netlify/functions/scheduled-smart-retry.js`
- Netlify scheduled function using `@netlify/functions`
- Runs daily at 2 PM UTC (9 AM EST / 6 AM PST)
- Automatically calls the smart retry function
- Built-in Netlify infrastructure - no external dependencies

## How It Works

### Daily Process:
1. **Netlify scheduled function** triggers at 2 PM UTC daily
2. **Calls internal** `smart-retry-prize-distribution` function
3. **Function checks** current Stripe balance
4. **Scans for failed** prize distributions
5. **Calculates costs** for each failed prize
6. **If sufficient funds exist**:
   - Sends retry email to host(s)
   - Updates prize assignment status to `'retry_email_sent'`
   - Increments retry count
7. **Logs results** to Firestore `systemLogs` collection

### Email Content Changes for Retries:
- **Subject**: `🔄 RETRY: Prize Distribution Ready - [Challenge Name]`
- **Header**: "Prize Distribution - RETRY" 
- **Blue notification box**: Explains this is a follow-up to previous request
- **Updated messaging**: "Sufficient funds are now available"

## Database Updates

### Prize Assignment Fields:
- `lastRetryEmailSent`: Timestamp of last retry email
- `retryEmailCount`: Number of retry emails sent
- `distributionStatus`: Updated to `'retry_email_sent'` after retry

### System Logs:
- Type: `'smart_retry_prize_distribution'`
- Includes balance checked, retry results, and summary

## Configuration

### Timing:
- **Default**: Daily at 2 PM UTC
- **Customizable**: Edit the cron schedule in `netlify/functions/scheduled-smart-retry.js`

### Manual Trigger:
- Call the function directly: `https://fitwithpulse.ai/.netlify/functions/smart-retry-prize-distribution`
- Or via Netlify dashboard functions tab
- Scheduled function runs automatically - no manual setup needed

## Monitoring

### Success Indicators:
- Function returns `"success": true`
- Retry emails sent successfully 
- Prize assignments updated with retry status

### Failure Indicators:
- Function returns `"success": false`
- Errors logged to `errorLogs` collection
- Netlify scheduled function fails

### Logs Location:
- **System logs**: Firestore `systemLogs` collection
- **Error logs**: Firestore `errorLogs` collection  
- **Netlify logs**: Netlify Functions dashboard

## Advantages Over Old System

### Old Auto-Retry Issues:
❌ Blindly retried failed payouts daily  
❌ Didn't check actual fund availability  
❌ No host notification about retries  
❌ Failed silently with insufficient funds  

### New Smart System Benefits:
✅ Checks real Stripe balance first  
✅ Only acts when sufficient funds exist  
✅ Sends clear retry emails to hosts  
✅ Tracks retry attempts and results  
✅ Host can review updated winner info  
✅ Clear communication about retry reason  

## Testing

### Manual Test:
```bash
curl -X GET "https://fitwithpulse.ai/.netlify/functions/smart-retry-prize-distribution"
```

### Expected Response:
```json
{
  "success": true,
  "message": "Smart retry completed",
  "balanceChecked": {
    "availableUSD": 1004.97
  },
  "retryResults": [...],
  "summary": {
    "prizesProcessed": 1,
    "totalSuccesses": 1,
    "totalFailures": 0
  }
}
```

## Error Handling

### Insufficient Funds:
- Function completes successfully but skips retry
- Message: "No available funds for retry"

### Email Sending Failures:
- Individual email failures are logged
- Overall function continues with other prizes
- Failed attempts tracked in retry results

### System Errors:
- Logged to `errorLogs` collection
- GitHub Actions job fails with error details
- Manual investigation required

## Future Enhancements

1. **Smart timing**: Check when deposits are expected to clear
2. **Batch optimization**: Group related prizes in single emails
3. **Escalation**: Notify admin after multiple retry failures
4. **Dashboard**: Admin view of retry status and history
