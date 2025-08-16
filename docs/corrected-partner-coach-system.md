# Corrected Partner & Coach System

## Overview

The coach partnership system has been corrected to properly distinguish between **Partners** (approved directly by the company) and **Standard Coaches** (who pay subscriptions and can optionally link to partners for revenue sharing).

## Two Types of Coaches

### 1. **Partners** (Revenue Share Partners)
- **Signup Process**: Direct approval by company (no promo codes required)
- **Payment**: No subscription fee (they earn revenue share instead)
- **Revenue Model**: Get 40% of revenue from athletes they bring in
- **Referral System**: Get their own referral codes that standard coaches can use
- **Approval**: Manually approved by company leadership

### 2. **Standard Coaches** (Paying Subscribers)
- **Signup Process**: Pay monthly/annual subscription ($24.99/mo or $249/year)
- **Payment**: Required subscription to access coach features
- **Partner Code**: Optional field to link to a partner coach for revenue sharing
- **Revenue Model**: Pay for the service, but partner gets revenue share if linked

## Revenue Sharing Flow

### When Standard Coach Links to Partner:
1. **Standard Coach** pays subscription ($24.99/mo)
2. **Partner** gets 40% revenue share ($10/mo from that coach)
3. **Pulse** keeps 60% ($14.99/mo)

### When Partner Brings Athletes Directly:
1. **Athlete** pays subscription ($12.99/mo) 
2. **Partner** gets 40% revenue share ($5.20/mo per athlete)
3. **Pulse** keeps 60% ($7.79/mo per athlete)

## Technical Implementation

### Partner Signup Flow:
```
1. Partner fills out form (no promo code required)
2. Company manually approves them
3. Partner gets their own referral code (e.g., "COACH123")
4. Partner can share their code with standard coaches
```

### Standard Coach Signup Flow:
```
1. Coach chooses subscription plan
2. Optionally enters partner code (e.g., "COACH123") 
3. Pays subscription via Stripe
4. If partner code provided, gets linked for revenue sharing
```

### Database Structure:

**Partners:**
```javascript
{
  userId: "partner123",
  referralCode: "COACH123", // Their code that others can use
  subscriptionStatus: "partner",
  userType: "partner",
  // NO linkedPartnerId (they ARE the partner)
}
```

**Standard Coaches:**
```javascript
{
  userId: "coach456", 
  referralCode: "COACH456", // Their own code (auto-generated)
  linkedPartnerId: "partner123", // Link to partner for revenue sharing
  subscriptionStatus: "active",
  userType: "coach",
  stripeCustomerId: "cus_..."
}
```

## Key Differences from Previous Implementation

### ❌ **Before (Incorrect):**
- Partners needed promo codes to sign up
- Complex promo code validation system
- Confusing referral structure

### ✅ **After (Correct):**
- **Partners**: No promo codes needed (direct approval)
- **Standard Coaches**: Optional partner codes for revenue linking
- Clear separation between partner approval and coach subscription

## Partner Code System

### How It Works:
1. **Company approves a partner** → Partner gets referral code "COACH123"
2. **Partner shares code** with potential standard coaches
3. **Standard coach signs up** with partner code "COACH123"
4. **System links them** for revenue sharing automatically
5. **Revenue calculations** split 60/40 between Pulse and partner

### Code Validation:
- Checks if code belongs to an active partner
- Links the paying coach to the partner
- Enables revenue tracking for payouts

## Files Modified

### Frontend:
- `PartnerJoinModal.tsx` - Removed promo code requirement
- `CoachProductModal.tsx` - Added optional partner code field

### Backend:
- `create-partner-profile.js` - Removed promo code validation
- `create-coach-checkout-session.js` - Added partner code handling
- `stripe-coach-webhook.js` - Partner code validation and linking

### Data Models:
- Added `linkedPartnerId` field for standard coaches
- Removed promo code requirements for partners
- Clear `userType` distinction between 'coach' and 'partner'

## Summary

The system now correctly implements:

1. **🤝 Partner Approval**: Direct company approval (no codes needed)
2. **💳 Coach Subscriptions**: Standard coaches pay subscriptions
3. **🔗 Revenue Linking**: Partner codes link coaches to partners for revenue sharing
4. **📊 Clear Tracking**: Proper database structure for revenue calculations

This creates a clean separation between revenue-sharing partners and paying coach customers, while enabling the desired revenue sharing when coaches choose to link to partners.
