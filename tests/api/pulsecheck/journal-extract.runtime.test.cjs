const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const fn = (name) => path.join(repoRoot, 'netlify/functions', name);
function load() {
  [fn('journal-extract.js'), fn('config/firebase.js'), fn('pulsecheck-chat.js')].forEach((p) => delete require.cache[p]);
  require.cache[fn('config/firebase.js')] = { id: 'c', filename: 'c', loaded: true, exports: { initializeFirebaseAdmin() {}, getFirebaseAdminApp: () => ({}), headers: {} } };
  require.cache[fn('pulsecheck-chat.js')] = { id: 'p', filename: 'p', loaded: true, exports: { runtimeHelpers: { verifyPulseCheckCaller: async () => ({ userId: 'athlete-1' }) } } };
  return require(fn('journal-extract.js'));
}
function db(entry, screening) {
  const docs = { entries: entry, screenings: screening };
  return { collection: () => ({ doc: () => ({ collection: (name) => ({ doc: () => ({ async get() { return { exists: Boolean(docs[name]), data: () => docs[name] }; } }) }) }) }) };
}

test('sanitize drops numbers the entry never stated and keeps effort as words', () => {
  const { _private } = load();
  const result = _private.sanitize({
    workouts: [{ activity: 'legs', durationMinutes: 45, effortWords: 'pretty tough', details: [{ exercise: 'squat', sets: 3, reps: 5, weight: 185, unit: 'lb' }] }],
    meals: [{ description: 'eggs and toast', timing: 'before_training', context: ['rushed', 'hungry'] }],
  }, 'Did legs, pretty tough. Eggs and toast before practice, rushed.');
  assert.equal(result.workouts[0].durationMinutes, null);
  assert.deepEqual(result.workouts[0].details, []);
  assert.equal(result.workouts[0].effortWords, 'pretty tough');
  assert.deepEqual(result.meals[0].context, ['rushed']);
});

test('extraction asks one rule-based question, only when allowed and screening is clear', async () => {
  const { extractEntry } = load();
  const entry = { type: 'workout', moment: 'Did legs, pretty tough.' };
  const extract = async () => ({ workouts: [{ activity: 'legs' }], meals: [] });
  const allowed = await extractEntry({ db: db(entry, { status: 'done', outcome: 'clear' }), userId: 'athlete-1', entryId: 'e', allowQuestion: true, extract });
  assert.equal(allowed.question, 'About how long was the workout?');
  const junior = await extractEntry({ db: db(entry, { status: 'done', outcome: 'clear' }), userId: 'athlete-1', entryId: 'e', allowQuestion: false, extract });
  assert.equal(junior.question, null);
  assert.equal(junior.workouts.length, 1);
});

test('extraction is skipped for safety results, sensitive food language, and other entry types', async () => {
  const { extractEntry } = load();
  const never = async () => { throw new Error('should not call the model'); };
  const safety = await extractEntry({ db: db({ type: 'food', moment: 'toast' }, { status: 'done', outcome: 'checkIn' }), userId: 'a', entryId: 'e', extract: never });
  assert.equal(safety.skipped, 'safety');
  const sensitive = await extractEntry({ db: db({ type: 'food', moment: 'I binged and feel guilty' }, { status: 'done', outcome: 'clear' }), userId: 'a', entryId: 'e', extract: never });
  assert.equal(sensitive.skipped, 'sensitive');
  const other = await extractEntry({ db: db({ type: 'gratitude', moment: 'x' }, null), userId: 'a', entryId: 'e', extract: never });
  assert.equal(other.skipped, 'not_loggable');
  const photoOnly = await extractEntry({ db: db({ type: 'food', moment: '', photoStoragePath: 'p' }, null), userId: 'a', entryId: 'e', extract: never });
  assert.equal(photoOnly.meals.length, 1);
});
