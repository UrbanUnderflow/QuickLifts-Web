const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');


// Ensure Firebase Admin SDK is initialized only once
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: 'a1032bd2be2a80a8121fb438108cd88ac8ab838f',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCq31Y8rf0xP3O4\nYrwcCYse8W7wE970eveF90n91aunhPHqKquqmA+Vo/wCAxJOkYpGRrHaSc9ww9az\nb/Hg9dPzvNZ7lZy06ekb+EzoEBmWjnd8t9Xcmix6qk2DekxPY3QAgh+V4pgfPK9K\nLvVKSOrCeiuR0URx2NRtu31TsIXis7Hm54Q/zaK0ottc6c4SFFJOnqoZhNiaYx3/\ngKwNI8RM/5nUkXp1peFQyz7nXo8cyMeM9hV1/GyNbxOZ0EB3Y/Igeyn1/UqKg+Hr\nfRJDZz3Ul2b6IUG7y6JDfl06mSAAe8SlIvphghU1yM3LWpo8Kn0o//QTQm6rvXTb\nzo6biz1PAgMBAAECggEAM666qD7eArvU9hPTHs3aKQFQk0gHWz4oSPprhF3Q/inN\nfAztAHve1t2TN06ThnUp9Cik2cgSeOKbOYnmCKuCMMpQu2+cxvGrIt0e8eAQxUOR\nK4V1J7TwOCfzqw1eMHL93rt87zpq1aPmxxLd+VqFu031iLTZtW+mjQw1E4+kZ1WA\n6jgRj1l27fXJT5or2dpi/bPAc3/DBPTQKp0o/CYtIurcrNxob5oKAfXj9+lMJkrN\ndVfDGxT6M/0OIZ1/TyDGIytPRarNiemdCTrhtBSsp8e5hmmt3eo9bYOsnMiP3OBO\nd/2aQrTLQH2v+VH9RoOKL4A6oAzKDnjtV7UXZXNbfQKBgQDgII52TE7nOzHXyzFW\nXNTizL1kspIu9qRWBcVGOgoIIYZ8VC9smHowyvg5DRscZmfOhozxFhNAIfHkTuCV\nMRF5/AfsK5b2uaG/P5A8VFd5QvgiSNEJtYMLp+sVBtY8k7+OdaoPmL0XXBk082OO\n/+Eij9o1MyeFlOJUENqkkiNfmwKBgQDDLAS2RLb6dBeOrjKRyESY05ZtzWJG6Ti5\n0MnZEhbo1XSPx7JLmH9cp71J2cGhK+2isgYUyEKGrJNJW9IGRqMx9WjLUNVdWBqX\npCvE+9/dTq/uQoDYYK86sOv/U1d7aUWbFwfOwxLNfoxaf4oC0KviJkeMSQZKe0LI\ngBF3zMmmXQKBgQCnJ+DYXcUjM8TSuprLXGTx2d0O8xePqyeZeKhO3g6JTeetZmQQ\nTBAlv9stQZcMsVuObk9Dp0EoPajYq/NXkccFAXEvNLtcu8nkhxWdyRGMQOQrPb+Z\nzCQ2V0A+6GBzwYXGS/9ProyolWm/Uh7YkgJo8ny93K8HM6kxJXjL8KotLQKBgFKd\n6Yi2YbZ3Ohmdx65KVi9TMdRdIoLd6rNNnIQU0jnRUbwjTmgNr6wrHUeLtBljnP5H\n2acmdnLHzrk48xjRAff96FRYbVlMGEWkqxqBfGwUCQkUgbIWi1aO2feE8f09vMc/\n4oA1t1nhfcw5PNSgPIJIrfTGXLFeqBBzlfFecOXJAoGAKAIzsXGV1MyfHvdsRZeT\nDXZ6C2TIQP/eNICzxRQJn2+ySNlke6+piZ4lcURU8NnNmAHwTTjBbBaYagqYXqd/\nPV0vMWmEWp+dSLxJmghpS201HrokaZUP+n2Cmj4s3l0odzuWpaOHDqGETofpzEeT\ntjY7ypky6MhGYZJ01HBKV6Q=\n-----END PRIVATE KEY-----\n',
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
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCq31Y8rf0xP3O4\nYrwcCYse8W7wE970eveF90n91aunhPHqKquqmA+Vo/wCAxJOkYpGRrHaSc9ww9az\nb/Hg9dPzvNZ7lZy06ekb+EzoEBmWjnd8t9Xcmix6qk2DekxPY3QAgh+V4pgfPK9K\nLvVKSOrCeiuR0URx2NRtu31TsIXis7Hm54Q/zaK0ottc6c4SFFJOnqoZhNiaYx3/\ngKwNI8RM/5nUkXp1peFQyz7nXo8cyMeM9hV1/GyNbxOZ0EB3Y/Igeyn1/UqKg+Hr\nfRJDZz3Ul2b6IUG7y6JDfl06mSAAe8SlIvphghU1yM3LWpo8Kn0o//QTQm6rvXTb\nzo6biz1PAgMBAAECggEAM666qD7eArvU9hPTHs3aKQFQk0gHWz4oSPprhF3Q/inN\nfAztAHve1t2TN06ThnUp9Cik2cgSeOKbOYnmCKuCMMpQu2+cxvGrIt0e8eAQxUOR\nK4V1J7TwOCfzqw1eMHL93rt87zpq1aPmxxLd+VqFu031iLTZtW+mjQw1E4+kZ1WA\n6jgRj1l27fXJT5or2dpi/bPAc3/DBPTQKp0o/CYtIurcrNxob5oKAfXj9+lMJkrN\ndVfDGxT6M/0OIZ1/TyDGIytPRarNiemdCTrhtBSsp8e5hmmt3eo9bYOsnMiP3OBO\nd/2aQrTLQH2v+VH9RoOKL4A6oAzKDnjtV7UXZXNbfQKBgQDgII52TE7nOzHXyzFW\nXNTizL1kspIu9qRWBcVGOgoIIYZ8VC9smHowyvg5DRscZmfOhozxFhNAIfHkTuCV\nMRF5/AfsK5b2uaG/P5A8VFd5QvgiSNEJtYMLp+sVBtY8k7+OdaoPmL0XXBk082OO\n/+Eij9o1MyeFlOJUENqkkiNfmwKBgQDDLAS2RLb6dBeOrjKRyESY05ZtzWJG6Ti5\n0MnZEhbo1XSPx7JLmH9cp71J2cGhK+2isgYUyEKGrJNJW9IGRqMx9WjLUNVdWBqX\npCvE+9/dTq/uQoDYYK86sOv/U1d7aUWbFwfOwxLNfoxaf4oC0KviJkeMSQZKe0LI\ngBF3zMmmXQKBgQCnJ+DYXcUjM8TSuprLXGTx2d0O8xePqyeZeKhO3g6JTeetZmQQ\nTBAlv9stQZcMsVuObk9Dp0EoPajYq/NXkccFAXEvNLtcu8nkhxWdyRGMQOQrPb+Z\nzCQ2V0A+6GBzwYXGS/9ProyolWm/Uh7YkgJo8ny93K8HM6kxJXjL8KotLQKBgFKd\n6Yi2YbZ3Ohmdx65KVi9TMdRdIoLd6rNNnIQU0jnRUbwjTmgNr6wrHUeLtBljnP5H\n2acmdnLHzrk48xjRAff96FRYbVlMGEWkqxqBfGwUCQkUgbIWi1aO2feE8f09vMc/\n4oA1t1nhfcw5PNSgPIJIrfTGXLFeqBBzlfFecOXJAoGAKAIzsXGV1MyfHvdsRZeT\nDXZ6C2TIQP/eNICzxRQJn2+ySNlke6+piZ4lcURU8NnNmAHwTTjBbBaYagqYXqd/\nPV0vMWmEWp+dSLxJmghpS201HrokaZUP+n2Cmj4s3l0odzuWpaOHDqGETofpzEeT\ntjY7ypky6MhGYZJ01HBKV6Q=\n-----END PRIVATE KEY-----\n',
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

