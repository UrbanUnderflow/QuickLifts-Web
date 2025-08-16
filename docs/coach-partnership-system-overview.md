# Coach Partnership System - Complete Overview

This document provides a comprehensive overview of the Coach Partnership system implemented for the Pulse app, detailing how all components work together to create a revenue-sharing ecosystem for coaches and athletes.

## 📋 **Table of Contents**

1. [System Overview](#system-overview)
2. [Partnership Model](#partnership-model)
3. [User Journey](#user-journey)
4. [Technical Architecture](#technical-architecture)
5. [Database Schema](#database-schema)
6. [Revenue Calculation](#revenue-calculation)
7. [Integration Points](#integration-points)
8. [Security & Authentication](#security--authentication)
9. [Testing & Deployment](#testing--deployment)

---

## 📊 **System Overview**

The Coach Partnership system enables coaches to:
- **Earn recurring revenue** from athlete subscriptions (40% share)
- **Receive referral bonuses** from coaches they bring to the platform (20% share)
- **Manage their athlete community** through web and mobile dashboards
- **Integrate booking systems** for 1-on-1 sessions
- **Track earnings** with automated revenue calculations

### **Key Stakeholders:**
- **Coaches**: Fitness professionals who manage athletes and earn revenue
- **Athletes**: Users who subscribe to access Pulse + PulseCheck
- **Pulse**: Platform that provides technology and takes 60-80% revenue share

---

## 💰 **Partnership Model**

### **Pricing Structure**

#### **For Athletes (No Coach)**
- **Monthly**: $12.99/month
- **Annual**: $119/year (8% discount)
- **Features**: Full access to Pulse + PulseCheck

#### **For Coaches**
- **Monthly**: $24.99/month  
- **Annual**: $249/year (16% discount)
- **Features**: Coach dashboard, athlete management, revenue sharing, booking integration

#### **For Athletes (With Coach)**
- **Cost**: Free to athlete (paid by coach's subscription)
- **Access**: Same features as independent athletes
- **Coach Benefits**: Revenue tracking, direct communication, booking system

### **Revenue Sharing**

#### **Coach Partnership (Direct Athletes)**
```
Total Revenue from Coach's Athletes: 100%
├── Coach Share: 40%
└── Pulse Share: 60%
```

#### **Coach Referral Program**
```
Revenue from Referred Coach's Athletes: 100%
├── Referring Coach: 20%
└── Pulse: 80%
Note: Referred coach gets NO share from their athletes in this model
```

### **Example Revenue Calculations**

**Scenario 1: Coach with 100 Direct Athletes**
- Monthly Revenue: 100 × $12.99 = $1,299
- Coach Earnings: $1,299 × 40% = **$520/month**
- Pulse Revenue: $1,299 × 60% = $779/month

**Scenario 2: Coach Refers Another Coach with 100 Athletes**
- Referred Coach's Revenue: 100 × $12.99 = $1,299/month
- Referring Coach Bonus: $1,299 × 20% = **$260/month**
- Pulse Revenue: $1,299 × 80% = $1,039/month
- Referred Coach Earnings: **$0** (they don't earn from their athletes)

---

## 🚀 **User Journey**

### **Coach Signup Flow**

1. **Discovery**: Coach visits `/partner` page
2. **Interest**: Clicks "Get Started" CTA button
3. **Authentication Check**: 
   - If not signed in → Shows auth prompt
   - If signed in → Proceeds to plan selection
4. **Plan Selection**: Choose monthly ($24.99) or annual ($249)
5. **Details**: Optional referral code, scheduling URL, referred-by coach
6. **Payment**: Redirects to Stripe checkout
7. **Success**: Lands on `/coach/onboarding-success` with next steps
8. **Onboarding**: Download app, get referral code, invite athletes

### **Athlete Signup Flow (Through Coach)**

1. **Referral**: Athlete receives coach referral code
2. **Signup**: Creates account in Pulse app
3. **Subscription**: Subscribes using coach referral code
4. **Linking**: System automatically links athlete to coach
5. **Access**: Gets full Pulse + PulseCheck features
6. **Revenue**: Coach starts earning 40% from this athlete

### **Coach Referral Flow**

1. **Invitation**: Existing coach shares platform with another coach
2. **Signup**: New coach signs up with referring coach's code
3. **Subscription**: New coach subscribes to coach plan
4. **Athletes**: New coach brings their own athletes
5. **Revenue**: Original coach earns 20% from new coach's athlete revenue

---

## 🏗️ **Technical Architecture**

### **Frontend (Next.js/React)**
```
src/
├── pages/
│   ├── partner.tsx                    # Main partnership landing page
│   └── coach/
│       └── onboarding-success.tsx     # Post-payment success page
├── components/
│   └── PartnerJoinModal.tsx           # Coach signup modal
├── utils/
│   ├── stripeConstants.ts             # Price IDs and helpers
│   └── stripeKey.ts                   # Environment-aware Stripe keys
└── types/
    └── Coach.ts                       # TypeScript interfaces
```

### **Backend (Netlify Functions)**
```
netlify/functions/
├── create-coach-checkout-session.js   # Coach subscription checkout
├── create-athlete-checkout-session.js # Athlete subscription checkout
├── stripe-coach-webhook.js            # Process coach subscription events
├── manage-subscription.js             # Subscription management (cancel, update, etc.)
└── calculate-coach-revenue.js         # Daily revenue calculations (scheduled)
```

### **Database (Firestore)**
```
collections/
├── users/{uid}                        # Extended with role and coach linking
├── coaches/{coachId}                  # Coach profiles and subscription data
├── coachAthletes/{relationshipId}     # Coach-athlete relationships
├── coachReferrals/{referralId}        # Coach referral tracking
└── revenue-calculations/{timestamp}   # Revenue calculation history
```

### **Mobile (iOS Swift)**
```
Models/
├── User.swift                         # Extended with coach fields
├── Coach.swift                        # Coach data model
├── CoachAthlete.swift                 # Relationship model
└── CoachReferral.swift                # Referral tracking model
```

---

## 🗄️ **Database Schema**

### **Extended Users Collection**
```typescript
interface User {
  // ... existing fields
  role: 'athlete' | 'coach';           // New: User type
  linkedCoachId?: string;              // New: Connected coach ID
}
```

### **Coaches Collection**
```typescript
interface Coach {
  id: string;                          // Coach document ID (same as userId)
  userId: string;                      // Reference to user document
  referralCode: string;                // Unique 8-character code
  referredByCoachId?: string;          // Coach who referred this coach
  stripeCustomerId?: string;           // Stripe customer ID
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  schedulingUrl?: string;              // Calendly/booking link
  createdAt: Date;
  updatedAt: Date;
  
  // Revenue tracking (updated by scheduled function)
  currentRevenue?: number;             // Total monthly revenue
  directRevenue?: number;              // Revenue from direct athletes
  referralRevenue?: number;            // Revenue from referrals
  lastRevenueCalculation?: string;     // Last calculation timestamp
}
```

### **Coach-Athlete Relationships**
```typescript
interface CoachAthlete {
  id: string;                          // Compound ID: {coachId}_{athleteUserId}
  coachId: string;                     // Coach document ID
  athleteUserId: string;               # Athlete user ID
  linkedAt: Date;                      // When relationship was created
}
```

### **Coach Referrals**
```typescript
interface CoachReferral {
  id: string;                          // Auto-generated document ID
  referrerCoachId: string;             // Coach who made the referral
  referredCoachId: string;             // Coach who was referred
  createdAt: Date;                     // When referral was created
}
```

### **Revenue Calculations (History)**
```typescript
interface RevenueCalculation {
  id: string;                          // Auto-generated document ID
  calculatedAt: string;                // ISO timestamp
  summary: {
    totalCoaches: number;              // Active coaches count
    totalRevenue: number;              // Total revenue distributed
    totalAthletes: number;             // Total athletes across all coaches
    totalReferrals: number;            // Total coach referrals
  };
  coaches: Array<{
    coachId: string;
    directRevenue: number;             // Revenue from coach's athletes
    coachShare: number;                // Coach's 40% share
    totalReferralRevenue: number;      // Total referral bonuses
    totalRevenue: number;              // Combined earnings
    athleteCount: number;              // Number of linked athletes
    referralCount: number;             // Number of coaches referred
  }>;
}
```

---

## 📈 **Revenue Calculation**

### **Daily Automated Process**

The `calculate-coach-revenue.js` function runs **daily at 6 AM UTC** and performs:

1. **Data Collection**:
   - Fetches all active coach subscriptions from Stripe
   - Gets all active athlete subscriptions
   - Retrieves coach-athlete relationships from Firestore
   - Maps coach referral hierarchies

2. **Direct Revenue Calculation**:
   ```javascript
   // For each coach
   const athleteSubscriptions = getAthleteSubscriptionsForCoach(coachId);
   const totalRevenue = athleteSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);
   const coachShare = totalRevenue * 0.40; // 40% to coach
   ```

3. **Referral Revenue Calculation**:
   ```javascript
   // For each coach with referrals
   const referredCoaches = getReferredCoaches(coachId);
   const referralRevenue = referredCoaches.reduce((sum, refCoach) => {
     const refCoachTotalRevenue = getCoachTotalRevenue(refCoach.id);
     return sum + (refCoachTotalRevenue * 0.20); // 20% of total revenue
   }, 0);
   ```

4. **Data Storage**:
   - Updates each coach document with current earnings
   - Stores complete calculation in `revenue-calculations` collection
   - Provides audit trail for financial records

### **Revenue Calculation Example**

**Coach A** (referring coach):
- Direct athletes: 50 × $12.99 = $649.50/month
- Coach A's earnings: $649.50 × 40% = **$259.80/month**

**Coach B** (referred by Coach A):
- Direct athletes: 30 × $12.99 = $389.70/month
- Coach B's earnings: **$0** (referred coaches don't earn from athletes)
- Coach A's referral bonus: $389.70 × 20% = **$77.94/month**

**Coach A's Total**: $259.80 + $77.94 = **$337.74/month**

---

## 🔌 **Integration Points**

### **Frontend to Backend**
```javascript
// Coach signup flow
const response = await fetch('/.netlify/functions/create-coach-checkout-session', {
  method: 'POST',
  body: JSON.stringify({
    priceId: 'price_coach_monthly_24_99',
    userId: 'user123',
    referralCode: 'COACH123',
    referredByCoachId: 'coach456',
    schedulingUrl: 'https://calendly.com/coach'
  })
});
```

### **Stripe to Backend**
```javascript
// Webhook processing
stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
// Processes: checkout.session.completed, customer.subscription.created, etc.
```

### **Backend to Firestore**
```javascript
// Create coach document
await db.collection('coaches').doc(userId).set({
  userId,
  referralCode,
  subscriptionStatus: 'active',
  // ... other fields
});
```

### **iOS App Integration**
```swift
// Coach model in iOS
struct Coach: Identifiable, Codable {
  var id: String
  var userId: String
  var referralCode: String
  // ... other fields
}
```

---

## 🔐 **Security & Authentication**

### **Firestore Security Rules**

```javascript
// Coaches can only access their own data
match /coaches/{coachId} {
  allow read, write: if request.auth.uid == coachId;
}

// Coach-athlete relationships
match /coachAthletes/{relationshipId} {
  allow read, write: if resource.data.coachId == request.auth.uid;
  allow read: if resource.data.athleteUserId == request.auth.uid;
}

// Referrals are read-only (except by backend)
match /coachReferrals/{referralId} {
  allow read: if resource.data.referrerCoachId == request.auth.uid ||
                 resource.data.referredCoachId == request.auth.uid;
  allow write: if false; // Only backend can create these
}
```

### **Stripe Webhook Security**
- Dedicated webhook secrets for coach events (`STRIPE_WEBHOOK_SECRET_COACH`)
- Signature verification for all incoming webhooks
- Separate webhook endpoints for different event types

### **Environment Variable Security**
- Sensitive keys only in Netlify environment (never in git)
- Separate test/live API keys based on request origin
- Firebase service account credentials properly secured

---

## 🧪 **Testing & Deployment**

### **Local Development**
```bash
# Set up environment variables
cp .env.coach-template .env.local

# Create Stripe products
npm run stripe:create-products

# Start development server
netlify dev

# Test functions locally
curl -X POST http://localhost:8888/.netlify/functions/create-coach-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_coach_monthly_24_99","userId":"test123"}'
```

### **Production Deployment**
1. **Environment Setup**: Configure all variables in Netlify
2. **Stripe Configuration**: Set up webhooks pointing to production endpoints
3. **Firestore Rules**: Deploy security rules and indexes
4. **Function Deployment**: Netlify automatically deploys functions
5. **Scheduled Jobs**: Revenue calculation runs daily automatically

### **Monitoring**
- Function logs in Netlify dashboard
- Stripe webhook delivery monitoring
- Firestore usage and performance metrics
- Revenue calculation success/failure tracking

---

## 📊 **Revenue Projections**

### **Growth Scenarios**

| Coaches | Avg Athletes/Coach | Monthly Revenue | Coach Earnings | Pulse Revenue |
|---------|-------------------|-----------------|----------------|---------------|
| 10      | 25               | $3,247.50       | $1,299.00      | $1,948.50     |
| 25      | 50               | $16,237.50      | $6,495.00      | $9,742.50     |
| 50      | 75               | $48,712.50      | $19,485.00     | $29,227.50    |
| 100     | 100              | $129,900.00     | $51,960.00     | $77,940.00    |

*Assumes $12.99/month athlete subscriptions and 40% coach share*

### **Referral Impact**

With a 20% referral rate (1 in 5 coaches refers another coach):
- **Direct Revenue**: Coaches earn from their athletes
- **Referral Bonus**: 20% additional from referred coaches' athletes
- **Network Effect**: Exponential growth as successful coaches recruit others

---

## 🚀 **Future Enhancements**

### **Phase B: Web Coach Dashboard**
- Real-time athlete management
- Revenue tracking and analytics
- Communication tools
- Custom scheduling system (iPhone Calendar + Google Calendar integration)

### **Phase C: Mobile Coach Features**
- iOS coach dashboard
- Push notifications
- Direct athlete messaging
- Booking management

### **Phase D: Advanced Analytics**
- Predictive revenue modeling
- Athlete engagement scoring
- Coach performance metrics
- Market trend analysis

---

## 📞 **Support & Maintenance**

### **System Monitoring**
- Daily revenue calculation success
- Webhook delivery status
- Function performance metrics
- Database query optimization

### **Financial Reconciliation**
- Monthly revenue calculation audits
- Stripe payment verification
- Coach payout accuracy checks
- Tax reporting preparation

### **User Support**
- Coach onboarding assistance
- Technical issue resolution
- Revenue inquiry handling
- Feature request tracking

---

## 📋 **Quick Reference**

### **Key URLs**
- Partner Page: `https://fitwithpulse.ai/partner`
- Coach Onboarding: `https://fitwithpulse.ai/coach/onboarding-success`
- Stripe Webhooks: `https://fitwithpulse.ai/.netlify/functions/stripe-coach-webhook`

### **Environment Variables**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET_COACH=whsec_...
STRIPE_PRICE_COACH_MONTHLY=price_...
STRIPE_PRICE_COACH_ANNUAL=price_...

# Site
SITE_URL=https://fitwithpulse.ai

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### **Important Commands**
```bash
# Create Stripe products
npm run stripe:create-products

# Check environment setup
npm run env-check

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

---

This system creates a sustainable revenue-sharing ecosystem that benefits coaches, athletes, and the Pulse platform while maintaining security, scalability, and user experience standards.
