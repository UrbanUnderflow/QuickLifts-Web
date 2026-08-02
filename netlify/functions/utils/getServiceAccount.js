// CommonJS bridge for legacy `.js` Netlify functions.
// Netlify's dependency scanner uses Node-style extension resolution for those
// entry points, so it needs a `.js` target before esbuild can compile the
// canonical TypeScript implementation.
module.exports = require('./getServiceAccount.ts');
