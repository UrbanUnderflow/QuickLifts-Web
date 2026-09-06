import { loadEnvConfig } from '@next/env';
import { writeFileSync } from 'node:fs';
import { respondWithAppRuntime } from '../src/lib/nora-red-team/appRuntime';
loadEnvConfig(process.cwd());
async function main() {
  const results = [];
  for (const content of ['Give me one short cue for my next volleyball serve.', 'I ate chicken and rice for lunch. Can I log it?']) {
    try {
      results.push({ content, ...await respondWithAppRuntime([{role:'user',content}], '', true) });
    } catch (error) {
      results.push({content,error:error instanceof Error ? error.message : 'Failed'});
      process.exitCode=1;
    }
  }
  writeFileSync('/tmp/nora-app-runtime-check.json', JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
void main();
