const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
module.exports = function loadTs(filename) {
  const module = {exports: {}};
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText;
  vm.runInNewContext(compiled, {exports: module.exports, module, Date, Set, Map, console, require: name => name.endsWith('.json') ? require(path.resolve(path.dirname(filename), name)) : name.startsWith('.') ? require('./load-ts.cjs')(path.resolve(path.dirname(filename), name) + '.ts') : require(name)});
  return module.exports;
};
