#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const getAgentName = () => {
  const candidates = [
    'AGENT_NAME',
    'VIRTUALOFFICE_AGENT',
    'QUICKLIFTS_AGENT',
    'GIT_AUTHOR_NAME',
    'GIT_COMMITTER_NAME',
    'USER',
    'USERNAME',
  ];

  for (const key of candidates) {
    const raw = process.env[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }

  return '';
};

const run = (command, args, env) =>
  spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

const installHookPath = run('git', ['config', 'core.hooksPath', '.githooks'], process.env);
if (installHookPath.status !== 0) {
  process.exit(installHookPath.status ?? 1);
}

const agentName = getAgentName();
const commitEnv = {
  ...process.env,
  AGENT_NAME: agentName || process.env.AGENT_NAME || '',
};

const result = run('git', ['commit', ...process.argv.slice(2)], commitEnv);
if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
