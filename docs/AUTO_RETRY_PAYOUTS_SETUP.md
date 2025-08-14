# Auto-Retry Payouts System

## Overview

This system automatically retries failed prize payouts when the platform has insufficient funds. When prize money is deposited, it goes to "pending" status in Stripe and typically clears within 2-7 business days. During this time, payout attempts will fail with "insufficient funds" errors.

## How It Works

1. **When a payout fails due to insufficient funds:**
   - The prize record status is set to `pending_funds` instead of `failed`
   - An `autoRetryEligible: true` flag is added
   - A helpful error message explains the situation

2. **Daily auto-retry process:**
   - Checks current Stripe balance
   - Finds all prize records with `status: 'pending_funds'` 
   - Retries payouts if sufficient funds are available
   - Updates prize assignment status to `distributed` when all payouts succeed

## Files Created/Modified

### New Functions
- `auto-retry-pending-payouts.js` - Main retry logic
- `test-auto-retry.js` - Manual testing function

### Modified Functions
- `payout-prize-money.js` - Enhanced to mark insufficient funds as `pending_funds`

## Testing

### Manual Test
```bash
curl -X GET "https://fitwithpulse.ai/.netlify/functions/test-auto-retry"
```

### Check Current Status
```bash
# Check failed/pending records
curl -X GET "https://fitwithpulse.ai/.netlify/functions/auto-retry-pending-payouts"
```

## Setting Up Automated Daily Retry

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/daily-payout-retry.yml`:

```yaml
name: Daily Payout Retry
on:
  schedule:
    # Run at 2 PM UTC daily (adjust for your timezone)
    - cron: '0 14 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  retry-payouts:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto-Retry
        run: |
          curl -X GET "https://fitwithpulse.ai/.netlify/functions/auto-retry-pending-payouts"
```

### Option 2: External Cron Service

Set up a daily cron job to hit:
```
GET https://fitwithpulse.ai/.netlify/functions/auto-retry-pending-payouts
```

Popular services:
- **UptimeRobot** (free monitoring with cron)
- **Cronitor** 
- **EasyCron**

### Option 3: Netlify Scheduled Functions (Future)

When Netlify adds scheduled function support, we can convert the function to run automatically.

## Monitoring

### Firestore Collections

- **`systemLogs`**: Auto-retry execution logs
- **`errorLogs`**: Any errors during retry process
- **`prizeRecords`**: Updated with `pending_funds` status and retry flags

### Example System Log
```json
{
  "type": "auto_retry_payouts",
  "timestamp": "2025-01-13T...",
  "balanceChecked": {
    "availableUSD": 1004.17,
    "pendingUSD": 0
  },
  "retryResults": [
    {
      "prizeId": "qsHM4Y2jDkl2udlJdFhp",
      "challengeTitle": "Morning Mobility Challenge",
      "successCount": 3,
      "failCount": 0
    }
  ]
}
```

## Current Situation

Based on your Stripe dashboard:
- **Available**: $0.80
- **Incoming**: $1,004.17 (pending)
- **Expected clear date**: August 13, 2025

The auto-retry will automatically payout the prizes once the $1,004.17 clears to available balance.

## Security Note

The auto-retry function only processes records already marked as `pending_funds` by legitimate payout attempts. It cannot create new payouts or bypass existing validation logic.
