'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {emulatorEndpoints, authEmulatorOrigin, browserFirebaseConfig} = require('./emulator-endpoints.cjs');

test('defaults remain 9099 and 8080; explicit local ports are preserved for direct Auth requests', () => {
  assert.deepEqual(emulatorEndpoints({}), {auth:'127.0.0.1:9099',firestore:'127.0.0.1:8080'});
  const env={FIREBASE_AUTH_EMULATOR_HOST:'localhost:19099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080'};
  assert.deepEqual(emulatorEndpoints(env),{auth:'localhost:19099',firestore:'127.0.0.1:18080'});
  assert.equal(authEmulatorOrigin(env),'http://localhost:19099');
});

test('remote, malformed and privileged emulator endpoints fail before requests', () => {
  for (const value of ['example.com:19099','localhost:80','localhost:99999','localhost','http://localhost:9099','user@localhost:9099','localhost:9099/path','127.1:9099','']) {
    for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST']) {
      assert.throws(()=>emulatorEndpoints({[key]:value}),/loopback emulator hosts/);
    }
  }
});

test('the browser Firebase module connects each native WebView hostname to the selected Auth port', () => {
  const source=browserFirebaseConfig('demo-pulsecheck-ui','127.0.0.1:19099')
    .replace(/import[^;]+;/g,'').replace(/export /g,'');
  for(const hostname of ['127.0.0.1','localhost','10.0.2.2']) {
    let observed;
    new Function('initializeApp','getAuth','connectAuthEmulator','location',source)(
      config=>{assert.equal(config.projectId,'demo-pulsecheck-ui');return config;},
      app=>app,
      (_auth,origin)=>{observed=origin;},
      {hostname});
    assert.equal(observed,`http://${hostname}:19099`);
  }
});
