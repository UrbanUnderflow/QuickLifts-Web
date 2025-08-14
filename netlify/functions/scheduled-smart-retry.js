const { schedule } = require('@netlify/functions');

// Import the smart retry function
const { handler: smartRetryHandler } = require('./smart-retry-prize-distribution');

// Schedule to run daily at 2 PM UTC (9 AM EST / 6 AM PST)
exports.handler = schedule('0 14 * * *', async (event, context) => {
  console.log('[ScheduledSmartRetry] Daily smart retry triggered at:', new Date().toISOString());
  
  try {
    // Call the smart retry function
    const result = await smartRetryHandler(
      { httpMethod: 'GET', queryStringParameters: {} },
      context
    );
    
    const resultData = JSON.parse(result.body);
    
    if (resultData.success) {
      console.log('[ScheduledSmartRetry] ✅ Smart retry completed successfully');
      console.log('[ScheduledSmartRetry] Summary:', resultData.summary);
    } else {
      console.error('[ScheduledSmartRetry] ❌ Smart retry failed:', resultData.error);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Scheduled smart retry completed',
        timestamp: new Date().toISOString(),
        result: resultData
      })
    };
    
  } catch (error) {
    console.error('[ScheduledSmartRetry] Error executing scheduled retry:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
});
