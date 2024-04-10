const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');


// Ensure Firebase Admin SDK is initialized only once
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: "e3c94fe778b8c225bc80c50fd7a18360e436f4a8",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDW9YFh6oOF0TuU\nwwRLj+6Ta9YR9UypyjfkRS9n10kHAmq6WYMxSPmK0xPaQ/RjJHgYV0k4uLdq3eJg\nD5pmfrHFUkfpmFLUh3YIYJ7n5xEIF5kJhWz7VqEMw1Ki80rjRkDkvJ0KTAiBy1Xi\nG7+SXJUWpARWs4P6P+Xp9OFb5/wJuagfecuSDB4K6dKYqZgoLz6rFvaqiVdKVBGW\nxGzL7mEQJ3nMbHFEfE4CLKB+4fOhgBK4+xoKnSX+HKTX8u6GumZDESrnYgFoYu9k\nR2RBCzliqYB8CHy/OuEZbWbwB3NA9W4cTRjkdx0k/eW0Rp5r7KHej1a0b9nqytQj\nhh4JNEExAgMBAAECggEAFneI+xSxg/BDN7BtV792qlJcSLq4dUuVLWbcxk/uSk0C\nnjECYQmVSWD343l0RtN2OOcQmFzYENOZmDwxQVKvHmZT7VKWH6/70nLU0Pyp30xm\nGqRnKFrc0NJuZekjU99RI4ciK8QYJIa91njbfD7wdzIT4QL4wZRhoaMOVdaIlXRw\n2B0nT45R6P/u70Z6Kn9pkBAiXhAg0cxQtcTsh60EVMRjfajDu4hk9CWVgm3+PAba\n5i/imSmI6EN6UaMHrI4RIBch6npaJkEL8ThP1Qn4z/6MeuXhVggHhy+IrZItsyWV\nV7UTjYbN/hHepRQg3UX8AgCmcxRj35TgEAMlh9VbcQKBgQDr6LJR0+9MMvIG3RHw\nI/uQ4eVTxzPVb+iDsWs6QzI0rNPxImIkZBIJwSB/cOxrVnifh9o8l7EBie0akqhU\n6KTicm11D2P64Acx206KLdp3U+QBAro9TZeRyUnAToY+iUGF4QnoEtz6c+E8D/wj\nMipBzsN7Q7rtLNfgELGKPG9T2QKBgQDpRA5nd+uGcJIAelT+SPdm+4T7aNBnzBUS\nR4rpbXW7siX+aHVqyt1NmvUjdIyz3FM36m9UY4KbJC6yNZ5q4O1XQn958sd28G/D\n6n0zAtZk57sGYqJp8OZwoggq7fn8xDZcNa2aNWK6eIiPx/j4utzfOdhXflEVN/u7\nF6JpNp/5GQKBgAIhh/rVP0Qg8a6+MHtK1+rnH3syQXWcHS2TXLSaBsoTBZcYCGrr\nvH36EKEWFAykK1LFl2MUu7SX2lxzFrItp8+j2PlFulF51JbOtFbrMx4A0/5uV+BV\n4xieCNyD2RKXis/6yGwgP37DrTUtr8lhmqAdjgZ/BiE+VnTfsbrd8OOBAoGBALd6\ndY4DMHntv5mqn4HoKNmTCzWpawvJ5eUb6vLSy2FYrjPfPEREzy+ErD84JJgwvDBm\nMS2CnC+llSlNrY7J30Xco2JriWNPmcnTfqkKGVMDRwOtv6xu9QMxIBWMXC7qswty\nmVuLlF2yA1B87aPPb34SBM5FKEf1Ygb2fyQc+FW5AoGASMvItXETzlkb7lvAb6vA\nN7/QnLHdv4D18AM4Tvu+Y2oF6Fi0krkD+VfB99cNQot0ByXAPJJtHYFxQJ7f68Rj\ndO+hNmDr0geFRkn4MHXJdDhK4cpmgY5XjwLGuuigh4eylg8905z1s9ycyQxHgwfw\nNtSpEEPTMCa83rQguT2Y6RQ=\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

