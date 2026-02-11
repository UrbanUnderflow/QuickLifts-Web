#!/usr/bin/env node

/**
 * Send a message to an agent from the command line.
 *
 * Usage:
 *   node scripts/sendToAgent.js <agentId> <message>
 *   node scripts/sendToAgent.js nora "Please work on the login page redesign"
 *   node scripts/sendToAgent.js nora "What's your current status?" --type question
 *   node scripts/sendToAgent.js nora "Stop current task" --type command
 *
 * This calls the /api/agent/message endpoint which writes to Firestore.
 * The agent runner on the Mac Mini picks it up in real-time.
 */

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log(`
Usage: node scripts/sendToAgent.js <agentId> <message> [options]

Options:
  --type <type>     Message type: task | question | command | chat (default: command)
  --from <sender>   Who is sending (default: antigravity)
  --host <url>      API host (default: http://localhost:3001)

Examples:
  node scripts/sendToAgent.js nora "Work on the login page redesign next"
  node scripts/sendToAgent.js nora "What's your current status?" --type question
  node scripts/sendToAgent.js nora "Prioritize fixing the crash in ProfileScreen" --type task
  `);
    process.exit(1);
}

const agentId = args[0];
const message = args[1];

// Parse options
let type = 'command';
let from = 'antigravity';
let host = process.env.API_HOST || 'http://localhost:3001';

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) { type = args[++i]; }
    if (args[i] === '--from' && args[i + 1]) { from = args[++i]; }
    if (args[i] === '--host' && args[i + 1]) { host = args[++i]; }
}

async function send() {
    console.log(`\n📨 Sending to ${agentId}...`);
    console.log(`   Type: ${type}`);
    console.log(`   From: ${from}`);
    console.log(`   Message: "${message}"\n`);

    try {
        const response = await fetch(`${host}/api/agent/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: agentId, type, content: message }),
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Message sent! ID: ${data.messageId}`);
            console.log(`   ${data.message}`);
        } else {
            console.error(`❌ Failed: ${data.error}`);
        }
    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        console.log(`\nMake sure the dev server is running at ${host}`);
    }
}

send();
