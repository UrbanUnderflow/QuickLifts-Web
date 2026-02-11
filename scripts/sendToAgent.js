#!/usr/bin/env node

/**
 * Send a message to an agent via Firestore Client SDK.
 *
 * Usage:
 *   node scripts/sendToAgent.js <agentId> <message>
 *   node scripts/sendToAgent.js nora "Please work on the login page redesign"
 *   node scripts/sendToAgent.js nora "What's your current status?" --type question
 *
 * Uses the Firebase client SDK directly (no server needed).
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyBmf38HJ65h5GuGGzNtPA6Qy2FRZIrSX7c",
    authDomain: "quicklifts-dd3f1.firebaseapp.com",
    projectId: "quicklifts-dd3f1",
    storageBucket: "quicklifts-dd3f1.appspot.com",
    messagingSenderId: "691046627244",
    appId: "1:691046627244:web:877d908f23c34840a9ec09",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log(`
Usage: node scripts/sendToAgent.js <agentId> <message> [options]

Options:
  --type <type>     Message type: task | question | command | chat (default: command)
  --from <sender>   Who is sending (default: antigravity)

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

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) { type = args[++i]; }
    if (args[i] === '--from' && args[i + 1]) { from = args[++i]; }
}

async function send() {
    console.log(`\n📨 Sending to ${agentId}...`);
    console.log(`   Type: ${type}`);
    console.log(`   From: ${from}`);
    console.log(`   Message: "${message}"\n`);

    try {
        const docRef = await addDoc(collection(db, 'agent-commands'), {
            from,
            to: agentId,
            type,
            content: message,
            metadata: {},
            status: 'pending',
            createdAt: serverTimestamp(),
        });

        console.log(`✅ Message sent! ID: ${docRef.id}`);
        console.log(`   Nora's agent runner should pick this up in real-time.`);
        process.exit(0);
    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    }
}

send();
