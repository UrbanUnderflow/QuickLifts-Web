# Pulse Check Waitlist System

This document outlines the complete waitlist system for Pulse Check, including Firestore redundancy.

## Overview

The Pulse Check waitlist system provides dual redundancy by saving user signups to both:
1. **Brevo** (primary email marketing platform)
2. **Firestore** (backup database with detailed tracking)

## Architecture

### Components

1. **Frontend Form**: `src/components/PulseCheckWaitlistForm.tsx`
2. **API Endpoint**: `src/pages/api/brevo/pulse-check-waitlist.ts`
3. **Firestore Service**: `src/lib/firestore-waitlist.ts`
4. **Brevo Helper**: `src/lib/brevoSubscribeHelper.ts` (updated)
5. **Admin Stats**: `src/pages/api/admin/waitlist-stats.ts`

### Data Flow

```
User Submits Form
       ↓
1. Check if email exists in Firestore
       ↓
2. Save to Firestore (with pending status)
       ↓
3. Sync to Brevo waitlist
       ↓
4. Send welcome email
       ↓
5. Update Firestore with sync/email status
```

## Firestore Collection: `pulse-check-waitlist`

### Document Structure

```typescript
{
  id: string,                    // Auto-generated document ID
  email: string,                 // User email (lowercase, trimmed)
  name?: string,                 // Optional user name
  userType: 'athlete' | 'coach', // User type selection
  source: string,                // Traffic source (default: 'pulse-check-landing')
  utmCampaign?: string,          // UTM campaign tracking
  createdAt: Timestamp,          // When user joined waitlist
  brevoSyncStatus: 'pending' | 'success' | 'failed',
  brevoSyncError?: string,       // Error message if Brevo sync failed
  brevoSyncedAt?: Timestamp,     // When Brevo sync completed
  emailSentStatus: 'pending' | 'success' | 'failed',
  emailSentError?: string,       // Error message if email failed
  emailSentAt?: Timestamp        // When welcome email was sent
}
```

### Firestore Security Rules

Add these rules to your Firestore security rules:

```javascript
// Allow read/write access to pulse-check-waitlist for authenticated admin users
match /pulse-check-waitlist/{document} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

## Brevo Configuration

### List Setup

1. Create a new list in Brevo called "Pulse Check Waitlist"
2. Note the List ID (should be 7, update in `src/lib/brevoSubscribeHelper.ts` if different)
3. Update the `LIST_MAP` in the helper file:

```typescript
const LIST_MAP: Record<string, number | undefined> = {
  generic: 5,
  mobility: 6,
  'pulse-check-waitlist': 7, // ← Your new list ID
};
```

### Contact Attributes

The system automatically adds these attributes to Brevo contacts:

- `FIRSTNAME`: User's name
- `USER_TYPE`: 'athlete' or 'coach'
- `WAITLIST_DATE`: ISO timestamp of signup
- `SOURCE`: Traffic source

## API Endpoints

### 1. Join Waitlist: `POST /api/brevo/pulse-check-waitlist`

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "userType": "athlete"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully joined the waitlist!",
  "details": {
    "firestoreId": "doc_id_123",
    "brevoSynced": true,
    "emailSent": true
  }
}
```

**Response (Error):**
```json
{
  "error": "This email is already on the waitlist!"
}
```

### 2. Admin Stats: `GET /api/admin/waitlist-stats`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "athletes": 120,
    "coaches": 30,
    "brevoSynced": 148,
    "emailsSent": 145
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Environment Variables

Add to your `.env.local`:

```bash
# Existing Brevo configuration
BREVO_MARKETING_KEY=your_brevo_api_key

# Admin API token for stats endpoint
ADMIN_API_TOKEN=your_secure_admin_token
```

## Error Handling & Resilience

### Graceful Degradation

The system is designed to continue working even if components fail:

1. **Firestore fails**: Continue with Brevo sync and email
2. **Brevo fails**: Data is still saved to Firestore for manual export
3. **Email fails**: User is still added to both systems
4. **Duplicate emails**: Firestore check prevents duplicates

### Monitoring

Check the following for system health:

1. **Firestore Console**: Monitor document creation
2. **Brevo Dashboard**: Check list growth and contact attributes
3. **Server Logs**: Look for `[Waitlist]` prefixed log messages
4. **Admin Stats Endpoint**: Regular health checks

## Usage Examples

### Frontend Integration

```typescript
// Open waitlist form for athletes
setWaitlistUserType('athlete');
setShowWaitlistForm(true);

// Open waitlist form for coaches
setWaitlistUserType('coach');
setShowWaitlistForm(true);
```

### Admin Monitoring

```bash
# Get waitlist statistics
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://your-domain.com/api/admin/waitlist-stats
```

## Welcome Email

The system automatically sends a welcome email that includes:

- Welcome message with Pulse Check branding
- Explanation of what Pulse Check is
- Key features overview
- Link to existing Pulse app
- Timeline expectations

## Backup & Export

### Firestore Export

Use Firebase CLI to export waitlist data:

```bash
firebase firestore:export gs://your-bucket/waitlist-backup
```

### Brevo Export

Export contacts from Brevo dashboard:
1. Go to Contacts → Lists
2. Select "Pulse Check Waitlist"
3. Export → CSV

## Troubleshooting

### Common Issues

1. **Build errors**: Ensure Firebase config is properly set up
2. **Brevo sync fails**: Check API key and list ID
3. **Email delivery issues**: Verify sender email domain
4. **Duplicate prevention**: Firestore rules and email normalization

### Debug Mode

Enable detailed logging by checking server console for `[Waitlist]` messages.

## Future Enhancements

- [ ] Email sequence automation
- [ ] Waitlist position tracking
- [ ] Referral system integration
- [ ] A/B testing for welcome emails
- [ ] Advanced analytics dashboard 