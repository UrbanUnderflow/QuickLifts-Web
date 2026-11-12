// No transcript snippets, model outputs, request bodies or exception text in logs.
const write = level => (event) => {
  const scope = typeof event === 'string' ? event.match(/^\[([A-Za-z0-9_-]+)\]/)?.[1] : null;
  globalThis.console[level]({component:scope || 'nora-runtime',level});
};
// Timings and counts only: every value that is not a finite number is dropped.
const metrics = (scope, values = {}) => {
  const numbers = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (/^[A-Za-z0-9_]{1,40}$/.test(key) && Number.isFinite(value)) numbers[key] = value;
  }
  globalThis.console.log({component:String(scope || 'nora-runtime').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),level:'metrics',...numbers});
};
module.exports={log:write('log'),info:write('info'),warn:write('warn'),error:write('error'),metrics};
