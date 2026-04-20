import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROOT_USER_PROTECTED_FIELDS,
  isUserDictionaryLike,
  normalizeUserCreatePayload,
  normalizeUserPatch,
} from '../../src/api/firebase/user/writeContract';
import {
  buildCurrentLegalAcceptance,
  hasAcceptedCurrentLegal,
} from '../../src/utils/legalAcceptance';

test('marks toDictionary-bearing values as full user writes', () => {
  assert.equal(
    isUserDictionaryLike({
      toDictionary: () => ({ id: 'user_123', email: 'user@example.com' }),
    }),
    true
  );

  assert.equal(isUserDictionaryLike({ email: 'user@example.com' }), false);
});

test('normalizes create payloads without leaking undefined fields', () => {
  const payload = normalizeUserCreatePayload({
    toDictionary: () => ({
      id: 'user_123',
      email: 'user@example.com',
      displayName: 'Test User',
      nested: {
        keep: 'yes',
        drop: undefined,
      },
      list: ['one', undefined, 'two'],
    }),
  } as any);

  assert.deepEqual(payload, {
    id: 'user_123',
    email: 'user@example.com',
    displayName: 'Test User',
    nested: {
      keep: 'yes',
    },
    list: ['one', 'two'],
  });
});

test('normalizes update patches without mutating explicit values', () => {
  const patch = normalizeUserPatch({
    displayName: 'Updated Name',
    profileImage: {
      profileImageURL: 'https://example.com/image.png',
      imageOffsetWidth: 0,
      imageOffsetHeight: 0,
    },
    optional: undefined,
  });

  assert.deepEqual(patch, {
    displayName: 'Updated Name',
    profileImage: {
      profileImageURL: 'https://example.com/image.png',
      imageOffsetWidth: 0,
      imageOffsetHeight: 0,
    },
  });
});

test('exports the protected root user field contract', () => {
  assert.ok(ROOT_USER_PROTECTED_FIELDS.includes('creator'));
  assert.ok(ROOT_USER_PROTECTED_FIELDS.includes('lifetimePulsePoints'));
  assert.ok(ROOT_USER_PROTECTED_FIELDS.includes('legalAcceptance'));
});

test('recognizes current legal acceptance after Firestore numeric timestamp round-trip', () => {
  const acceptedAt = new Date('2026-04-20T13:07:18.000Z');
  const legalAcceptance = {
    ...buildCurrentLegalAcceptance('web-modal-existing-user-refresh', acceptedAt),
    acceptedAt: Math.floor(acceptedAt.getTime() / 1000),
  };

  assert.equal(
    hasAcceptedCurrentLegal({
      id: 'user_123',
      legalAcceptance,
    }),
    true
  );
});
