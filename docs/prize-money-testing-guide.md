# Prize Money System - Complete Testing Guide

## Table of Contents
1. [Pre-Testing Setup](#pre-testing-setup)
2. [Testing Scenarios](#testing-scenarios)
3. [Manual Testing Steps](#manual-testing-steps)
4. [Notification Testing](#notification-testing)
5. [Prize Redemption Testing](#prize-redemption-testing)
6. [Error Scenarios](#error-scenarios)
7. [Production Readiness Checklist](#production-readiness-checklist)

---

## Pre-Testing Setup

### Required Configuration

#### 1. Challenge with Prize Money
Create a test challenge with the following configuration:

```json
{
  "title": "Test Prize Challenge",
  "prizeMoney": {
    "isEnabled": true,
    "totalAmount": 10000,  // $100.00 in cents
    "currency": "USD",
    "winnerCount": 3,
    "distributionType": "top_three_weighted",
    "customDistribution": []
  },
  "durationInDays": 7,
  "status": "active"
}
```

**Prize Distribution (top_three_weighted)**:
- 1st Place: $50.00 (50%)
- 2nd Place: $30.00 (30%) 
- 3rd Place: $20.00 (20%)

#### 2. Test Participants
Set up at least 5 test users with different scores:

```javascript
// Example participant scores
const participants = [
  { username: "winner1", pulsePoints: { totalPoints: 950 } },    // 1st - $50
  { username: "winner2", pulsePoints: { totalPoints: 847 } },    // 2nd - $30
  { username: "winner3", pulsePoints: { totalPoints: 723 } },    // 3rd - $20
  { username: "participant4", pulsePoints: { totalPoints: 645 } }, // No prize
  { username: "participant5", pulsePoints: { totalPoints: 521 } }  // No prize
];
```

#### 3. Environment Setup
- **Test Environment**: Use Stripe test keys
- **FCM Tokens**: Ensure test users have valid FCM tokens for notifications
- **Browser Tools**: Have browser dev tools open for network inspection
- **Logs**: Monitor Netlify function logs in real-time

---

## Testing Scenarios

### Scenario 1: Complete End-to-End Flow
**Goal**: Test the complete flow from challenge completion to prize redemption

**Steps**:
1. Complete challenge with test-complete-challenge function
2. Verify winner calculations and notifications
3. Test prize redemption flow for winners
4. Verify Stripe Connect onboarding
5. Test prize payout processing

### Scenario 2: Different Prize Distributions
**Goal**: Test various prize distribution types

**Configurations to Test**:
- Winner takes all ($100 to 1st place)
- Top 3 equal ($33.33 each to top 3)
- Top 3 weighted (50%, 30%, 20%)
- Custom distribution (60%, 25%, 15%)

### Scenario 3: Error Handling
**Goal**: Test system resilience with various error conditions

**Error Cases**:
- Challenge with no participants
- Challenge with insufficient prize money configuration
- Winner without valid Stripe account
- Network failures during prize processing

---

## Manual Testing Steps

### Step 1: Challenge Completion

#### Using the Test Function
```bash
# Complete a challenge manually
curl -X POST https://your-netlify-site.netlify.app/.netlify/functions/test-complete-challenge \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "your_challenge_id",
    "testMode": true
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "challengeId": "your_challenge_id",
  "testMode": true,
  "participantsUpdated": 5,
  "hasPrizeMoney": true,
  "prizePool": 100.00,
  "participants": [
    { "username": "winner1", "score": 950 },
    { "username": "winner2", "score": 847 },
    { "username": "winner3", "score": 723 }
  ],
  "winners": [
    { "userId": "user1", "placement": 1, "prizeAmount": 5000 },
    { "userId": "user2", "placement": 2, "prizeAmount": 3000 },
    { "userId": "user3", "placement": 3, "prizeAmount": 2000 }
  ],
  "message": "Challenge completed successfully! Prize money will be distributed to 3 winners."
}
```

#### Manual Database Update (Alternative)
If you prefer to update the database directly:

1. **Update Challenge Status**:
   ```javascript
   // In Firestore console
   db.collection('challenges').doc('challenge_id').update({
     status: 'completed',
     endDate: new Date(),
     updatedAt: new Date()
   });
   ```

2. **Update Participant Statuses**:
   ```javascript
   // Update each user-challenge document
   db.collection('user-challenge')
     .where('challengeId', '==', 'challenge_id')
     .get()
     .then(snapshot => {
       snapshot.docs.forEach(doc => {
         doc.ref.update({
           status: 'completed',
           completedAt: new Date()
         });
       });
     });
   ```

### Step 2: Verify Winner Calculations

#### Check Prize Records
Navigate to Firestore console and verify `prizeRecords` collection:

```javascript
// Expected prize records
{
  "id": "challenge_id_user1_timestamp",
  "challengeId": "challenge_id",
  "userId": "user1",
  "placement": 1,
  "prizeAmount": 5000,  // $50.00
  "status": "pending",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Check User Winner Fields
Verify `users` collection has updated `winner` fields:

```javascript
// Expected user document update
{
  "winner": {
    "challengeWins": [
      {
        "challengeId": "challenge_id",
        "placement": 1,
        "prizeAmount": 5000,
        "status": "pending",
        "awardedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "totalEarnings": 5000
  }
}
```

### Step 3: Test Notifications

#### Web Notifications (Firebase Console)
1. Open Firebase Console → Cloud Messaging
2. Send test notification with prize data:

```json
{
  "notification": {
    "title": "🏆💰 You Won Prize Money!",
    "body": "Congratulations! You won Test Challenge and earned $50.00! Tap to claim your prize!"
  },
  "data": {
    "type": "challenge_won_with_prize",
    "challengeId": "challenge_id",
    "prizeAmount": "50.00",
    "prizeEnabled": "true",
    "redirectTo": "prize_redemption"
  }
}
```

#### iOS Notifications
Test on physical device or simulator:
1. Ensure FCM token is properly set
2. Complete challenge to trigger automatic notification
3. Verify notification appears with prize money message
4. Test tapping notification navigates to challenge detail view

#### Notification Content Verification
For **winners**:
- Title: "🏆💰 You Won Prize Money!"
- Body includes prize amount and call-to-action
- Data includes `type: "challenge_won_with_prize"`

For **non-winners**:
- Title: "🏆 Challenge Complete!"
- Body shows winner's name and prize amount
- No redeem action available

### Step 4: Test Challenge Results Page

#### Access Wrapup Page
Navigate to: `https://your-app.com/round/[challenge_id]/wrapup`

#### Winner Experience
**Expected Elements**:
1. **Prize Section** (prominent yellow box):
   - 🏆💰 emojis
   - "Congratulations!" heading
   - Placement text (1st, 2nd, 3rd place)
   - Prize amount display ($50.00)
   - **"💰 Redeem Your Prize" button**
   - Instructions text

2. **Button Functionality**:
   - Clicking redirects to: `/winner/connect-account?challengeId=X&placement=1`
   - URL parameters are correctly passed

#### Non-Winner Experience
**Expected Elements**:
1. **Prize Info Section** (gray box):
   - 🏆 emoji
   - "Prize Challenge Results" heading
   - Total prize pool display ($100.00)
   - List of winners and their prize amounts
   - No redeem button

### Step 5: Test Prize Redemption Flow

#### Winner Onboarding Page
URL: `/winner/connect-account?challengeId=X&placement=1`

**Expected Elements**:
1. **Congratulations Section**:
   - Challenge title display
   - Placement confirmation
   - Prize amount display

2. **Stripe Account Setup**:
   - "Set Up Payment Account" button
   - Clear instructions
   - Error handling for missing parameters

#### Test Account Creation
```bash
# Test winner account creation
curl -X POST https://your-netlify-site.netlify.app/.netlify/functions/create-winner-connected-account \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_winner_user_id",
    "challengeId": "challenge_id",
    "placement": 1
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "accountId": "acct_test_winner_123",
  "onboardingUrl": "https://connect.stripe.com/setup/c/...",
  "accountType": "winner"
}
```

#### Test Stripe Onboarding
1. **Click onboarding link**
2. **Complete Stripe form** with test data:
   - Legal Name: Test Winner
   - DOB: 01/01/1990
   - SSN: 000-00-0000 (test SSN)
   - Phone: (555) 123-4567
   - Address: Valid US address
   - Bank: Routing: 110000000, Account: 000123456789

3. **Verify completion**:
   - Redirected back to app
   - Account status updated to 'complete'
   - User can see Stripe dashboard link

### Step 6: Test Prize Payout

#### Process Payout
```bash
# Test prize payout
curl -X POST https://your-netlify-site.netlify.app/.netlify/functions/payout-prize-money \
  -H "Content-Type: application/json" \
  -d '{
    "prizeRecordId": "challenge_id_user1_timestamp",
    "challengeId": "challenge_id"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "prizeRecordId": "challenge_id_user1_timestamp",
  "transferId": "tr_test_transfer_123",
  "originalAmount": 5000,
  "platformFee": 150,  // 3% of 5000
  "winnerAmount": 4850,
  "status": "paid"
}
```

#### Verify Database Updates
1. **Prize Record**:
   ```javascript
   {
     "status": "paid",
     "stripeTransferId": "tr_test_transfer_123",
     "paidAt": "2024-01-15T14:30:00Z"
   }
   ```

2. **User Winner Field**:
   ```javascript
   {
     "winner": {
       "challengeWins": [
         {
           "status": "paid",
           "paidAt": "2024-01-15T14:30:00Z"
         }
       ]
     }
   }
   ```

---

## Notification Testing

### Test Matrix

| User Type | Notification Type | Expected Title | Expected Body | Expected Data |
|-----------|-------------------|----------------|---------------|---------------|
| Winner (Prize) | `challenge_won_with_prize` | "🏆💰 You Won Prize Money!" | "...earned $50.00! Tap to claim..." | `prizeAmount: "50.00"` |
| Winner (No Prize) | `challenge_completed` | "🏆 Congratulations, Champion!" | "...with a score of 950!..." | `isWinner: "true"` |
| Non-Winner (Prize) | `challenge_completed` | "🏆 Challenge Complete!" | "...won the $100.00 prize..." | `prizeEnabled: "true"` |
| Non-Winner (No Prize) | `challenge_completed` | "🏆 Challenge Complete!" | "...Thanks for participating!..." | `noWinner: "false"` |

### iOS Notification Testing

#### Notification Handling Verification
1. **Receive Notification**: App shows banner with correct title/body
2. **Tap Notification**: 
   - For prize winners: Shows toast with prize congratulations
   - Navigates to challenge detail view
   - Challenge detail shows prize section with redeem button

#### Test Scenarios
```swift
// Test notification data
let testNotificationData = [
    "type": "challenge_won_with_prize",
    "challengeId": "test_challenge_123",
    "prizeAmount": "50.00",
    "prizeEnabled": "true",
    "redirectTo": "prize_redemption"
]
```

### Web Notification Testing

#### Browser Notification Permission
1. **Grant Permission**: User allows browser notifications
2. **Receive Notification**: Browser shows notification with correct content
3. **Click Notification**: Redirects to challenge wrapup page

---

## Error Scenarios

### 1. Challenge Not Found
**Test**: Use invalid challenge ID
```bash
curl -X POST /.netlify/functions/test-complete-challenge \
  -d '{"challengeId": "invalid_id"}'
```
**Expected**: 404 error with "Challenge not found"

### 2. No Participants
**Test**: Complete challenge with no participants
**Expected**: 400 error with "No participants found"

### 3. Prize Configuration Missing
**Test**: Challenge with `prizeMoney.isEnabled = false`
**Expected**: Normal completion without prize distribution

### 4. Insufficient Prize Balance
**Test**: Platform account with insufficient balance
**Expected**: Payout fails with insufficient funds error

### 5. Invalid Stripe Account
**Test**: Winner without completed Stripe onboarding
**Expected**: Payout fails, prize record marked as 'failed'

### 6. Network Failures
**Test**: Simulate network issues during prize processing
**Expected**: Proper error logging and graceful failure handling

---

## Production Readiness Checklist

### Pre-Launch Verification

#### ✅ Configuration
- [ ] Production Stripe keys configured
- [ ] Environment variables properly set
- [ ] Firebase Functions deployed
- [ ] Netlify functions deployed
- [ ] iOS app updated with notification handling

#### ✅ Data Models
- [ ] Challenge model includes `prizeMoney` field
- [ ] User model includes `winner` field
- [ ] Prize records collection created
- [ ] Firestore security rules updated

#### ✅ Notifications
- [ ] FCM configuration verified
- [ ] Notification content tested
- [ ] iOS notification handling verified
- [ ] Web notification permissions working

#### ✅ UI/UX
- [ ] Challenge wrapup page shows prize section
- [ ] Winner onboarding page functional
- [ ] Redeem button working correctly
- [ ] Error states handled gracefully

#### ✅ Payment Processing
- [ ] Stripe Connect accounts created successfully
- [ ] Onboarding flow completed
- [ ] Prize payouts processed correctly
- [ ] Platform fees calculated accurately (3%)
- [ ] Error handling for failed transfers

#### ✅ Testing Complete
- [ ] End-to-end flow tested
- [ ] Multiple prize distribution types tested
- [ ] Error scenarios tested
- [ ] Performance testing completed
- [ ] Security review completed

### Monitoring & Alerts

#### Key Metrics to Monitor
- **Prize calculation success rate** (target: 100%)
- **Notification delivery rate** (target: >95%)
- **Stripe onboarding completion rate** (target: >80%)
- **Prize payout success rate** (target: >99%)
- **Error rates** (target: <1%)

#### Alert Conditions
- Failed prize calculations
- Failed Stripe transfers
- High error rates in prize functions
- Unusual patterns in prize amounts

---

## Testing Commands Summary

### Quick Test Sequence
```bash
# 1. Complete challenge
curl -X POST /.netlify/functions/test-complete-challenge \
  -H "Content-Type: application/json" \
  -d '{"challengeId": "your_challenge_id"}'

# 2. Check winners were calculated (check response above)

# 3. Create winner Stripe account
curl -X POST /.netlify/functions/create-winner-connected-account \
  -H "Content-Type: application/json" \
  -d '{"userId": "winner_user_id", "challengeId": "your_challenge_id", "placement": 1}'

# 4. Process payout (after Stripe onboarding)
curl -X POST /.netlify/functions/payout-prize-money \
  -H "Content-Type: application/json" \
  -d '{"prizeRecordId": "prize_record_id"}'
```

### Expected Results Summary
1. **Challenge Completion**: 200 response with winners calculated
2. **Notifications**: All participants receive appropriate notifications
3. **UI Updates**: Challenge wrapup page shows prize sections
4. **Winner Onboarding**: Stripe account creation successful
5. **Prize Payout**: Transfer processed with 3% platform fee

---

This comprehensive testing guide ensures the prize money system works correctly across all platforms and scenarios. Follow each step carefully and verify all expected results before proceeding to production deployment. 