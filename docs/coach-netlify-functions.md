# Coach Partnership Netlify Functions

This document outlines the serverless functions created for the Coach Partnership system.

## 📋 **Function Overview**

### **1. Coach Checkout Sessions**
- **File**: `netlify/functions/create-coach-checkout-session.js`
- **Purpose**: Create Stripe checkout sessions for coach subscriptions
- **Endpoint**: `/.netlify/functions/create-coach-checkout-session`

### **2. Athlete Checkout Sessions**
- **File**: `netlify/functions/create-athlete-checkout-session.js`
- **Purpose**: Create Stripe checkout sessions for athlete subscriptions
- **Endpoint**: `/.netlify/functions/create-athlete-checkout-session`

### **3. Coach Webhook Handler**
- **File**: `netlify/functions/stripe-coach-webhook.js`
- **Purpose**: Process coach-specific Stripe webhook events
- **Endpoint**: `/.netlify/functions/stripe-coach-webhook`

### **4. Subscription Management**
- **File**: `netlify/functions/manage-subscription.js`
- **Purpose**: Handle subscription changes (cancel, update, billing portal)
- **Endpoint**: `/.netlify/functions/manage-subscription`

### **5. Revenue Calculation**
- **File**: `netlify/functions/calculate-coach-revenue.js`
- **Purpose**: Calculate coach revenue sharing (scheduled daily)
- **Endpoint**: `/.netlify/functions/calculate-coach-revenue`

---

## 🔧 **Function Details**

### **create-coach-checkout-session**

Creates Stripe checkout sessions specifically for coach subscriptions.

**Request Body:**
```json
{
  "priceId": "price_coach_monthly_24_99",
  "userId": "user123",
  "referralCode": "COACH123",
  "referredByCoachId": "coach456",
  "schedulingUrl": "https://calendly.com/coach"
}
```

**Features:**
- Validates coach price IDs only
- Generates unique referral codes
- Handles coach referral relationships
- Sets proper metadata for revenue tracking
- Redirects to coach onboarding on success

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

### **create-athlete-checkout-session**

Creates Stripe checkout sessions for athlete subscriptions.

**Request Body:**
```json
{
  "priceId": "price_athlete_monthly_12_99",
  "userId": "athlete123",
  "coachReferralCode": "COACH123"
}
```

**Features:**
- Validates athlete price IDs only
- Links athletes to coaches via referral codes
- Handles both independent and coach-linked athletes
- Sets proper metadata for revenue sharing

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

### **stripe-coach-webhook**

Processes Stripe webhook events for the coach partnership system.

**Webhook Events Handled:**
- `checkout.session.completed` - Creates coach/athlete records
- `customer.subscription.created` - Sets up coach partnerships
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Handles cancellations

**Key Functions:**
- Creates coach documents in Firestore
- Generates unique referral codes
- Links athletes to coaches
- Creates referral relationships
- Updates subscription statuses

**Environment Variables Required:**
- `STRIPE_WEBHOOK_SECRET_COACH` - Dedicated webhook secret

---

### **manage-subscription**

Handles subscription management operations.

**Actions Supported:**

#### Cancel Subscription
```json
{
  "action": "cancel",
  "userId": "user123",
  "immediately": false
}
```

#### Update Plan
```json
{
  "action": "update_plan",
  "userId": "user123",
  "newPriceId": "price_coach_annual_249"
}
```

#### Reactivate Subscription
```json
{
  "action": "reactivate",
  "userId": "user123"
}
```

#### Billing Portal
```json
{
  "action": "billing_portal",
  "userId": "user123",
  "returnUrl": "https://yoursite.com/profile"
}
```

#### Get Status
```json
{
  "action": "get_status",
  "userId": "user123"
}
```

---

### **calculate-coach-revenue**

Calculates revenue sharing for all coaches based on the partnership model.

**Revenue Splits:**
- **Coach Partnership**: 40% to coach, 60% to Pulse
- **Coach Referral**: 20% to referring coach, 80% to Pulse

