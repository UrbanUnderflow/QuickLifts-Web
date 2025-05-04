const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Ensure Firebase Admin is initialized (likely done in index.js)
const db = admin.firestore();
const messaging = admin.messaging();

const usersCollection = "users"; // Assuming your users collection is named 'users'
const chatsCollection = "chats";
const messagesSubCollection = "messages";

/**
 * Sends a notification when a new direct message is sent in a chat.
 *
 * Triggered when a new document is created in 'chats/{chatId}/messages/{messageId}'.
 */
exports.sendDirectMessageNotification = onDocumentCreated(`${chatsCollection}/{chatId}/${messagesSubCollection}/{messageId}`, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log(`No data associated with the DM event for message ${event.params.messageId}. Exiting.`);
        return null;
    }
    const messageData = snap.data();
    const chatId = event.params.chatId;
    const messageId = event.params.messageId;

    if (!messageData) {
        console.log(`No data found for new message ${messageId} in chat ${chatId}. Exiting.`);
        return null;
    }

    const senderId = messageData.senderId;
    const messageContent = messageData.content || (messageData.workout ? "Shared a workout" : (messageData.request ? "Sent a request" : "Sent a message"));
    // --- Directly get recipient tokens from the message data --- 
    const recipientTokens = messageData.recipientFcmTokens; 

    if (!senderId || !messageContent) {
        console.error(`Missing senderId or content in message ${messageId} of chat ${chatId}. Cannot send notification.`);
        return null;
    }

    // --- Check if there are tokens to send to --- 
    if (!Array.isArray(recipientTokens) || recipientTokens.length === 0) {
        console.log(`No recipient FCM tokens found in message ${messageId} or the array is empty. No notification sent.`);
        return null;
    }

    console.log(`New message ${messageId} from ${senderId} in chat ${chatId}. Preparing notification for ${recipientTokens.length} tokens.`);

    // --- Get Sender Username (Still needed for the title) ---
    let senderUsername = "Someone";
    try {
        const senderDoc = await db.collection(usersCollection).doc(senderId).get();
        if (senderDoc.exists) {
            senderUsername = senderDoc.data()?.username || senderUsername;
        } else {
            console.warn(`Sender user document ${senderId} not found.`);
        }
    } catch (error) {
        console.error(`Error fetching sender username for ${senderId}:`, error);
    }

    // --- Construct Notification Payload ---
    const notificationPayload = {
        title: `New Message from ${senderUsername}`,
        body: messageContent, // Using the message content directly
    };
    const dataPayload = {
        chatId: chatId,
        senderId: senderId,
        messageId: messageId,
        senderUsername: senderUsername,
        type: 'DIRECT_MESSAGE',
        timestamp: String(Math.floor(Date.now() / 1000))
    };

    const message = {
        tokens: recipientTokens, // Use the tokens directly from the message
        notification: notificationPayload,
        data: dataPayload,
        apns: { 
            headers: { 'apns-priority': '10' }, 
            payload: { aps: { sound: 'default', badge: 1 } } 
        },
        android: { 
            priority: 'high',
            notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' }
        }
    };

    // --- Send Notifications ---
    console.log(`Sending direct message notification to ${recipientTokens.length} tokens for chat ${chatId}.`);
    try {
        const response = await messaging.sendMulticast(message);
        console.log(`Successfully sent DM notifications: ${response.successCount} of ${recipientTokens.length}`);

        if (response.failureCount > 0) {
            console.warn(`Failed to send DM notification to ${response.failureCount} devices.`);
             response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`Error sending DM to token #${idx}: ${resp.error.message}`);
                if (resp.error.code === 'messaging/registration-token-not-registered') {
                  console.log(`Token is invalid and should be removed: ${recipientTokens[idx].substring(0, 10)}...`);
                }
              }
            });
        }
    } catch (error) {
        console.error("Error sending DM FCM messages:", error);
    }

    return null; // Indicate completion
}); 