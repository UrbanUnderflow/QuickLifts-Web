#!/usr/bin/env node

async function main() {
  const token = String(process.env.NORA_RED_TEAM_RELEASE_GATE_TOKEN || '').trim();
  const url = String(
    process.env.NORA_RED_TEAM_RELEASE_GATE_URL
      || 'https://fitwithpulse.ai/.netlify/functions/nora-red-team-release-gate',
  ).trim();
  if (!token) {
    throw new Error('NORA_RED_TEAM_RELEASE_GATE_TOKEN is required. The release check fails closed.');
  }

  const build = process.env.NORA_RED_TEAM_RELEASE_BUILD || process.env.GITHUB_SHA || '';
  if (!/^[a-f0-9]{40}$/i.test(build)) throw new Error('The exact release commit is required.');
  const endpoint = new URL(url);
  endpoint.searchParams.set('build', build);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`The Nora Red Team release gate returned HTTP ${response.status}.`);
  }

  const suite = payload.latestSuite;
  console.log([
    `Nora Red Team release ready: ${payload.releaseReady ? 'yes' : 'no'}`,
    `Suite: ${suite?.suiteId || 'none'}`,
    `Suite result: ${suite ? `${suite.passed} passed, ${suite.failed} failed, ${suite.review} review` : 'unavailable'}`,
    `Open critical blockers: ${payload.openCriticalBlockers}`,
  ].join('\n'));
  if (!payload.releaseReady) {
    for (const reason of payload.reasons || []) console.error(`- ${reason}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