const auth = new GoogleAuth({
  credentials: {
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDW9YFh6oOF0TuU\nwwRLj+6Ta9YR9UypyjfkRS9n10kHAmq6WYMxSPmK0xPaQ/RjJHgYV0k4uLdq3eJg\nD5pmfrHFUkfpmFLUh3YIYJ7n5xEIF5kJhWz7VqEMw1Ki80rjRkDkvJ0KTAiBy1Xi\nG7+SXJUWpARWs4P6P+Xp9OFb5/wJuagfecuSDB4K6dKYqZgoLz6rFvaqiVdKVBGW\nxGzL7mEQJ3nMbHFEfE4CLKB+4fOhgBK4+xoKnSX+HKTX8u6GumZDESrnYgFoYu9k\nR2RBCzliqYB8CHy/OuEZbWbwB3NA9W4cTRjkdx0k/eW0Rp5r7KHej1a0b9nqytQj\nhh4JNEExAgMBAAECggEAFneI+xSxg/BDN7BtV792qlJcSLq4dUuVLWbcxk/uSk0C\nnjECYQmVSWD343l0RtN2OOcQmFzYENOZmDwxQVKvHmZT7VKWH6/70nLU0Pyp30xm\nGqRnKFrc0NJuZekjU99RI4ciK8QYJIa91njbfD7wdzIT4QL4wZRhoaMOVdaIlXRw\n2B0nT45R6P/u70Z6Kn9pkBAiXhAg0cxQtcTsh60EVMRjfajDu4hk9CWVgm3+PAba\n5i/imSmI6EN6UaMHrI4RIBch6npaJkEL8ThP1Qn4z/6MeuXhVggHhy+IrZItsyWV\nV7UTjYbN/hHepRQg3UX8AgCmcxRj35TgEAMlh9VbcQKBgQDr6LJR0+9MMvIG3RHw\nI/uQ4eVTxzPVb+iDsWs6QzI0rNPxImIkZBIJwSB/cOxrVnifh9o8l7EBie0akqhU\n6KTicm11D2P64Acx206KLdp3U+QBAro9TZeRyUnAToY+iUGF4QnoEtz6c+E8D/wj\nMipBzsN7Q7rtLNfgELGKPG9T2QKBgQDpRA5nd+uGcJIAelT+SPdm+4T7aNBnzBUS\nR4rpbXW7siX+aHVqyt1NmvUjdIyz3FM36m9UY4KbJC6yNZ5q4O1XQn958sd28G/D\n6n0zAtZk57sGYqJp8OZwoggq7fn8xDZcNa2aNWK6eIiPx/j4utzfOdhXflEVN/u7\nF6JpNp/5GQKBgAIhh/rVP0Qg8a6+MHtK1+rnH3syQXWcHS2TXLSaBsoTBZcYCGrr\nvH36EKEWFAykK1LFl2MUu7SX2lxzFrItp8+j2PlFulF51JbOtFbrMx4A0/5uV+BV\n4xieCNyD2RKXis/6yGwgP37DrTUtr8lhmqAdjgZ/BiE+VnTfsbrd8OOBAoGBALd6\ndY4DMHntv5mqn4HoKNmTCzWpawvJ5eUb6vLSy2FYrjPfPEREzy+ErD84JJgwvDBm\nMS2CnC+llSlNrY7J30Xco2JriWNPmcnTfqkKGVMDRwOtv6xu9QMxIBWMXC7qswty\nmVuLlF2yA1B87aPPb34SBM5FKEf1Ygb2fyQc+FW5AoGASMvItXETzlkb7lvAb6vA\nN7/QnLHdv4D18AM4Tvu+Y2oF6Fi0krkD+VfB99cNQot0ByXAPJJtHYFxQJ7f68Rj\ndO+hNmDr0geFRkn4MHXJdDhK4cpmgY5XjwLGuuigh4eylg8905z1s9ycyQxHgwfw\nNtSpEEPTMCa83rQguT2Y6RQ=\n-----END PRIVATE KEY-----\n",
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// Define the Cloud Function handler
async function sendWorkoutNotification(fcmToken) {
  const messaging = admin.messaging();

  // Get an access token
  const accessToken = await auth.getAccessToken();

  const payload = {
    notification: {
      title: 'You have a new workout!',
      body: 'A new workout has been sent to you.',
    },
  };

  try {
    const response = await messaging.sendToDevice(fcmToken, payload, {
      accessToken: accessToken.token,
    });
    console.log('Successfully sent notification:', response);
    return { success: true, message: 'Notification sent successfully.' };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// Cloud Function to handle HTTP request
exports.handler = async (event, context) => {
  try {
    const fcmToken = event.queryStringParameters.fcmToken;
    if (!fcmToken) {
      return {
        statusCode: 400,
        body: 'Missing FCM token.'
      };
    }

    const result = await sendWorkoutNotification(fcmToken);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message })
    };
  }
};

