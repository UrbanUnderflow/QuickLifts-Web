// netlify/functions/social-preview.js
const sharp = require('sharp');
const fetch = require('node-fetch');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

async function generatePreviewImage(profileImageUrl) {
  try {
    // Fetch the profile image
    const imageResponse = await fetch(profileImageUrl);
    const imageBuffer = await imageResponse.buffer();

    // Create a new image with specific dimensions for social media
    const image = await sharp(imageBuffer)
      .resize(1200, 630, { // Standard social media image size
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return image;
  } catch (error) {
    console.error('Error generating preview image:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { username } = event.queryStringParameters;
    if (!username) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Username is required' })
      };
    }

    // Fetch user data to get profile image URL
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
          "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
        })
      });
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userData = snapshot.docs[0].data();
    const profileImageUrl = userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png';

    const previewImage = await generatePreviewImage(profileImageUrl);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000'
      },
      body: previewImage.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Failed to generate preview image' })
    };
  }
};