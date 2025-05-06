// Simple trigger function for manual KPI snapshot generation
const { admin, db, headers } = require('./config/firebase');

// Function to trigger the KPI snapshot generation
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
    console.log("Manually triggering KPI snapshot generation...");
    
    // Import and call the generateKpiSnapshot function directly
    // Note: Using require here to prevent the schedule helper from being bundled with this function
    const kpiSnapshotModule = require('./generateKpiSnapshot');
    
    // Execute the handler function from the generateKpiSnapshot module
    await kpiSnapshotModule.handler(event, context);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "KPI snapshot generation initiated successfully"
      })
    };
  } catch (error) {
    console.error("Error triggering KPI snapshot generation:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred during KPI snapshot generation"
      })
    };
  }
}; 