**Scheduled Execution:**
- Runs daily at 6 AM UTC
- Updates coach documents with current revenue
- Stores calculation history

**Revenue Calculation Process:**
1. Get all active coach subscriptions
2. Calculate direct revenue from coach's athletes (40% share)
3. Calculate referral bonuses (20% of referred coach's total revenue)
4. Store results in Firestore
5. Update coach documents with current earnings

**Response:**
```json
{
  "success": true,
  "message": "Revenue calculation completed successfully",
  "summary": {
    "totalCoaches": 15,
    "totalRevenue": 25600,
    "totalAthletes": 450,
    "totalReferrals": 8
  },
  "calculatedAt": "2024-01-15T06:00:00.000Z"
}
```

---

## 🔐 **Environment Variables**

All functions require these environment variables:

### **Required for All Functions:**
```bash
STRIPE_SECRET_KEY=sk_...                    # Stripe secret key
STRIPE_TEST_SECRET_KEY=sk_test_...          # Test secret key (development)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # Firebase admin SDK
SITE_URL=https://fitwithpulse.ai           # Your site URL
```

### **Required for Coach Webhook:**
```bash
STRIPE_WEBHOOK_SECRET_COACH=whsec_...       # Coach webhook endpoint secret
```

### **Required for Product References:**
```bash
STRIPE_PRICE_ATHLETE_MONTHLY=price_...      # $12.99/month
STRIPE_PRICE_ATHLETE_ANNUAL=price_...       # $119/year
STRIPE_PRICE_COACH_MONTHLY=price_...        # $24.99/month
STRIPE_PRICE_COACH_ANNUAL=price_...         # $249/year
```

---

## 🚀 **Deployment Configuration**

The functions are configured in `netlify.toml`:

```toml
# Coach Partnership Functions
[functions.create-coach-checkout-session]
  external_node_modules = ["stripe"]

[functions.create-athlete-checkout-session]
  external_node_modules = ["stripe"]

[functions.stripe-coach-webhook]
  external_node_modules = ["stripe"]

[functions.manage-subscription]
  external_node_modules = ["stripe"]

[functions.calculate-coach-revenue]
  external_node_modules = ["stripe"]
  # Run revenue calculation daily at 6 AM UTC
  schedule = "0 6 * * *"
```

---

## 🔗 **Integration Points**

### **Frontend Integration:**
- Partner page "Get Started" button → `create-coach-checkout-session`
- Athlete subscription page → `create-athlete-checkout-session`
- Profile/settings → `manage-subscription`

### **Stripe Integration:**
- Checkout sessions redirect to success/cancel URLs
- Webhook endpoint processes subscription events
- Billing portal for subscription management

### **Firestore Integration:**
- Creates/updates `coaches`, `coachAthletes`, `coachReferrals` collections
- Updates `users` collection with role and coach linking
- Stores revenue calculations and history

---

## 🧪 **Testing**

### **Local Testing:**
```bash
# Start Netlify dev server
netlify dev

# Test functions locally
curl -X POST http://localhost:8888/.netlify/functions/create-coach-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_coach_monthly_24_99","userId":"test123"}'
```

### **Webhook Testing:**
1. Use Stripe CLI to forward webhooks to local development
2. Test with Stripe's webhook testing tools
3. Verify events are processed correctly in Firestore

### **Revenue Calculation Testing:**
```bash
# Trigger manual revenue calculation
curl -X POST http://localhost:8888/.netlify/functions/calculate-coach-revenue
```

---

## 📊 **Monitoring**

### **Logs:**
- All functions log extensively for debugging
- Revenue calculations are stored for audit trails
- Webhook events are logged with detailed processing info

### **Error Handling:**
- Comprehensive error messages
- Proper HTTP status codes
- Graceful failure modes

### **Performance:**
- Revenue calculation is optimized for large datasets
- Subscription queries use proper indexes
- Function timeouts configured appropriately
