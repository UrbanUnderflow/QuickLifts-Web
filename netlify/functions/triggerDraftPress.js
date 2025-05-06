// Simple trigger function for manual press release generation
const { admin, db, headers } = require('./config/firebase');

// Function to trigger the press release generation
exports.handler = async (event, context) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    console.log("Manually triggering press release generation...");
    
    // Import and call the draft press function directly
    // Note: Using require here to prevent the schedule helper from being bundled with this function
    const draftPressModule = require('./draftPress');
    
    // Execute the handler function from the draftPress module
    await draftPressModule.handler(event, context);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Press release generation initiated successfully"
      })
    };
  } catch (error) {
    console.error("Error triggering press release generation:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred during press release generation"
      })
    };
  }
}; 