import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_VERSION_PRODUCT_CONFIGS,
  compareSemanticVersions,
} from '../../src/utils/appVersioning';

test('compareSemanticVersions treats leading-zero version segments as older', () => {
  assert.equal(compareSemanticVersions('6.01', '6.1') < 0, true);
  assert.equal(compareSemanticVersions('6.1', '6.01') > 0, true);
  assert.equal(compareSemanticVersions('6.01', '6.01'), 0);
});

test('compareSemanticVersions keeps trailing zero segments equivalent', () => {
  assert.equal(compareSemanticVersions('6.1', '6.1.0'), 0);
  assert.equal(compareSemanticVersions('6.1.0', '6.1'), 0);
});

test('app version admin config covers each update modal product', () => {
  assert.deepEqual(APP_VERSION_PRODUCT_CONFIGS.fitWithPulse.updateModalConfigPath, [
    'company-config',
    'app-update-modal',
  ]);
  assert.deepEqual(APP_VERSION_PRODUCT_CONFIGS.pulseCheck.updateModalConfigPath, [
    'company-config',
    'pulsecheck-app-update-modal',
  ]);
  assert.deepEqual(APP_VERSION_PRODUCT_CONFIGS.macra.updateModalConfigPath, [
    'company-config',
    'macra-app-update-modal',
  ]);
});
