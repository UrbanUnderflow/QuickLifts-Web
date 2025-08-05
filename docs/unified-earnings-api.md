# Unified Earnings Backend API Documentation

## Overview

The unified earnings system consolidates creator earnings and winner prize money into a single, comprehensive API. This allows users to view all their earnings from the Pulse platform in one place, with consistent currency formatting and simplified payout management.

## Architecture

### Core Components

1. **`get-unified-earnings.js`** - Main API that consolidates all earning types
2. **`initiate-unified-payout.js`** - Smart payout system that handles multiple account types
3. **`get-dashboard-link-unified.js`** - Unified Stripe dashboard access
4. **`utils/unified-earnings-compatibility.js`** - Backward compatibility layer

### Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  Unified APIs    │───▶│  Legacy APIs    │
│  New Earnings   │    │                  │    │                 │
│     Page        │    │ • get-unified-   │    │ • get-earnings  │
└─────────────────┘    │   earnings       │    │ • get-winner-   │
                       │ • initiate-      │    │   prize-history │
┌─────────────────┐    │   unified-payout │    │ • get-dashboard │
│   Frontend      │───▶│ • get-dashboard- │    │   -link        │
│  Legacy Pages   │    │   link-unified   │    └─────────────────┘
│                 │    └──────────────────┘              │
│ • trainer/      │                                      │
│   dashboard     │                                      ▼
│ • winner/       │                               ┌─────────────────┐
│   dashboard     │                               │    Stripe API   │
└─────────────────┘                               │   & Firestore   │
                                                  └─────────────────┘
```

## API Endpoints

### 1. Get Unified Earnings

**Endpoint**: `/.netlify/functions/get-unified-earnings`  
**Method**: `GET`  
**Parameters**: 
- `userId` (required) - User ID to fetch earnings for

**Response**:
```json
{
  "success": true,
  "earnings": {
    "totalBalance": 125.50,
    "totalEarned": 1250.00,
    "pendingPayout": 15.25,
    
    "creatorEarnings": {
      "totalEarned": 1000.00,
      "availableBalance": 100.00,
      "pendingPayout": 10.00,
      "roundsSold": 15,
      "stripeAccountId": "acct_123...",
      "onboardingStatus": "complete"
    },
    
    "prizeWinnings": {
      "totalEarned": 250.00,
      "availableBalance": 25.50,
      "pendingPayout": 5.25,
      "totalWins": 3,
      "stripeAccountId": "acct_456...",
      "onboardingStatus": "complete"
    },
    
    "transactions": [
      {
        "id": "txn_123",
        "type": "creator_sale",
        "date": "2024-01-15",
        "amount": 29.99,
        "description": "Full Body Workout Program",
        "status": "completed",
        "metadata": {
          "buyerId": "user_789",
          "programTitle": "Full Body Workout Program"
        }
      },
      {
        "id": "txn_456", 
        "type": "prize_winning",
        "date": "2024-01-10",
        "amount": 100.00,
        "description": "🥇 1st Place - January Challenge",
        "status": "paid",
        "metadata": {
          "challengeId": "challenge_123",
          "placement": 1,
          "score": 985
        }
      }
    ],
    
    "canRequestPayout": true,
    "minimumPayoutAmount": 10.00,
    "nextPayoutDate": "2024-01-18",
    
    "hasCreatorAccount": true,
    "hasWinnerAccount": true,
    "needsAccountSetup": false,
    
    "lastUpdated": "2024-01-15T10:30:00.000Z",
    "isNewAccount": false
  }
}
```

### 2. Initiate Unified Payout

**Endpoint**: `/.netlify/functions/initiate-unified-payout`  
**Method**: `POST`  
**Body**:
```json
{
  "userId": "user_123",
  "amount": 50.00,
  "currency": "usd"
}
```

**Response**:
```json
{
  "success": true,
  "payout": {
    "amount": 50.00,
    "currency": "usd",
    "strategy": "combined",
    "results": [
      {
        "source": "creator",
        "amount": 35.00,
        "stripePayoutId": "po_123...",
        "status": "pending",
        "success": true
      },
      {
        "source": "winner",
        "amount": 15.00,
        "stripePayoutId": "po_456...",
        "status": "pending", 
        "success": true
      }
    ],
    "estimatedArrival": {
      "date": "2024-01-18",
      "businessDays": "2-7 business days",
      "note": "Actual timing may vary based on your bank and Stripe processing"
    }
  },
  "message": "Payout initiated successfully"
}
```

**Payout Strategies**:
- `single_creator` - Payout from creator account only
- `single_winner` - Payout from winner account only  
- `combined` - Split payout across both accounts (prioritizes larger balance)

### 3. Get Unified Dashboard Link

**Endpoint**: `/.netlify/functions/get-dashboard-link-unified`  
**Method**: `POST`  
**Body**:
```json
{
  "userId": "user_123",
  "accountType": "auto"  // "creator", "winner", or "auto"
}
```

**Response**:
```json
{
  "success": true,
  "url": "https://connect.stripe.com/express/...",
  "accountInfo": {
    "type": "creator",
    "accountId": "acct_123...",
    "description": "Creator earnings account (primary)"
  },
  "expiresAt": "2024-01-15T11:30:00.000Z"
}
```

## Currency Handling

The unified system normalizes all currency to **dollars** for consistency:

- **Creator Earnings**: Already in dollars (from Stripe API)
- **Prize Winnings**: Converted from cents to dollars (stored as cents in Firestore)
- **Transaction History**: All amounts in dollars
- **Payout Requests**: Amounts in dollars, converted to cents for Stripe API

## Backward Compatibility

### Compatibility Layer

The `unified-earnings-compatibility.js` module provides wrappers that maintain existing API contracts while internally using the unified system:

```javascript
// Example usage in existing get-earnings.js
const { getTrainerEarningsCompatibility, shouldUseUnifiedSystem } = require('./utils/unified-earnings-compatibility');

