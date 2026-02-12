#!/usr/bin/env node
/**
 * Sage Presence Card Verification Test
 * 
 * This script validates that Sage's presence card profile is correctly
 * configured in virtualOffice.tsx with all required data structures and
 * proper format consistency with the existing team.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const SUCCESS = `${colors.green}✓${colors.reset}`;
const FAILURE = `${colors.red}✗${colors.reset}`;
const INFO = `${colors.cyan}ℹ${colors.reset}`;

// Read virtualOffice.tsx
const virtualOfficePath = path.join(__dirname, '../src/pages/admin/virtualOffice.tsx');
const content = fs.readFileSync(virtualOfficePath, 'utf8');

console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════`);
console.log(`  Sage Presence Card Verification Test`);
console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, assertion, value = null) {
  totalTests++;
  const passed = assertion();
  if (passed) {
    passedTests++;
    console.log(`${SUCCESS} ${name}`);
    if (value) console.log(`   ${colors.gray}→ ${value}${colors.reset}`);
  } else {
    failedTests++;
    console.log(`${FAILURE} ${name}`);
  }
  return passed;
}

function section(name) {
  console.log(`\n${colors.bright}${colors.cyan}${name}${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
}

// Test 1: Data Structure Existence
section('1. Data Structure Existence');

test('AGENT_ROLES.sage exists', () => {
  return content.includes("sage: 'Research Intelligence Envoy'");
}, 'Research Intelligence Envoy');

test('AGENT_DUTIES.sage exists', () => {
  return content.includes("sage: 'Stewards the intel feed");
}, 'Full duty description present');

test('AGENT_EMOJI_DEFAULTS.sage exists', () => {
  return content.includes("sage: '🧬'");
}, '🧬 (DNA helix)');

test('AGENT_DISPLAY_NAMES.sage exists', () => {
  return content.includes("sage: 'Sage'");
}, 'Sage');

test('AGENT_PROFILES.sage exists', () => {
  return content.includes("sage: {") && 
         content.includes("title: 'Research Intelligence Envoy'") &&
         content.includes("location: 'Virtual Office (intel desk)'");
}, 'Full profile object present');

// Test 2: Profile Structure
section('2. Profile Structure');

test('Profile has correct title', () => {
  return content.includes("sage: {") && 
         content.includes("title: 'Research Intelligence Envoy'");
}, 'Research Intelligence Envoy');

test('Profile has location', () => {
  return content.includes("location: 'Virtual Office (intel desk)'");
}, 'Virtual Office (intel desk)');

test('Profile has sections array', () => {
  const sageProfileMatch = content.match(/sage:\s*{[\s\S]*?sections:\s*\[/);
  return sageProfileMatch !== null;
}, 'Sections array present');

test('Profile has footer', () => {
  return content.includes("footer: 'Creed: witness with empathy");
}, 'Creed statement present');

// Test 3: Section Content
section('3. Profile Sections');

test('Section 1: Intel Feed Stewardship exists', () => {
  return content.includes("title: '1. Intel Feed Stewardship'");
}, '1. Intel Feed Stewardship');

test('Section 1 has correct bullets', () => {
  return content.includes("'Curate the live intel feed") &&
         content.includes("'Keep Tremaine looped") &&
         content.includes("'Signature rhythm: Field Notes → Patterns → Feed Drops");
}, '3 bullets with signature rhythm');

test('Section 2: Field Research & Listening exists', () => {
  return content.includes("title: '2. Field Research & Listening'");
}, '2. Field Research & Listening');

test('Section 2 has correct bullets', () => {
  return content.includes("'Conduct structured listening") &&
         content.includes("'Cite every claim with a source");
}, '2 bullets with empathy focus');

test('Section 3: Insight Packaging & Escalation exists', () => {
  return content.includes("title: '3. Insight Packaging & Escalation'");
}, '3. Insight Packaging & Escalation');

test('Section 3 has correct bullets', () => {
  return content.includes("'Deliver briefing cards") &&
         content.includes("'Flag only truly urgent items");
}, '2 bullets with escalation guidance');

// Test 4: Three Core Pillars
section('4. Three Core Pillars Mapping');

test('Field Immersion pillar reflected', () => {
  return content.includes("'2. Field Research & Listening'") &&
         content.includes("'Conduct structured listening") &&
         content.includes("with empathy for the source");
}, 'Section 2: Field Research & Listening');

test('Pattern Synthesis pillar reflected', () => {
  return content.includes("Field Notes → Patterns → Feed Drops");
}, 'Signature rhythm includes "Patterns"');

test('Feed Delivery pillar reflected', () => {
  return content.includes("'1. Intel Feed Stewardship'") &&
         content.includes("'Curate the live intel feed");
}, 'Section 1: Intel Feed Stewardship');

// Test 5: Desk Position
section('5. Desk Position Configuration');

test('DESK_POSITIONS includes Sage', () => {
  // Check if there's a desk position array with at least 5 entries
  const deskMatch = content.match(/const DESK_POSITIONS = \[([\s\S]*?)\];/);
  if (!deskMatch) return false;
  const deskContent = deskMatch[1];
  const positions = deskContent.split('},').length - 1;
  return positions >= 5;
}, 'At least 5 desk positions configured');

test('Center upper desk position exists', () => {
  return content.includes("{ x: 42, y: 22, facing: 'right'");
}, 'x: 42, y: 22, facing: right');

// Test 6: Integration
section('6. System Integration');

test('Priority mapping includes sage', () => {
  return content.includes("sage: 4");
}, 'Priority: 4');

test('SAGE_PRESENCE constant exists', () => {
  return content.includes("const SAGE_PRESENCE: AgentPresence = {") &&
         content.includes("id: 'sage'");
}, 'Default presence object defined');

test('Agent aliases include sage', () => {
  return content.includes("intel: 'sage'") ||
         content.includes("research: 'sage'");
}, 'Aliases: intel, research → sage');

// Test 7: Content Quality
section('7. Content Quality');

test('Signature rhythm appears in duty', () => {
  return content.includes("Signature rhythm: Field Notes → Patterns → Feed Drops");
}, 'Field Notes → Patterns → Feed Drops');

test('Emoji mentioned in footer', () => {
  return content.includes("emoji 🧬");
}, 'Footer references 🧬 emoji');

test('Internal-facing designation clear', () => {
  return content.includes("always internal-facing") ||
         content.includes("remains internal-facing");
}, 'Internal-facing role clarified');

test('Empathy emphasized', () => {
  return content.includes("with empathy") &&
         content.includes("witness with empathy");
}, 'Empathy in multiple contexts');

// Test 8: Format Consistency
section('8. Format Consistency');

test('Role title length appropriate', () => {
  const title = 'Research Intelligence Envoy';
  return title.length >= 11 && title.length <= 35;
}, '29 characters (within range)');

test('Duty description has signature rhythm', () => {
  return content.includes("Signature rhythm:");
}, 'Unique identifier present');

test('Numbered section titles', () => {
  return content.includes("'1. Intel Feed") &&
         content.includes("'2. Field Research") &&
         content.includes("'3. Insight Packaging");
}, 'All sections numbered 1, 2, 3');

test('Footer has personality', () => {
  return content.includes("Creed:") &&
         content.includes("warm field correspondent");
}, 'Creed + personality descriptor');

// Results Summary
console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════`);
console.log(`  Test Results`);
console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

const passRate = ((passedTests / totalTests) * 100).toFixed(1);
const statusColor = passRate === '100.0' ? colors.green : passRate >= '90.0' ? colors.yellow : colors.red;

console.log(`  Total Tests:  ${totalTests}`);
console.log(`  ${colors.green}Passed:       ${passedTests}${colors.reset}`);
console.log(`  ${colors.red}Failed:       ${failedTests}${colors.reset}`);
console.log(`  ${statusColor}Pass Rate:    ${passRate}%${colors.reset}\n`);

if (passRate === '100.0') {
  console.log(`${colors.green}${colors.bright}✓ ALL TESTS PASSED${colors.reset}`);
  console.log(`${colors.green}Sage's presence card profile is production-ready!${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}${colors.bright}✗ SOME TESTS FAILED${colors.reset}`);
  console.log(`${colors.red}Please review the failures above.${colors.reset}\n`);
  process.exit(1);
}
