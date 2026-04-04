import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const PROJECT_DIR = '/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web';
const LAUNCH_AGENTS_DIR = path.join(require('os').homedir(), 'Library/LaunchAgents');
const OPENCLAW_CONFIG = path.join(require('os').homedir(), '.openclaw/openclaw.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, agentId, displayName, emoji, soul } = req.body;

    if (!agentId || !displayName) {
        return res.status(400).json({ error: 'agentId and displayName are required' });
    }

    try {
        if (action === 'extract-soul') {
            // Step 1: Extract soul from the brainstorm messages
            // This is called with the final messages to extract the soul content
            const { messages } = req.body;
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'messages array is required for soul extraction' });
            }

            // Find the last comprehensive soul proposal in the messages
            const allResponses = messages
                .flatMap((m: any) =>
                    Object.entries(m.responses || {}).map(([agentId, r]: [string, any]) => ({
                        agentId,
                        content: r.content || '',
                        status: r.status,
                    }))
                )
                .filter((r: any) => r.status === 'completed' && r.content.length > 100);

            // Look for structured soul content (## headers)
            const soulCandidates = allResponses
                .filter((r: any) =>
                    r.content.includes('## Who') ||
                    r.content.includes('## My Beliefs') ||
                    r.content.includes('Who I Am') ||
                    (r.content.includes('Identity') && r.content.includes('Beliefs'))
                )
                .sort((a: any, b: any) => b.content.length - a.content.length);

            if (soulCandidates.length === 0) {
                return res.status(200).json({
                    success: false,
                    error: 'No structured soul content found in the conversation yet. Keep brainstorming!',
                });
            }

            // Return the best candidate for the user to review
            const bestCandidate = soulCandidates[0];
            return res.status(200).json({
                success: true,
                soulContent: bestCandidate.content,
                proposedBy: bestCandidate.agentId,
            });
        }

        if (action === 'lock-in') {
            // Step 2: Lock in the soul and create all the infrastructure
            if (!soul || !emoji) {
                return res.status(400).json({ error: 'soul content and emoji are required for lock-in' });
            }

            const results: string[] = [];

            // 2a. Create the soul file
            const soulDir = path.join(PROJECT_DIR, 'docs', 'agents', agentId);
            if (!fs.existsSync(soulDir)) {
                fs.mkdirSync(soulDir, { recursive: true });
            }

            // Format the soul file with standard headers
            let soulContent = soul;
            if (!soulContent.startsWith('# ')) {
                soulContent = `# ${displayName}'s Soul\n\n${soulContent}`;
            }
            // Ensure evolved learnings section exists
            if (!soulContent.includes('## Evolved Learnings')) {
                soulContent = soulContent.trimEnd() + '\n\n## Evolved Learnings\n';
            }

            fs.writeFileSync(path.join(soulDir, 'soul.md'), soulContent, 'utf-8');
            results.push(`✅ Soul file created at docs/agents/${agentId}/soul.md`);

            // 2b. Create OpenClaw workspace
            const openClawWorkspace = path.join(require('os').homedir(), '.openclaw', `workspace-${agentId}`);
            const openClawMemoryDir = path.join(openClawWorkspace, 'memory');
            if (!fs.existsSync(openClawMemoryDir)) {
                fs.mkdirSync(openClawMemoryDir, { recursive: true });
            }
            results.push(`✅ OpenClaw workspace created at ~/.openclaw/workspace-${agentId}`);

            // 2c. Update openclaw.json to add the new agent
            try {
                const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));

                // Check if agent already exists
                const existing = config.agents?.list?.find((a: any) => a.id === agentId);
                if (!existing) {
                    const openClawAgentDir = path.join(require('os').homedir(), '.openclaw', 'agents', agentId, 'agent');
                    if (!fs.existsSync(openClawAgentDir)) {
                        fs.mkdirSync(openClawAgentDir, { recursive: true });
                        // Create minimal auth.json
                        fs.writeFileSync(path.join(openClawAgentDir, 'auth.json'), '{}', 'utf-8');
                    }

                    config.agents.list.push({
                        id: agentId,
                        name: agentId,
                        workspace: openClawWorkspace,
                        agentDir: openClawAgentDir,
                        model: 'openai-codex/gpt-5.4',
                        heartbeat: { every: '30m' },
                    });

                    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2) + '\n', 'utf-8');
                    results.push(`✅ Added ${agentId} to openclaw.json`);
                } else {
                    results.push(`⚠️ ${agentId} already in openclaw.json — skipped`);
                }
            } catch (configErr: any) {
                results.push(`⚠️ Could not update openclaw.json: ${configErr.message}`);
            }

            // 2d. Create the start script
            const startScript = `#!/bin/bash
# Start script for ${displayName} (${agentId})
cd ${PROJECT_DIR}
export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:/Users/noraclawdbot/bin:$PATH
export SUDO_ASKPASS=/Users/noraclawdbot/.openclaw/bin/openclaw-askpass
if [ -f .env.local ]; then set -a; source .env.local; set +a; fi
export USE_OPENCLAW=true AGENT_ID=${agentId} AGENT_NAME=${displayName} AGENT_EMOJI='${emoji}'
exec node scripts/agentRunner.js
`;
            const scriptPath = path.join(PROJECT_DIR, 'scripts', `start-agent-${agentId}.sh`);
            fs.writeFileSync(scriptPath, startScript, 'utf-8');
            fs.chmodSync(scriptPath, '755');
            results.push(`✅ Start script created at scripts/start-agent-${agentId}.sh`);

            // 2e. Create the launchd plist
            const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.quicklifts.agent.${agentId}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd ${PROJECT_DIR}; export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:/Users/noraclawdbot/bin:$PATH; export SUDO_ASKPASS=/Users/noraclawdbot/.openclaw/bin/openclaw-askpass; if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; export USE_OPENCLAW=true AGENT_ID=${agentId} AGENT_NAME=${displayName} AGENT_EMOJI='${emoji}'; exec node scripts/agentRunner.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/quicklifts-agent-${agentId}.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/quicklifts-agent-${agentId}.err.log</string>
