# Notification Logging System

## Overview

This system provides comprehensive logging for all Firebase Cloud Function notifications sent from your app. It stores notification payloads, success/failure status, and metadata in a Firebase collection for debugging and monitoring purposes.

## Components

### 1. Core Logging Module (`notificationLogger.js`)

The main logging utility that provides:

- **`logNotification()`**: Logs individual notification attempts
- **`sendNotificationWithLogging()`**: Enhanced notification sender with built-in logging
- **`logMulticastNotification()`**: Logs multicast notification attempts

### 2. Firebase Collection

**Collection Name**: `notification-logs`

**Document Structure**:
```json
{
  "fcmToken": "truncated_token...",
  "title": "Notification Title",
  "body": "Notification Body",
  "dataPayload": { /* custom data object */ },
  "notificationType": "CALLOUT_ANSWERED",
  "functionName": "challengeNotifications",
  "success": true,
  "messageId": "firebase_message_id",
  "error": null,
  "additionalContext": { /* extra debugging info */ },
  "timestamp": "Firestore Timestamp",
  "timestampEpoch": 1703123456,
  "multicast": false,
  "version": "1.0"
}
```

**For Multicast Notifications**:
```json
{
  "notificationType": "NEW_PARTICIPANT",
  "functionName": "sendNewUserJoinedChallengeNotification",
  "multicast": true,
  "title": "New Challenger! 🤺",
  "body": "John just joined Challenge!",
  "dataPayload": { /* custom data */ },
  "totalTokens": 5,
  "successCount": 4,
  "failureCount": 1,
  "results": {
    "successful": 4,
    "failed": 1,
    "failureReasons": [
      {
        "errorCode": "messaging/registration-token-not-registered",
        "errorMessage": "Token not registered"
      }
    ]
  },
  "timestamp": "Firestore Timestamp",
  "timestampEpoch": 1703123456
}
```

### 3. Admin Dashboard (`NotificationLogs.tsx`)

A React admin page located at `/admin/notification-logs` that provides:

- **Real-time log viewing**: Latest 100 notification logs
- **Detailed inspection**: Click any log to see full payload details
- **Status indicators**: Visual badges for success/failure/partial success
- **Filtering by type**: Easy identification of notification categories
- **Error details**: Full error information for failed notifications

## Notification Types

The system tracks various notification types:

- `CALLOUT_ANSWERED`: When someone responds to a callout
- `CHECKIN_CALLOUT`: Initial callout notifications
- `NEW_PARTICIPANT`: New user joined challenge
- `CHALLENGE_COMPLETED`: Challenge completion notifications
- `WORKOUT_STARTED`: Workout start notifications
- `DIRECT_MESSAGE`: Direct message notifications
- `SINGLE_NOTIFICATION`: Manual/admin notifications
- `CHALLENGE_PUBLISHED`: Challenge status changes
- `CHALLENGE_STARTED`: Challenge activation

## Integration

### Updated Functions

The following functions now include logging:

1. **`challengeNotifications.js`**:
   - `sendCheckinCalloutNotification`
   - `sendNewUserJoinedChallengeNotification`
   - `onChallengeStatusChange`
   - `sendWorkoutStartNotification`
   - `onMainChallengeStatusChange`

2. **`directMessageNotifications.js`**:
   - `sendDirectMessageNotification`

3. **`sendSingleNotification.js`**:
   - `sendSingleNotification`

### Usage Example

```javascript
// Replace old sendNotification calls:
// await sendNotification(fcmToken, title, body, data);

// With logged version:
await sendNotification(fcmToken, title, body, data, 'NOTIFICATION_TYPE');

// For multicast, add logging after sending:
const response = await messaging.sendEachForMulticast(message);
await logMulticastNotification({
  tokens: eligibleTokens,
  title,
  body,
  dataPayload,
  notificationType: 'NOTIFICATION_TYPE',
  functionName: 'yourFunctionName',
  response
});
```

## Benefits

### For Debugging

1. **Payload Inspection**: See exact notification content sent
2. **Error Analysis**: Detailed error codes and messages
3. **Token Validation**: Identify invalid/expired FCM tokens
4. **Success Rates**: Monitor multicast notification performance

### For Monitoring

1. **Delivery Tracking**: Confirm notifications are being sent
2. **Performance Metrics**: Success/failure rates over time
3. **Type Analysis**: See which notification types are most/least successful
4. **Volume Monitoring**: Track notification frequency

### For Compliance

1. **Audit Trail**: Complete record of all notifications sent
2. **Data Verification**: Confirm correct data is being transmitted
3. **User Privacy**: FCM tokens are truncated for privacy

## Privacy Considerations

- FCM tokens are truncated to 20 characters + "..." for privacy
- Full tokens are never stored in logs
- No user personal data is logged beyond what's in notification content

## Performance

- Logging is non-blocking and won't affect notification delivery
- Failed logging attempts don't break the main notification flow
- Logs are stored efficiently with indexed timestamps for quick retrieval

## Maintenance

### Log Cleanup

Consider implementing log cleanup for storage management:

```javascript
// Example: Delete logs older than 30 days
const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
const oldLogs = await db.collection('notification-logs')
  .where('timestampEpoch', '<', thirtyDaysAgo)
  .get();
  
// Delete old logs...
```

### Monitoring Setup

1. Set up alerts for high failure rates
2. Monitor log collection size
3. Create analytics dashboards from log data

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check function deployment and imports
2. **Partial logging**: Verify all notification functions are updated
3. **Performance impact**: Logging should be minimal, check for network issues

### Debug Steps

1. Check console logs for logging errors
2. Verify Firebase permissions for writing to collection
3. Test with a single notification first
4. Check the admin dashboard for recent logs

## Future Enhancements

- Real-time dashboard updates
- Analytics and charts
- Automated alerting for failures
- Advanced filtering and search
- Export functionality for logs 