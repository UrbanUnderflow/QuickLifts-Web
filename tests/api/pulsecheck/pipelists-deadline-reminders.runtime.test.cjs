const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('PipeLists deadline reminders include due-today and overdue deadlines', () => {
  const reminderFunction = read('netlify/functions/pipelists-deadline-reminders.ts');
  const netlifyConfig = read('netlify.toml');

  assert.match(
    reminderFunction,
    /const UPCOMING_REMINDER_DAYS = new Set\(\[7, 2, 1\]\)/,
    'future reminder windows should remain one week, two days, and one day before deadline',
  );
  assert.match(
    reminderFunction,
    /const MAX_OVERDUE_REMINDER_DAYS = 30/,
    'overdue reminders should be capped so stale old rows do not email forever',
  );
  assert.match(
    reminderFunction,
    /UPCOMING_REMINDER_DAYS\.has\(daysUntil\) \|\| \(daysUntil <= 0 && daysUntil >= -MAX_OVERDUE_REMINDER_DAYS\)/,
    'deadline reminders should send for due-today and overdue items, not only future dates',
  );
  assert.match(
    reminderFunction,
    /if \(daysUntil === 0\) return [`'"]Due today:/,
    'subjects should call out due-today reminders',
  );
  assert.match(
    reminderFunction,
    /return `Overdue by \$\{daysOverdue\}/,
    'subjects should call out overdue reminders',
  );
  assert.match(
    reminderFunction,
    /return `overdue by \$\{daysOverdue\}/,
    'email body copy should explain how far overdue the item is',
  );
  assert.match(
    netlifyConfig,
    /\[functions\."pipelists-deadline-reminders"\][\s\S]*schedule = "0 14 \* \* \*"/,
    'the PipeLists deadline reminder function should remain scheduled daily',
  );
});

test('PipeLists deadline reminders read from the SimpBudget Firebase project', () => {
  const reminderFunction = read('netlify/functions/pipelists-deadline-reminders.ts');
  const simpBudgetAdmin = read('netlify/functions/utils/getSimpBudgetServiceAccount.ts');

  assert.match(
    reminderFunction,
    /import \{ getSimpBudgetAuth, getSimpBudgetFirestore \} from '\.\/utils\/getSimpBudgetServiceAccount'/,
    'the scheduled reminder should use the same Firebase project as the PipeLists browser app',
  );
  assert.match(
    reminderFunction,
    /const db = await getSimpBudgetFirestore\(\)/,
    'the scheduled reminder should scan PipeLists state from SimpBudget Firestore',
  );
  assert.doesNotMatch(
    reminderFunction,
    /import \{ getFirestore[,}]/,
    'the scheduled reminder should not scan the default QuickLifts Firestore project',
  );
  assert.match(
    simpBudgetAdmin,
    /const SIMPBUDGET_PROJECT_ID =[\s\S]*'simpbudget-e213e'/,
    'the SimpBudget admin helper should default to the standalone PipeLists project',
  );
  assert.match(
    simpBudgetAdmin,
    /process\.env\.SIMPBUDGET_FIREBASE_SERVICE_ACCOUNT/,
    'production can provide a dedicated SimpBudget service account when needed',
  );
  assert.match(
    simpBudgetAdmin,
    /projectId: SIMPBUDGET_PROJECT_ID/,
    'fallback admin credentials should be pointed at the SimpBudget project',
  );
});

test('PipeLists Brevo webhook writes contact email events to SimpBudget', () => {
  const brevoWebhook = read('netlify/functions/brevo-email-webhook.ts');

  assert.match(
    brevoWebhook,
    /import \{ getSimpBudgetFirestore \} from '\.\/utils\/getSimpBudgetServiceAccount'/,
    'PipeLists webhook updates should use the standalone SimpBudget Firebase helper',
  );
  assert.match(
    brevoWebhook,
    /const simpBudgetDb = await getSimpBudgetFirestore\(\)/,
    'PipeLists contact email status updates should open SimpBudget Firestore before writing',
  );
  assert.match(
    brevoWebhook,
    /const stateRef = simpBudgetDb\s*\.collection\(SIMPBUDGET_USERS_COLLECTION\)/,
    'PipeLists webhook updates should write the saved list state in SimpBudget Firestore',
  );
});
