// check-admin.js
// Function to check if a user is an admin

const { db, headers } = require('./config/firebase');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const email = event.queryStringParameters?.email;

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing email parameter' 
        })
      };
    }

    // Check if admin document exists
    const adminDoc = await db.collection('admin').doc(email.toLowerCase()).get();
    const isAdmin = adminDoc.exists;

    console.log(`[CheckAdmin] ${email}: ${isAdmin ? 'IS' : 'IS NOT'} admin`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email: email,
        isAdmin: isAdmin,
        adminData: isAdmin ? adminDoc.data() : null
      })
    };

  } catch (error) {
    console.error('[CheckAdmin] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
