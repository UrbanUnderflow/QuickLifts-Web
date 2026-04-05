/**
 * Legacy endpoint retired.
 * Partner creation now happens through PulseCheck organization provisioning and admin activation.
 */

const { headers } = require('./config/firebase');

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  return {
    statusCode: 410,
    headers,
    body: JSON.stringify({
      success: false,
      retired: true,
      message: 'Legacy partner profile creation has been retired. Provision coach-led organizations through the PulseCheck admin activation flow.',
      redirectPath: '/PulseCheck/coach',
    }),
  };
};

module.exports = { handler };
