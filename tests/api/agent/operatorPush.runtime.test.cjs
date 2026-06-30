const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOperatorPushMessage,
  sendOperatorPush,
} = require('../../../scripts/operatorPush');

test('buildOperatorPushMessage creates PulseCommand operator notification payload', () => {
  const message = buildOperatorPushMessage({
    token: 'fcm-token',
    commandId: 'cmd-1',
    agentId: 'nora',
    agentName: 'Nora',
    content: 'Nora found a Macra signal worth reviewing.',
    operatorFields: {
      proactiveType: 'finding',
      operatorEvent: 'finding',
      operatorPriority: 'decision',
      operatorSummary: 'ASA trial conversion is outperforming organic.',
      taskId: 'task-1',
      taskName: 'Review Macra ASA source quality',
      missionId: 'macra-growth',
      requiresReply: true,
    },
  });

  assert.equal(message.token, 'fcm-token');
  assert.equal(message.notification.title, 'Nora found a signal');
  assert.equal(message.notification.body, 'ASA trial conversion is outperforming organic.');
  assert.equal(message.data.type, 'PULSECOMMAND_OPERATOR_UPDATE');
  assert.equal(message.data.route, 'operator_inbox');
  assert.equal(message.data.requiresReply, 'true');
  assert.equal(message.apns.payload.aps['thread-id'], 'pulsecommand-nora');
});

test('sendOperatorPush reports no registered devices without failing', async () => {
  const db = {
    collection(name) {
      assert.equal(name, 'pulsecommand-operator-devices');
      return {
        limit(limitValue) {
          assert.equal(limitValue, 100);
          return {
            async get() {
              return { docs: [] };
            },
          };
        },
      };
    },
  };

  const result = await sendOperatorPush({
    db,
    messaging: { send: async () => 'message-id' },
    commandId: 'cmd-1',
    agentId: 'nora',
    agentName: 'Nora',
    content: 'No devices yet',
    operatorFields: {},
  });

  assert.deepEqual(result, {
    success: true,
    sent: 0,
    failed: 0,
    reason: 'no_registered_operator_devices',
  });
});
