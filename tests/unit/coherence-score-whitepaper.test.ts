import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COHERENCE_SCORE_METHOD_VERSION,
  COHERENCE_SCORE_WHITE_PAPER_CONTENT,
  COHERENCE_SCORE_WHITE_PAPER_METADATA,
  COHERENCE_SCORE_WHITE_PAPER_SLUG,
  evidenceMap,
  limitations,
  references,
  scoreDefinitions,
  verificationMatrix,
} from '../../src/content/research/coherence-score-whitepaper';
import {
  getLocalResearchArticleListItems,
  getResearchArticleOverride,
} from '../../src/content/research/mental-game-white-paper';
import { PULSECHECK_SCORING_VERSION } from '../../src/utils/pulsecheckScoringV2';

test('public whitepaper stays on the production scoring version', () => {
  assert.equal(COHERENCE_SCORE_METHOD_VERSION, PULSECHECK_SCORING_VERSION);
});

test('whitepaper is registered in the public Research library', () => {
  const listItem = getLocalResearchArticleListItems().find(
    (article) => article.slug === COHERENCE_SCORE_WHITE_PAPER_SLUG,
  );
  const article = getResearchArticleOverride(COHERENCE_SCORE_WHITE_PAPER_SLUG);

  assert.ok(listItem);
  assert.equal(listItem.contentType, 'white-paper');
  assert.equal(listItem.status, 'published');
  assert.equal(listItem.title, COHERENCE_SCORE_WHITE_PAPER_METADATA.title);
  assert.ok(article);
  assert.equal(article.content, COHERENCE_SCORE_WHITE_PAPER_CONTENT);
  assert.match(article.content, /:::abstract/);
  assert.match(article.content, /:::references/);
  assert.match(article.content, /# 2\. The Four-Score Architecture/);
});

test('public method documents each canonical score once', () => {
  assert.deepEqual(
    scoreDefinitions.map((score) => score.key).sort(),
    ['adherence', 'coherence', 'recovery', 'wellbeing'],
  );
  assert.equal(new Set(scoreDefinitions.map((score) => score.key)).size, 4);
  scoreDefinitions.forEach((score) => {
    assert.ok(score.equation.length > 10);
    assert.ok(score.inputs.length >= 3);
    assert.ok(score.excludes.length >= 3);
    assert.ok(score.minimumEvidence.length > 20);
  });
});

test('claim limits remain explicit in public evidence copy', () => {
  const publicMethod = JSON.stringify({ evidenceMap, limitations }).toLowerCase();
  assert.match(publicMethod, /not diagnoses/);
  assert.match(publicMethod, /not.*validated psychometric/);
  assert.match(publicMethod, /does not validate/);
  assert.match(publicMethod, /does not reproduce or activate who-5/);
  assert.match(publicMethod, /training decisions/);
});

test('public method explains Coherence continuity and the three-day onboarding boundary', () => {
  const publicMethod = COHERENCE_SCORE_WHITE_PAPER_CONTENT.toLowerCase();
  assert.match(publicMethod, /first 3 account days/);
  assert.match(publicMethod, /refreshes an established read rather than resetting/);
  assert.match(publicMethod, /carries the last established read/);
  assert.match(publicMethod, /scale is 1 to 100/);
});

test('source record and verification matrix cover the critical method risks', () => {
  const referenceUrls = references.map(([, url]) => url).join('\n');
  assert.match(referenceUrls, /who\.int/);
  assert.match(referenceUrls, /developer\.apple\.com/);
  assert.match(referenceUrls, /developer\.android\.com/);
  assert.match(referenceUrls, /pubmed\.ncbi\.nlm\.nih\.gov/);

  const verificationText = verificationMatrix.flat().join(' ').toLowerCase();
  assert.match(verificationText, /missing/);
  assert.match(verificationText, /source lane/);
  assert.match(verificationText, /permission/);
  assert.match(verificationText, /cross-platform/);
});
