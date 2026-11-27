'use strict';

function endpoint(value, fallback) {
  const raw = value === undefined ? fallback : value;
  let url;
  try { url = new URL('http://' + raw); } catch { throw Error('Test Lab requires loopback emulator hosts and explicit non-privileged ports.'); }
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(raw)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) {
    throw Error('Test Lab requires loopback emulator hosts and explicit non-privileged ports.');
  }
  return url.host;
}

function emulatorEndpoints(env = process.env) {
  return {
    auth: endpoint(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099'),
    firestore: endpoint(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080'),
  };
}

function authEmulatorOrigin(env = process.env) {
  return 'http://' + emulatorEndpoints(env).auth;
}

function browserFirebaseConfig(project, authEndpoint) {
  const port = new URL('http://' + endpoint(authEndpoint, '127.0.0.1:9099')).port;
  // Browser/WebView uses its own loopback hostname (10.0.2.2 on Android), with
  // exactly the Auth port used by fixtures, native clients and the adapter.
  return `import {initializeApp} from 'firebase/app';import{getAuth,connectAuthEmulator}from'firebase/auth';const app=initializeApp({projectId:${JSON.stringify(project)},apiKey:'test-lab-only',authDomain:'localhost'});export const auth=getAuth(app);connectAuthEmulator(auth,'http://'+location.hostname+':${port}',{disableWarnings:true});export const isUsingDevFirebase=()=>true;`;
}

module.exports = { emulatorEndpoints, authEmulatorOrigin, browserFirebaseConfig };
