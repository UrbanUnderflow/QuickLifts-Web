// add-admin.js
// Function to add an admin user to the admin collection

const { db, headers } = require('./config/firebase');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { email, adminKey } = JSON.parse(event.body);

    if (!email || !adminKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing email or adminKey' 
        })
      };
    }

    // Simple admin key check (you can change this)
    const expectedAdminKey = process.env.ADMIN_KEY || 'pulse-admin-2024';
    if (adminKey !== expectedAdminKey) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid admin key' 
        })
      };
    }

    // Create admin document
    await db.collection('admin').doc(email.toLowerCase()).set({
      email: email.toLowerCase(),
      createdAt: new Date(),
      addedBy: 'admin-function',
      permissions: ['all']
    });

    console.log(`[AddAdmin] Added admin: ${email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully added ${email} as admin`
      })
    };

  } catch (error) {
    console.error('[AddAdmin] Error:', error);
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
