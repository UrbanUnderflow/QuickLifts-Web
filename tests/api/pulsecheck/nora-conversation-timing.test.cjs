const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildConversationTimingSection } = require(path.join(__dirname, '../../../netlify/functions/utils/noraConversationTiming.js'));

const NOW = Date.parse('2026-11-12T14:20:00Z'); // 9:20 AM in New York

test('a chat reopened the same morning continues instead of greeting again', () => {
  const section = buildConversationTimingSection({
    timeZone: 'America/New_York', now: NOW,
    recentMessages: [{ content: 'Good morning', timestamp: (NOW - 50 * 60000) / 1000 }, { content: 'hi', timestamp: (NOW - 47 * 60000) / 1000 }],
  });
  assert.match(section, /It is now 9:20 AM/);
  assert.match(section, /47 minutes ago \(8:33 AM today\)/);
  assert.match(section, /do not greet them again/);
  assert.doesNotMatch(section, /Some time has passed/);
});

test('hours later the same day Nora picks up where things were', () => {
  const section = buildConversationTimingSection({ timeZone: 'America/New_York', now: NOW, recentMessages: [{ timestamp: NOW - 5 * 3600000 }] });
  assert.match(section, /about 5 hours ago/);
  assert.match(section, /Some time has passed/);
});

test('a new day allows a short greeting', () => {
  const section = buildConversationTimingSection({ timeZone: 'America/New_York', now: NOW, recentMessages: [{ timestamp: (NOW - 13 * 3600000) / 1000 }] });
  assert.match(section, /on 2026-11-11/);
  assert.match(section, /new day/);
});

test('no times or no time zone adds nothing', () => {
  assert.equal(buildConversationTimingSection({ timeZone: 'America/New_York', recentMessages: [{ content: 'x' }] }), '');
  assert.equal(buildConversationTimingSection({ recentMessages: [{ timestamp: NOW }] }), '');
  assert.equal(buildConversationTimingSection({ timeZone: 'Bad/Zone', now: NOW, recentMessages: [{ timestamp: NOW }] }), '');
});
