// Provider-neutral clinical status webhook receiver.
//
// AuntEdna is the current provider, so this route delegates to the existing
// AuntEdna-compatible callback handler. Keep `auntedna-callback` live for
// backwards compatibility with any callback URL already shared externally.

const { handler } = require('./auntedna-callback');

exports.handler = handler;
