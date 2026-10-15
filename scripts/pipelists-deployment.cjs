const fs = require('node:fs');
const path = require('node:path');

const OUTPUT = path.join(__dirname, '../src/generated/pipelists-deployment.json');
const PRODUCTION_URLS = new Set(['https://fitwithpulse.ai', 'https://www.fitwithpulse.ai']);

// CONTEXT/NETLIFY are trusted Netlify build metadata, not function-runtime vars.
// Capture only non-secret site identity. The ignored output is bundled into both
// Next.js and scheduled functions after the build command has completed.
function deploymentForBuild(env) {
  const production = env.NETLIFY === 'true' && env.CONTEXT === 'production'
    && (env.NODE_ENV === undefined || env.NODE_ENV === 'production')
    && env.NETLIFY_LOCAL !== 'true' && env.NETLIFY_PREVIEW_SERVER !== 'true'
    && PRODUCTION_URLS.has(env.URL)
    && typeof env.SITE_ID === 'string' && env.SITE_ID.trim().length > 0
    && typeof env.SITE_NAME === 'string' && env.SITE_NAME.trim().length > 0;
  return production
    ? { production: true, siteId: env.SITE_ID, siteName: env.SITE_NAME, url: env.URL }
    : { production: false, siteId: '', siteName: '', url: '' };
}

function writePipeListsDeployment(env = process.env) {
  const deployment = deploymentForBuild(env);
  const contents = `${JSON.stringify(deployment, null, 2)}\n`;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== contents) fs.writeFileSync(OUTPUT, contents);
  return deployment;
}

module.exports = { deploymentForBuild, writePipeListsDeployment };
if (require.main === module) writePipeListsDeployment();