</dict>
</plist>
`;
            const plistPath = path.join(LAUNCH_AGENTS_DIR, `com.quicklifts.agent.${agentId}.plist`);
            fs.writeFileSync(plistPath, plistContent, 'utf-8');
            results.push(`✅ LaunchAgent plist created`);

            // 2f. Create a kanban task for Nora to finish the wiring
            // (agentRunner.js personality, VirtualOfficeContent entries, etc.)
            const taskDescription = [
                `Complete the onboarding setup for new agent: ${emoji} ${displayName} (${agentId}).`,
                ``,
                `## Already Done (automated):`,
                results.join('\n'),
                ``,
                `## What You Need To Do:`,
                `Follow the onboarding runbook at ${PROJECT_DIR}/docs/agents/onboarding-runbook.md`,
                ``,
                `Specifically, the following BACKEND items in scripts/agentRunner.js:`,
                `1. Add ${agentId} to OPENCLAW_AGENT_ID mapping`,
                `2. Add personality profile to agentPersonalities/dmPersonalities`,
                `3. Add fallback response block`,
                `4. Add to etiquetteNames and knownAgents`,
                ``,
                `And the following FRONTEND items in src/components/virtualOffice/VirtualOfficeContent.tsx:`,
                `5. Add desk position to DESK_POSITIONS`,
                `6. Add to AGENT_ROLES, AGENT_DUTIES, AGENT_DISPLAY_NAMES, AGENT_EMOJI_DEFAULTS`,
                `7. Add profile config to AGENT_PROFILE_CONFIG`,
                `8. Add fallback presence object`,
                `9. Add to allAgents merge`,
                ``,
                `Then:`,
                `10. Load and start the launchd service: launchctl bootstrap gui/$(id -u) ${plistPath}`,
                `11. Restart existing agents so they pick up the new etiquette names`,
                `12. Verify the agent appears in the Virtual Office`,
                ``,
                `Soul file: docs/agents/${agentId}/soul.md`,
            ].join('\n');

            return res.status(200).json({
                success: true,
                results,
                taskForNora: {
                    name: `Onboard new agent: ${emoji} ${displayName}`,
                    description: taskDescription,
                    assignedTo: 'nora',
                    priority: 'high',
                    complexity: 4,
                },
            });
        }

        if (action === 'delete') {
            // Step 3: Delete an agent — remove infrastructure but preserve soul backup
            const PROTECTED = ['nora', 'antigravity'];
            if (PROTECTED.includes(agentId)) {
                return res.status(403).json({ error: `Cannot delete protected agent: ${agentId}` });
            }

            const results: string[] = [];

            // 3a. Remove the launchd plist
            const plistPath = path.join(LAUNCH_AGENTS_DIR, `com.quicklifts.agent.${agentId}.plist`);
            if (fs.existsSync(plistPath)) {
                // Try to bootout first (in case it's loaded)
                try {
                    const uid = process.getuid?.() ?? 501;
                    await execAsync(`launchctl bootout gui/${uid} "${plistPath}"`);
                } catch (e: any) {
                    // Ignore if already not loaded
                    const msg = e?.stderr || e?.message || '';
                    if (!msg.includes('No such process') && !msg.includes('Could not find')) {
                        console.warn('bootout warning:', msg);
                    }
                }
                fs.unlinkSync(plistPath);
                results.push(`✅ Removed launchd plist`);
            } else {
                results.push(`⚠️ No launchd plist found — skipped`);
            }

            // 3b. Remove from openclaw.json
            try {
                const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
                const before = config.agents?.list?.length || 0;
                config.agents.list = (config.agents.list || []).filter((a: any) => a.id !== agentId);
                const after = config.agents.list.length;

                if (before !== after) {
                    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2) + '\n', 'utf-8');
                    results.push(`✅ Removed ${agentId} from openclaw.json`);
                } else {
                    results.push(`⚠️ ${agentId} not found in openclaw.json — skipped`);
                }
            } catch (configErr: any) {
                results.push(`⚠️ Could not update openclaw.json: ${configErr.message}`);
            }

            // 3c. Remove start script
            const scriptPath = path.join(PROJECT_DIR, 'scripts', `start-agent-${agentId}.sh`);
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
                results.push(`✅ Removed start script`);
            }

            // 3d. Preserve soul file as backup
            const soulPath = path.join(PROJECT_DIR, 'docs', 'agents', agentId, 'soul.md');
            if (fs.existsSync(soulPath)) {
                const backupPath = soulPath + `.bak.${new Date().toISOString().split('T')[0]}`;
                fs.renameSync(soulPath, backupPath);
                results.push(`📦 Soul file preserved as ${path.basename(backupPath)}`);
            }

            // 3e. Clean up log files
            const outLog = `/tmp/quicklifts-agent-${agentId}.out.log`;
            const errLog = `/tmp/quicklifts-agent-${agentId}.err.log`;
            [outLog, errLog].forEach(logPath => {
                if (fs.existsSync(logPath)) {
                    fs.unlinkSync(logPath);
                }
            });
            results.push(`✅ Cleaned up log files`);

            // 3f. Remove OpenClaw workspace (but keep a note)
            const openClawWorkspace = path.join(require('os').homedir(), '.openclaw', `workspace-${agentId}`);
            if (fs.existsSync(openClawWorkspace)) {
                // Don't fully remove — just add a tombstone
                fs.writeFileSync(
                    path.join(openClawWorkspace, 'REMOVED.md'),
                    `# Agent Removed\n\nAgent \`${agentId}\` (${displayName}) was removed on ${new Date().toISOString()}\n`,
                    'utf-8'
                );
                results.push(`✅ Marked OpenClaw workspace as removed`);
            }

            return res.status(200).json({ success: true, results });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
        console.error('Onboard error:', err);
        return res.status(500).json({ error: err.message });
    }
}
