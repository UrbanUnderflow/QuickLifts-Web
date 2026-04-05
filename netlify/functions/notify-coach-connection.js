/**
 * Legacy endpoint retired.
 * Coach-athlete connectivity now comes from PulseCheck team memberships and invite redemption.
 */

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      body: '',
    };
  }

  return {
    statusCode: 410,
    body: JSON.stringify({
      success: false,
      retired: true,
      message: 'Legacy coach connection notifications have been retired. Use PulseCheck team invites and membership events instead.',
    }),
  };
};
