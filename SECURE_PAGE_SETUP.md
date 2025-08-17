# Secure Page Access Logging & Email Notifications Setup

## Overview
The secure page (`/secure`) now includes comprehensive access logging with:
- **Firestore storage** for all access attempts
- **Email notifications** to `tremaine.grant@gmail.com`
- **IP address & geolocation tracking**
- **Local storage backup** for immediate access

## Features Implemented

### 🔒 Access Logging
- **Page visits**: Every time someone loads `/secure`
- **Failed attempts**: Wrong password entries
- **Successful access**: Correct password entries
- **Lockouts**: When max attempts reached

### 📊 Data Collected
- **Timestamp**: When the access occurred
- **IP Address**: User's public IP (via ipify.org)
- **Location**: City/country (via geolocation API + reverse geocoding)
- **User Agent**: Browser and device information
- **Attempt count**: For failed attempts

### 🗄️ Storage
- **Firestore**: `secureAccessLogs` collection (admin-only access)
- **localStorage**: Local backup for immediate viewing
- **Security rules**: Only server functions can write, only admins can read

## Email Notification Setup

### ✅ Brevo Integration (Already Configured!)
The secure page access logging uses your existing **Brevo** email service setup, matching the pattern used throughout your admin functions. No additional setup required!

**Uses these existing environment variables:**
- `BREVO_MARKETING_KEY` - Your Brevo API key
- `BREVO_SENDER_EMAIL` - Sender email (defaults to "tre@fitwithpulse.ai")  
- `BREVO_SENDER_NAME` - Sender name (defaults to "Pulse Security")

**Email notifications are sent to:** `tremaine.grant@gmail.com`

## Environment Variables Required

Your existing Netlify environment variables are sufficient:

```bash
# Existing (already configured)
NEXT_PUBLIC_SECURE_PASSWORD=your_secure_password
NEXT_PUBLIC_SECURE=your_ssn_value
FIREBASE_SERVICE_ACCOUNT_KEY=your_firebase_service_account_json
FIREBASE_DATABASE_URL=your_firebase_database_url

# Brevo (already configured for your admin functions)
BREVO_MARKETING_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=tre@fitwithpulse.ai
BREVO_SENDER_NAME=Pulse Team
```

## Viewing Access Logs

### Method 1: Hidden Admin Panel
1. Go to `/secure`
2. Type `LOGS` (anywhere on the page)
3. View all access attempts with full details

### Method 2: Firestore Console
1. Go to Firebase Console
2. Navigate to Firestore Database
3. View `secureAccessLogs` collection
4. **Note**: Requires admin privileges

### Method 3: Browser Console
All access attempts are logged to the browser console with the prefix `🔒`

## Email Notification Format

When someone accesses the secure page, you'll receive an email with:

- **Access type** (Page Visit, Failed Attempt, Successful Access, Lockout)
- **Timestamp** (when it occurred)
- **IP Address** (user's public IP)
- **Location** (city, country if available)
- **User Agent** (browser/device info)
- **Attempt count** (for failed attempts)

## Security Features

### Rate Limiting
- **3 failed attempts** → 5-minute lockout
- **Lockout timer** displayed to user
- **Automatic unlock** after timeout

### Data Protection
- **Admin-only Firestore access**
- **Server-side logging only**
- **No client-side log manipulation**
- **Encrypted environment variables**

## Testing

1. Visit `/secure` → Should log "page_visit"
2. Enter wrong password → Should log "failed_attempt" 
3. Enter correct password → Should log "successful_access"
4. Fail 3 times → Should log "lockout"
5. Type `LOGS` → Should show admin panel

## Troubleshooting

### No emails received?
1. Check Netlify function logs
2. Verify environment variables are set
3. Check spam folder
4. Ensure email service API key is valid

### Firestore not storing logs?
1. Check Firebase service account permissions
2. Verify Firestore rules are deployed
3. Check Netlify function logs for errors

### Geolocation not working?
- User must grant location permission
- Falls back to IP-based location if denied
- Some browsers block geolocation on HTTP (use HTTPS)

## Next Steps

1. **Deploy** the updated code to Netlify
2. **Set up** your preferred email service
3. **Add environment variables** to Netlify
4. **Test** the logging functionality
5. **Monitor** access attempts via email notifications

The system is now ready to track and notify you of any access to the secure page!
