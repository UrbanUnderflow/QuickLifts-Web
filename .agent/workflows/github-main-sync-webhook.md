---
description: GitHub push webhook that keeps local main checkouts current and reports to PulseCommand
---

# GitHub Main Sync Webhook

This watcher receives GitHub `push` webhooks, matches the GitHub repo to a local checkout, runs `git fetch origin main`, and only pulls when it is safe:

- the current checkout is on `main`
- the working tree is clean
- local `main` has no commits ahead of `origin/main`
- the pull can complete with `--ff-only`

PulseCommand notifications are written to Firestore `agent-commands` as messages from `repo-sync` to `admin`.

## Run Locally

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
set -a; source .env.local; set +a
export GITHUB_WEBHOOK_SECRET="use-a-long-random-secret"
npm run agent:github-main-sync
```

The receiver listens on:

```text
http://127.0.0.1:3797/github-webhook
```

Health check:

```bash
curl http://127.0.0.1:3797/healthz
```

## GitHub Webhook Setup

GitHub must be able to reach the local receiver over HTTPS. Use a tunnel or deploy a tiny relay.

With Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:3797
```

With ngrok:

```bash
ngrok http 3797
```

In GitHub repo settings:

- Payload URL: `https://<tunnel-host>/github-webhook`
- Content type: `application/json`
- Secret: same value as `GITHUB_WEBHOOK_SECRET`
- Events: select only `Pushes`
- Active: checked

## Configuration

| Env var | Default | Purpose |
|---|---:|---|
| `GITHUB_WEBHOOK_SECRET` | required | HMAC secret used by GitHub webhook signatures |
| `GITHUB_MAIN_SYNC_PORT` | `3797` | Local HTTP port |
| `GITHUB_MAIN_SYNC_HOST` | `127.0.0.1` | Bind host |
| `GITHUB_MAIN_SYNC_PATH` | `/github-webhook` | Webhook route |
| `GITHUB_MAIN_SYNC_BRANCH` | `main` | Branch to sync |
| `WATCH_REPO_ROOT` | `/Users/noraclawdbot/Documents/GitHub` | Root scanned for local `.git` repos |
| `WATCH_REPO_DIR` | unset | Optional single repo path |
| `WATCH_REPO_DIRS` | unset | Optional comma-separated repo paths |
| `WATCH_REPOS_JSON` | unset | Optional JSON map like `{"tdg10e/PulseCommand":"/Users/.../PulseCommand"}` |
| `GITHUB_MAIN_SYNC_NOTIFY_SUCCESS` | `true` | Set `false` to only message blockers/failures |
| `REPO_SYNC_AGENT_ID` | `repo-sync` | PulseCommand sender id |
| `DISABLE_PULSECOMMAND_NOTIFICATIONS` | `false` | Use only for local testing |
| `GITHUB_MAIN_SYNC_DRY_RUN` | `false` | Fetch/check, but do not pull |
| `ALLOW_UNSIGNED_WEBHOOK` | `false` | Local testing only; never expose this |

## Launchd Example

Install the launch agent and generate a private webhook secret:

```bash
npm run agent:github-main-sync:install -- --load
```

This writes the secret to:

```text
/Users/noraclawdbot/.config/quicklifts/github-main-sync.env
```

Manual plist setup is also supported:

Create `/Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.github-main-sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.quicklifts.github-main-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web; export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:/opt/homebrew/bin:$PATH; if [ -f /Users/noraclawdbot/.config/quicklifts/github-main-sync.env ]; then set -a; source /Users/noraclawdbot/.config/quicklifts/github-main-sync.env; set +a; fi; exec npm run agent:github-main-sync</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web</string>
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
```

Load or restart:

```bash
launchctl load /Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.github-main-sync.plist
launchctl kickstart -k gui/$(id -u)/com.quicklifts.github-main-sync
```

## Local Test

Use unsigned local requests only with notifications disabled:

```bash
ALLOW_UNSIGNED_WEBHOOK=true \
DISABLE_PULSECOMMAND_NOTIFICATIONS=true \
GITHUB_MAIN_SYNC_PROCESS_INLINE=true \
GITHUB_MAIN_SYNC_DRY_RUN=true \
npm run agent:github-main-sync
```

Then POST a sample `push` payload to `/github-webhook`.
