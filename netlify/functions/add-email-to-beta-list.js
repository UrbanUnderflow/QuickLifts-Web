// Import necessary modules
const { admin } = require('./config/firebase');

const db = admin.firestore();

async function addPartnerToBeta(email) {
    console.log(`Adding partner to beta with email: ${email}`);
    const partnerRef = db.collection('beta').doc(email);
    await partnerRef.set({
      'email': email,
      'isApproved': true 
    });
    console.log('Partner added to beta successfully');
  }
  
  // Handler function for Netlify
  exports.handler = async (event) => {
    try {
      console.log('Received event:', event);
      const email = event.queryStringParameters.email;
      console.log(`Extracted email: ${email}`);
      if (!email) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, message: 'Missing email parameter' }),
        };
      }
      await addPartnerToBeta(email);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Partner added to beta successfully.' }),
      };
    } catch (error) {
      console.error('Error adding partner to beta:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: error.message }),
      };
    }
  };
