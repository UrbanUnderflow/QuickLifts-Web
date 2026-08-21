import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('Nora Chat Contract is registered and wired into System Overview', () => {
  const manifest = read('src/content/system-overview/manifest.ts');
  const page = read('src/pages/admin/systemOverview.tsx');

  assert.match(manifest, /id: 'pulsecheck-nora-chat-contract'/);
  assert.match(manifest, /label: 'Nora Chat Contract'/);
  assert.match(manifest, /parentSectionId: 'pulsecheck-runtime-architecture'/);
  assert.match(page, /import PulseCheckNoraChatContractTab/);
  assert.match(page, /case "pulsecheck-nora-chat-contract":/);
  assert.match(page, /return <PulseCheckNoraChatContractTab \/>/);
});

test('Nora Chat Contract UI carries the complete versioned contract structure', () => {
  const contract = read(
    'src/components/admin/system-overview/PulseCheckNoraChatContractTab.tsx'
  );

  assert.match(contract, /NORA_CHAT_CONTRACT_VERSION = '2026\.08\.20'/);
  assert.match(contract, /NORA_CHAT_CONTRACT_SOURCE_SHA256 = '[a-f0-9]{64}'/);

  for (const lane of [
    'critical_safety',
    'clinical_care',
    'coach_handoff',
    'app_support',
    'health_data',
    'closure',
    'performance',
  ]) {
    assert.match(contract, new RegExp(`id: '${lane}'`), `${lane} must remain visible`);
  }

  for (const section of [
    "Nora's Role",
    'Authority And Decision Order',
    'Conversation Lanes',
    'Safety Overlay',
    'Athlete-Led Conversation Rules',
    'Hard Refusals',
    'Privacy And Data Boundaries',
    'Agent And Tool Rules',
    'Evidence And Audit',
    'Red-Team Evaluation Contract',
    'Incident Response And Change Control',
    'Platform Alignment',
    'Open Governance Decisions',
  ]) {
    assert.match(contract, new RegExp(section), `${section} must remain visible`);
  }

  assert.match(contract, /Zero unresolved critical failures\./);
  assert.match(contract, /no full-thread coach access from a\s+generic sharing request/);
});
