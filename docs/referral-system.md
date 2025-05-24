# Referral System - Server-Side Implementation

## Overview

The referral bonus system has been moved entirely to Firebase Functions to ensure reliability, security, and eliminate client-side duplication issues.

## How It Works

### 1. Client-Side (iOS App)
- Users share challenge links with `sharedBy` parameter containing their user ID
- When someone joins via the link, their `UserChallenge` is created with a `referralChain.sharedBy` value
- **No client-side referral bonus logic** - everything is handled server-side

### 2. Server-Side (Firebase Functions)
- `handleReferralBonus` function triggers automatically when a new `UserChallenge` document is created
- Function checks if the new user was referred by someone (`referralChain.sharedBy`)
- If referrer is found and is a participant in the same challenge, awards 25 points
- Sends push notification to referrer about earning points

## Date Handling Requirements

**⚠️ Important**: All date operations in the referral system follow the project's standardized date formatting:

- **When saving to Firestore**: Use `dateToUnixTimestamp(new Date())` instead of `FieldValue.serverTimestamp()`
- **When reading from Firestore**: Use `convertFirestoreTimestamp()` for any date fields
- **updatedAt field**: Always update this field when modifying UserChallenge documents as it serves as the "lastActive" indicator for inactivity tracking

### Date Utility Functions
Both Firebase Functions and Netlify Functions include these utilities:

```javascript
const dateToUnixTimestamp = (date) => {
  return Math.floor(date.getTime() / 1000);
};

const convertFirestoreTimestamp = (timestamp) => {
  if (timestamp == null) return new Date();
  if (timestamp instanceof Date) return timestamp;
  
  const numTimestamp = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  
  if (numTimestamp < 10000000000) {
    return new Date(numTimestamp * 1000);
  }
  
  return new Date(numTimestamp);
};
```

## Firebase Function Details

### Main Function: `handleReferralBonus`
- **Trigger**: `userChallenges/{docId}` onCreate
- **Logic**:
  1. Extract referral info from new UserChallenge
  2. Find referrer's UserChallenge in same challenge
  3. Award 25 points to referrer's `pulsePoints.referralBonus`
  4. Send push notification to referrer
  5. Log all actions for debugging

### Admin Function: `processRetroactiveReferralBonuses`
- **Trigger**: Manual HTTPS call (admin only)
- **Purpose**: Process existing UserChallenges that may have missed referral bonuses
- **Usage**: Can be called from Firebase Console or admin dashboard

## Key Benefits

### ✅ Reliability
- Server-side execution ensures bonuses are always processed
- No dependency on client app state or network conditions
- Automatic retries if function fails

### ✅ Security
- Points can only be awarded by trusted server code
- No possibility of client-side manipulation
- Admin-only access to retroactive processing

### ✅ Consistency
- Single source of truth for referral logic
- No duplication between different client flows
- Consistent behavior across all platforms

### ✅ Debugging
- Comprehensive server-side logging
- Easy to monitor via Firebase Console
- Clear audit trail for all referral bonuses

## Requirements

### For Referrer to Earn Points:
1. Referrer must be a participant in the same challenge
2. Referred user must join using referrer's link
3. Referred user cannot be the same as referrer (no self-referrals)

### Technical Requirements:
- UserChallenge must have valid `referralChain.sharedBy` value
- Referrer must have valid FCM token for notifications (optional)
- Both users must be in the same `challengeId`

## Deployment

1. Deploy the Firebase Function:
   ```bash
   firebase deploy --only functions:handleReferralBonus,functions:processRetroactiveReferralBonuses
   ```

2. Verify function is active in Firebase Console

3. Test with a new challenge join to ensure function triggers

## Monitoring

### Firebase Console Logs
- Search for `[Referral Bonus]` to see all referral-related logs
- Monitor function execution times and errors
- Track successful bonus awards and notifications

### Key Log Messages
- `Processing new UserChallenge: {id}` - Function started
- `Found referrer {username} in challenge {id}` - Referrer located
- `Successfully awarded 25 points to {username}` - Bonus awarded
- `COMPLETED: Referrer {username} earned 25 points` - Success summary

## Troubleshooting

### Common Issues

1. **Referrer not found**
   - Log: `Referrer {id} not found in challenge {id}`
   - Cause: Referrer hasn't joined the challenge yet
   - Solution: Referrer must be a participant to earn points

2. **No referral chain**
   - Log: `No referral chain or sharedBy value found`
   - Cause: User didn't join via referral link
   - Solution: Ensure links include proper `sharedBy` parameter

3. **Notification failed**
   - Log: `Failed to send notification to {id}`
   - Cause: Invalid FCM token or notification service issue
   - Impact: Points still awarded, only notification fails

### Testing

1. Create a test challenge
2. Have User A join the challenge
3. Have User A share the challenge link
4. Have User B join via the shared link
5. Check Firebase logs for referral bonus processing
6. Verify User A received 25 points and notification

## Migration Notes

- All existing client-side referral logic has been removed
- Existing UserChallenges with referral chains can be processed retroactively
- No changes needed to link generation or sharing flows
- Push notification format remains the same

## Admin Tools

### Manual Referral Award Page
A new admin page has been created at `/admin/referralAward` for manually linking referrals in cases where the automatic system missed them:

- **Purpose**: Handle edge cases where referral chain wasn't properly set up
- **Features**: 
  - Search and select referrer, referee, and challenge
  - Updates referee's referral chain with correct information
  - Awards 25 points to referrer
  - Sends notification to referrer
- **Access**: Admin dashboard → "Referral Award"

### Netlify Function: `link-referral`
Backend function that handles manual referral linking:
- **Endpoint**: `/.netlify/functions/link-referral`
- **Method**: POST
- **Payload**: `{ referrerId, referrerUsername, refereeId, refereeUsername, challengeId, challengeTitle }`
- **Validation**: Ensures both users are participants in the challenge
- **Security**: Prevents duplicate referral chains and self-referrals 