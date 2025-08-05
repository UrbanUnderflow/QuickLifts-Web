const { db, headers } = require('./config/firebase');
const { findUserByUsername, normalizeUsername, isValidUsernameFormat } = require('./utils/username-lookup');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
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
    const testUsername = event.queryStringParameters?.username || 'A.B.CSociety';
    
    console.log(`Testing username lookup for: "${testUsername}"`);
    
    // Test the utility function
    const result = await findUserByUsername(db, testUsername);
    
    // Test normalization
    const normalized = normalizeUsername(testUsername);
    const isValid = isValidUsernameFormat(testUsername);
    
    // Test various case combinations
    const testCases = [
      testUsername,
      testUsername.toLowerCase(),
      testUsername.toUpperCase(),
      testUsername.charAt(0).toUpperCase() + testUsername.slice(1).toLowerCase()
    ];
    
    const testResults = [];
    for (const testCase of testCases) {
      try {
        const testResult = await findUserByUsername(db, testCase);
        testResults.push({
          input: testCase,
          found: !!testResult,
          userId: testResult?.id || null,
          actualUsername: testResult?.data?.username || null
        });
      } catch (error) {
        testResults.push({
          input: testCase,
          found: false,
          error: error.message
        });
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        originalInput: testUsername,
        normalized: normalized,
        isValidFormat: isValid,
        mainResult: {
          found: !!result,
          userId: result?.id || null,
          actualUsername: result?.data?.username || null,
          displayName: result?.data?.displayName || null
        },
        caseTestResults: testResults,
        message: result ? 
          `✅ Found user: ${result.data.username} (${result.data.displayName})` : 
          `❌ No user found for: ${testUsername}`
      })
    };

  } catch (error) {
    console.error('[TestUsernameLookup] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: 'Check server logs for full error details'
      })
    };
  }
}; 