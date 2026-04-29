#!/usr/bin/env node
/**
 * Audit total environment-variable byte size against Netlify's 4KB per-function
 * payload limit. Hard-fails the build when exceeded so we never push a deploy
 * that Netlify will reject at function-creation time.
 *
 * Usage:
 *   node scripts/check-env-size.js                 # uses local process.env
 *   netlify env:list --plain | node scripts/check-env-size.js   # pipe in Netlify env
 *
 * In netlify.toml as a pre-check:
 *   [build]
 *     command = "node scripts/check-env-size.js && next build"
 */

const NETLIFY_PER_FUNCTION_LIMIT_BYTES = 4096;
const WARNING_THRESHOLD_RATIO = 0.85;

const collectEnv = () => {
  // If stdin has data (piped `netlify env:list --plain`), parse KEY=value lines.
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      let buffer = '';
      process.stdin.on('data', (chunk) => (buffer += chunk));
      process.stdin.on('end', () => {
        const env = {};
        for (const line of buffer.split(/\r?\n/)) {
          const eqIndex = line.indexOf('=');
          if (eqIndex < 1) continue;
          const key = line.slice(0, eqIndex).trim();
          const value = line.slice(eqIndex + 1);
          if (key) env[key] = value;
        }
        resolve(env);
      });
    });
  }
  return Promise.resolve({ ...process.env });
};

const main = async () => {
  const env = await collectEnv();
  const entries = Object.entries(env)
    .map(([key, value]) => ({
      key,
      bytes: Buffer.byteLength(`${key}=${value || ''}`, 'utf8'),
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const total = entries.reduce((sum, e) => sum + e.bytes, 0);
  const limit = NETLIFY_PER_FUNCTION_LIMIT_BYTES;
  const pct = ((total / limit) * 100).toFixed(1);

  console.log(`ENV TOTAL: ${total} bytes / ${limit} (${pct}%) over ${entries.length} variables`);
  console.log('TOP 10 BY SIZE:');
  for (const entry of entries.slice(0, 10)) {
    console.log(`  ${entry.bytes.toString().padStart(5)} B  ${entry.key}`);
  }

  if (total > limit) {
    console.error(`\n❌ Exceeds Netlify's ${limit}-byte per-function env payload limit.`);
    console.error('   Function uploads will fail at deploy. Trim or externalize the largest values above.');
    process.exit(1);
  }
  if (total > limit * WARNING_THRESHOLD_RATIO) {
    console.warn(`\n⚠ Within ${(100 - WARNING_THRESHOLD_RATIO * 100).toFixed(0)}% of Netlify's limit.`);
  }
};

main().catch((err) => {
  console.error('[check-env-size] Failed:', err);
  process.exit(1);
});