const handler = async (event) => {
  const userId = event.queryStringParameters?.userId;
  
  // Check if user should use unified system
  if (shouldUseUnifiedSystem(userId)) {
    return await getTrainerEarningsCompatibility(userId);
  }
  
  // Fallback to legacy implementation
  // ... existing code
};
```

### Gradual Rollout

The system supports gradual rollout via environment variables:

```bash
# Roll out to 25% of users
UNIFIED_EARNINGS_ROLLOUT_PERCENTAGE=25

# Full rollout (default)
UNIFIED_EARNINGS_ROLLOUT_PERCENTAGE=100
```

## Error Handling

### Error Response Format

All APIs return consistent error responses:

```json
{
  "success": false,
  "error": "Insufficient balance. Available: $45.50, Requested: $50.00",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common Error Scenarios

1. **Missing Stripe Account**: User needs to complete onboarding
2. **Insufficient Balance**: Requested payout exceeds available funds
3. **Minimum Payout**: Amount below $10.00 minimum
4. **Account Errors**: Stripe account issues or configuration problems

### Fallback Behavior

- If unified system fails, falls back to legacy APIs
- Partial payout failures are logged but don't block successful portions
- Graceful degradation when individual services are unavailable

## Security Considerations

### Access Control

- All endpoints require valid `userId` parameter
- No sensitive account IDs exposed in responses
- Stripe dashboard links auto-expire after 1 hour

### Data Privacy

- Transaction buyer information limited to anonymous IDs where applicable
- Logging excludes full user IDs (partial IDs for debugging)
- Payout records stored securely in Firestore

## Migration Path

### Phase 2 (Current)
✅ Unified backend APIs created  
✅ Backward compatibility layer implemented  
✅ Currency normalization completed  
✅ Error handling and logging added

### Phase 3 (Next)
- Create unified frontend earnings page
- Update navigation and user flows
- Implement privacy controls

### Phase 4 (Following)
- Add earnings integration to profile pages
- Update internal links and navigation

### Phase 5 (Final)
- Add redirects from legacy dashboard pages
- Gradual deprecation of old endpoints
- Remove compatibility layer

## Testing

### Manual Testing

```bash
# Test unified earnings
curl "/.netlify/functions/get-unified-earnings?userId=YOUR_USER_ID"

# Test unified payout
curl -X POST /.netlify/functions/initiate-unified-payout \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","amount":25.00}'

# Test dashboard link
curl -X POST /.netlify/functions/get-dashboard-link-unified \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","accountType":"auto"}'
```

### Test Scenarios

1. **Creator Only**: User with only creator earnings
2. **Winner Only**: User with only prize winnings  
3. **Combined**: User with both earning types
4. **New User**: User with no earnings yet
5. **Partial Account Setup**: User with pending Stripe onboarding

## Monitoring & Analytics

### Logging

All functions log comprehensive metrics:
- Request/response times
- Error rates and types  
- Payout success/failure rates
- Compatibility layer usage

### Key Metrics

- **API Response Times**: < 2s for earnings, < 5s for payouts
- **Error Rates**: < 1% for normal operations
- **Payout Success Rate**: > 95% for valid requests
- **Currency Conversion Accuracy**: 100% (automated testing)

---

**Next Phase**: [Frontend Unified Earnings Page Development](./phase-3-frontend-implementation.md) 