'use strict';
// Local validation guard: no network access from the build or its Node workers.
const net = require('node:net');
const dns = require('node:dns');
const denied = () => Object.assign(new Error('Network access disabled during isolated optimized-build validation'), {code:'ENETUNREACH'});
net.Socket.prototype.connect = function () { throw denied(); };
net.connect = net.createConnection = function () { throw denied(); };
globalThis.fetch = async () => { throw denied(); };
for (const method of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  dns[method] = (...args) => { const cb = args.at(-1); if (typeof cb === 'function') return queueMicrotask(() => cb(denied())); throw denied(); };
  dns.promises[method] = async () => { throw denied(); };
}
