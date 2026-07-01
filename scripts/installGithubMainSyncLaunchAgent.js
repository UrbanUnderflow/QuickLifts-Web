#!/usr/bin/env node
'use strict';

/**
 * Install the GitHub main sync webhook as a macOS launchd service.
 *
 * This writes:
 *   - ~/.config/quicklifts/github-main-sync.env (0600)
 *   - ~/Library/LaunchAgents/com.quicklifts.github-main-sync.plist
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LABEL = 'com.quicklifts.github-main-sync';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const DEFAULT_ENV_FILE = path.join(HOME, '.config', 'quicklifts', 'github-main-sync.env');
const DEFAULT_PLIST = path.join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`);
const DEFAULT_REPO_ROOT = path.resolve(PROJECT_ROOT, '..');

function parseArgs(argv) {
    const opts = {
        envFile: DEFAULT_ENV_FILE,
        plist: DEFAULT_PLIST,
        host: '127.0.0.1',
        port: '3797',
        repoRoot: DEFAULT_REPO_ROOT,
        load: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--load') opts.load = true;
        else if (arg === '--no-load') opts.load = false;
        else if (arg === '--secret') opts.secret = argv[++i];
        else if (arg === '--env-file') opts.envFile = argv[++i];
        else if (arg === '--plist') opts.plist = argv[++i];
        else if (arg === '--host') opts.host = argv[++i];
        else if (arg === '--port') opts.port = argv[++i];
        else if (arg === '--repo-root') opts.repoRoot = argv[++i];
        else if (arg === '--help' || arg === '-h') opts.help = true;
        else throw new Error(`Unknown option: ${arg}`);
    }

    opts.secret = opts.secret || process.env.GITHUB_WEBHOOK_SECRET || readExistingSecret(opts.envFile) || crypto.randomBytes(32).toString('hex');
    return opts;
}

function usage() {
    console.log(`
Usage:
  node scripts/installGithubMainSyncLaunchAgent.js [options]

Options:
  --load             Load/restart the launchd service after writing files
  --secret <value>   Use an existing GitHub webhook secret; otherwise one is generated
  --port <port>      Local webhook port (default: 3797)
  --host <host>      Local bind host (default: 127.0.0.1)
  --repo-root <dir>  Local repo discovery root (default: ${DEFAULT_REPO_ROOT})
  --env-file <path>  Private env file path (default: ${DEFAULT_ENV_FILE})
  --plist <path>     LaunchAgent plist path (default: ${DEFAULT_PLIST})
`);
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function readExistingSecret(envFile) {
    if (!envFile || !fs.existsSync(envFile)) return '';
    const match = fs.readFileSync(envFile, 'utf8').match(/^GITHUB_WEBHOOK_SECRET=(.+)$/m);
    if (!match) return '';

    let value = match[1].trim();
    if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
    ) {
        value = value.slice(1, -1);
    }

    return value.replace(/'\\''/g, "'").trim();
}

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function writeEnvFile(opts) {
    fs.mkdirSync(path.dirname(opts.envFile), { recursive: true, mode: 0o700 });
    const body = [
        '# Private config for com.quicklifts.github-main-sync.',
        '# Keep this file out of git.',
        `GITHUB_WEBHOOK_SECRET=${shellQuote(opts.secret)}`,
        `GITHUB_MAIN_SYNC_HOST=${shellQuote(opts.host)}`,
        `GITHUB_MAIN_SYNC_PORT=${shellQuote(opts.port)}`,
        "GITHUB_MAIN_SYNC_BRANCH='main'",
        `WATCH_REPO_ROOT=${shellQuote(path.resolve(opts.repoRoot))}`,
        "REPO_SYNC_AGENT_ID='repo-sync'",
        "REPO_SYNC_AGENT_NAME='Repo Sync'",
        "GITHUB_MAIN_SYNC_NOTIFY_SUCCESS='true'",
        '',
    ].join('\n');

    fs.writeFileSync(opts.envFile, body, { mode: 0o600 });
    fs.chmodSync(opts.envFile, 0o600);
}

function nodeBinDir() {
    return path.dirname(process.execPath || path.join(HOME, '.local', 'node-v22-current', 'bin', 'node'));
}

function writePlist(opts) {
    fs.mkdirSync(path.dirname(opts.plist), { recursive: true });
    const envFile = path.resolve(opts.envFile);
    const command = [
        `cd ${shellQuote(PROJECT_ROOT)}`,
        `export PATH=${shellQuote(`${nodeBinDir()}:${path.join(HOME, '.local', 'node-v22-current', 'bin')}:${path.join(HOME, '.local', 'node-v22.22.0-darwin-arm64', 'bin')}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}`,
        `if [ -f ${shellQuote(envFile)} ]; then set -a; source ${shellQuote(envFile)}; set +a; fi`,
        'exec npm run agent:github-main-sync',
    ].join('; ');

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>${xmlEscape(command)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(PROJECT_ROOT)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/quicklifts-github-main-sync.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/quicklifts-github-main-sync.err.log</string>
</dict>
</plist>
`;

    fs.writeFileSync(opts.plist, plist, { mode: 0o644 });
}

function runLaunchctl(args, allowFailure = false) {
    const result = spawnSync('launchctl', args, { encoding: 'utf8' });
    if (result.status !== 0 && !allowFailure) {
        throw new Error(`launchctl ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
    return result;
}

function loadService(plistPath) {
    const target = `gui/${process.getuid()}`;
    runLaunchctl(['bootout', target, plistPath], true);
    runLaunchctl(['bootstrap', target, plistPath]);
    runLaunchctl(['kickstart', '-k', `${target}/${LABEL}`], true);
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        usage();
        return;
    }

    writeEnvFile(opts);
    writePlist(opts);

    console.log(`Installed env: ${opts.envFile}`);
    console.log(`Installed plist: ${opts.plist}`);
    console.log('GitHub webhook secret was written to the private env file.');

    if (opts.load) {
        loadService(opts.plist);
        console.log(`Loaded launchd service: ${LABEL}`);
    } else {
        console.log(`To load: launchctl bootstrap gui/$(id -u) ${opts.plist}`);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
