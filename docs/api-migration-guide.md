# API Migration Guide: Legacy to Unified Earnings System

## Overview

This guide documents the migration from separate trainer and winner earnings endpoints to a unified earnings system. The new system provides a single, consolidated API for all earnings-related operations while maintaining backward compatibility during the transition period.

## Migration Timeline

- **Phase 1** ✅: Data structure analysis and backend consolidation
- **Phase 2** ✅: Unified backend API implementation with backward compatibility
- **Phase 3** ✅: Frontend unified earnings page
- **Phase 4** ✅: Navigation updates and legacy redirects
- **Phase 5** (Future): Complete deprecation of legacy endpoints

## Endpoint Changes

### **NEW: Unified Earnings Endpoints**

#### `GET /get-unified-earnings`
**Purpose**: Fetches consolidated earnings data for both creator and winner earnings

**Parameters**:
- `userId` (required): User ID to fetch earnings for

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
      "stripeAccountId": "acct_...",
      "onboardingStatus": "complete"
    },
    "prizeWinnings": {
      "totalEarned": 250.00,
      "availableBalance": 25.50,
      "pendingPayout": 5.25,
      "totalWins": 3,
      "stripeAccountId": "acct_...",
      "onboardingStatus": "complete"
    },
    "transactions": [
      {
        "id": "txn_...",
        "type": "creator_sale",
        "date": "2024-01-15",
        "amount": 29.99,
        "description": "Program: 'Advanced HIIT Training'",
        "status": "completed",
        "metadata": {...}
      }
    ],
    "canRequestPayout": true,
    "minimumPayoutAmount": 10.00,
    "nextPayoutDate": "2024-01-20",
    "hasCreatorAccount": true,
    "hasWinnerAccount": true,
    "needsAccountSetup": false,
    "lastUpdated": "2024-01-15T10:30:00Z",
    "isNewAccount": false
  }
}
```

#### `POST /initiate-unified-payout`
**Purpose**: Initiates payout from unified earnings, intelligently routing across multiple Stripe accounts

**Parameters**:
```json
{
  "userId": "user123",
  "amount": 50.00,
  "currency": "usd"
}
```

**Response**:
```json
{
  "success": true,
  "payout": {
    "payoutRecordId": "payout_record_123",
    "strategy": "combined",
    "payouts": [
      {
        "stripePayoutId": "po_creator_123",
        "accountType": "creator",
        "amount": 30.00
      },
      {
        "stripePayoutId": "po_winner_456", 
        "accountType": "winner",
        "amount": 20.00
      }
    ],
    "estimatedArrival": {
      "businessDays": "2-7 business days",
      "date": "2024-01-22"
    }
  }
}
```

#### `POST /get-dashboard-link-unified`
**Purpose**: Generates Stripe Express Dashboard login link, intelligently selecting the appropriate account

**Parameters**:
```json
{
  "userId": "user123",
  "accountType": "auto", // "auto", "creator", "winner"
  "preferredAccount": "creator" // optional
}
```

**Response**:
```json
{
  "success": true,
  "url": "https://connect.stripe.com/express/...",
  "accountUsed": "creator",
  "accountId": "acct_..."
}
```

### **LEGACY: Deprecated Endpoints**

#### ⚠️ `GET /get-earnings` (Deprecated)
**Status**: Deprecated but functional via compatibility layer  
**Migration**: Use `/get-unified-earnings` instead  
**Timeline**: Will be removed in Phase 5

#### ⚠️ `GET /get-winner-prize-history` (Deprecated)
**Status**: Deprecated but functional via compatibility layer  
**Migration**: Use `/get-unified-earnings` instead  
**Timeline**: Will be removed in Phase 5

#### ⚠️ `POST /get-dashboard-link` (Deprecated)
**Status**: Deprecated but functional  
**Migration**: Use `/get-dashboard-link-unified` instead  
**Timeline**: Will be removed in Phase 5

## Backward Compatibility

### Compatibility Layer
The `unified-earnings-compatibility.js` module provides seamless backward compatibility:

```javascript
// Legacy trainer earnings call
const trainerData = await fetch('/get-earnings?userId=123');

// Internally routed to:
const unifiedData = await fetch('/get-unified-earnings?userId=123');
// Then converted back to legacy format
```

### Feature Flags
Gradual rollout controlled by environment variables:

```javascript
const ENABLE_UNIFIED_EARNINGS = process.env.ENABLE_UNIFIED_EARNINGS === 'true';
```

### Migration Detection
Query parameters track migration sources:
- `?migrated=trainer` - Redirected from trainer dashboard
- `?migrated=winner` - Redirected from winner dashboard

## Data Structure Changes

### Currency Normalization
- **Legacy**: Mixed currency units (cents for winners, dollars for creators)
- **Unified**: All amounts in dollars for consistency

### Transaction Consolidation
- **Legacy**: Separate transaction histories
- **Unified**: Combined chronological transaction history

### Account Status Unification
- **Legacy**: Separate account statuses
- **Unified**: Consolidated account status with individual account details

## Frontend Migration

### URL Structure Changes
| Old Pattern | New Pattern | Status |
|-------------|-------------|---------|
| `/trainer/dashboard` | `/{username}/earnings` | ✅ Redirects |
| `/winner/dashboard` | `/{username}/earnings` | ✅ Redirects |
| `/trainer/connect-account` | `/trainer/connect-account` | ✅ Updated redirects |
| `/winner/connect-account` | `/winner/connect-account` | ✅ Updated redirects |

### Navigation Updates
| Component | Change | Status |
|-----------|--------|---------|
| `UserMenu.tsx` | Added earnings navigation | ✅ Complete |
| `profile/[username].tsx` | Added earnings tab | ✅ Complete |
| Hardcoded links | Updated to new URLs | ✅ Complete |

## Analytics Tracking

### New Events Tracked

#### Unified Earnings Events
```javascript
// Page view tracking
trackEvent(userEmail, 'EarningsPageViewed', {
  userId, username, totalBalance, totalEarned,
  hasCreatorEarnings, hasPrizeWinnings, isNewAccount
});

