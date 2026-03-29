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
    const { admin } = require('./config/firebase');
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
