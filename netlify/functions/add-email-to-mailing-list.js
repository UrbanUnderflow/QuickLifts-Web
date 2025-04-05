// Import necessary modules
const { db } = require('./config/firebase');

async function addEmailToMailingList(email) {
  const emailRef = db.collection("mailingList").doc();
  await emailRef.set({ email });
}

// Handler function for Netlify
exports.handler = async (event) => {
  try {
    const email = event.queryStringParameters.email; // Get email from query string
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: "Missing email parameter" }) };
    }

    await addEmailToMailingList(email); // Add email to Firestore

    // Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Email added to mailing list successfully." })
    };
  } catch (error) {
    console.error(error); // Logging the error for debugging purposes
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