// Payout request tracking
trackEvent(userEmail, 'PayoutRequested', {
  userId, amount, currency, strategy, estimatedArrival, payoutRecordId
});

// Privacy settings tracking
trackEvent(userEmail, 'EarningsPrivacyUpdated', {
  userId, showTotalEarnings, showEarningsBreakdown, 
  showTransactionCount, showRecentActivity
});
```

#### Legacy Migration Events
```javascript
// Legacy dashboard access tracking
trackEvent(userEmail, 'LegacyTrainerDashboardAccessed', {
  userId, username, hasRedirectNotice, redirectDelay, preservedParams
});

// Redirect execution tracking
trackEvent(userEmail, 'LegacyDashboardRedirectExecuted', {
  userId, fromDashboard, targetUrl, challengeContext
});
```

## Error Handling

### Graceful Degradation
- Unified APIs fail gracefully to legacy behavior
- Frontend continues working if earnings API fails
- Comprehensive error logging for debugging

### Error Response Format
```json
{
  "success": false,
  "error": "Descriptive error message",
  "errorCode": "INSUFFICIENT_BALANCE",
  "details": {
    "requestedAmount": 100.00,
    "availableBalance": 50.00
  }
}
```

## Security Considerations

### Authentication
- All endpoints require valid user authentication
- User can only access their own earnings data
- Admin endpoints require elevated permissions

### Data Privacy
- Earnings data only accessible to account owner
- Privacy controls for public earnings visibility
- Secure handling of Stripe account IDs

### Input Validation
```javascript
// Payout amount validation
if (amount < 10.00) {
  throw new Error('Minimum payout amount is $10.00');
}

if (amount > availableBalance) {
  throw new Error('Insufficient balance for requested payout');
}
```

## Testing Strategy

### Unit Tests
- Unified earnings calculation logic
- Currency conversion accuracy
- Payout strategy selection
- Backward compatibility functions

### Integration Tests
- End-to-end payout flows
- Dashboard link generation
- Legacy endpoint compatibility
- Error handling scenarios

### Load Testing
- Concurrent payout requests
- High-volume earnings data fetching
- Dashboard link generation under load

## Monitoring & Observability

### Key Metrics to Monitor

#### Usage Metrics
- Unified earnings page views
- Legacy dashboard redirect rates
- Payout request success rates
- Dashboard link generation frequency

#### Performance Metrics
- API response times
- Stripe API call latency
- Database query performance
- Error rates by endpoint

#### Business Metrics
- Total payout volume
- Average payout amounts
- User adoption of unified system
- Revenue by earning type

### Alerts
```javascript
// Critical alerts
- Payout failure rate > 5%
- API error rate > 1%
- Database connection failures

// Warning alerts  
- Legacy endpoint usage > 10%
- Dashboard link generation failures
- Slow API response times (> 2s)
```

## Deployment Guidelines

### Deployment Sequence
1. Deploy unified backend APIs (backward compatible)
2. Deploy frontend with feature flags disabled
3. Enable unified system for test users
4. Gradual rollout to all users
5. Monitor and adjust as needed
6. Deprecate legacy endpoints (Phase 5)

### Rollback Plan
1. Disable unified system via feature flags
2. Route all traffic to legacy endpoints
3. Investigate and fix issues
4. Re-enable unified system

### Environment Configuration
```bash
# Environment variables
ENABLE_UNIFIED_EARNINGS=true
UNIFIED_EARNINGS_ROLLOUT_PERCENTAGE=100
STRIPE_CREATOR_WEBHOOK_SECRET=whsec_...
STRIPE_WINNER_WEBHOOK_SECRET=whsec_...
```

## Migration Checklist

### Backend Migration ✅
- [x] Unified earnings data aggregation
- [x] Multi-account payout logic
- [x] Intelligent dashboard link generation
- [x] Backward compatibility layer
- [x] Error handling and logging

### Frontend Migration ✅
- [x] Unified earnings page implementation
- [x] Legacy dashboard redirects
- [x] Navigation integration
- [x] Privacy controls
- [x] Mobile responsiveness

### Analytics & Monitoring ✅
- [x] Event tracking implementation
- [x] Legacy migration tracking
- [x] Error monitoring setup
- [x] Performance metrics

### Documentation & Testing ✅
- [x] API documentation
- [x] Migration guide
- [x] Testing strategy
- [x] Deployment guidelines

## Support & Troubleshooting

### Common Issues

#### "Payout Failed" Errors
- Check Stripe account setup completion
- Verify sufficient balance
- Ensure minimum payout amount met
- Check Stripe account restrictions

#### Dashboard Link Generation Issues
- Verify Stripe account exists
- Check onboarding completion status
- Ensure proper account type selection
- Review Stripe Express configuration

#### Legacy Redirect Issues
- Clear browser cache
- Check feature flag settings
- Verify user authentication
- Review redirect parameter handling

### Contact Information
- **Technical Issues**: engineering@fitwithpulse.ai
- **Business Questions**: support@fitwithpulse.ai
- **Emergency**: Alert on-call engineer via PagerDuty

---

**Last Updated**: Phase 4 Complete - December 2024  
**Next Review**: Phase 5 Planning - Q1 2025 