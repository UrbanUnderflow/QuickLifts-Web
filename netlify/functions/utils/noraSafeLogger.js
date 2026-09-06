// No transcript snippets, model outputs, request bodies or exception text in logs.
const write = level => (event) => {
  const scope = typeof event === 'string' ? event.match(/^\[([A-Za-z0-9_-]+)\]/)?.[1] : null;
  globalThis.console[level]({component:scope || 'nora-runtime',level});
};
module.exports={log:write('log'),info:write('info'),warn:write('warn'),error:write('error')};
