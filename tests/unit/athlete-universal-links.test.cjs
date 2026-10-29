const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const association=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../public/apple-app-site-association'),'utf8'));
const matches=(id,url)=>association.applinks.details.some(row=>row.appID===id&&row.paths.some(pattern=>new RegExp('^'+pattern.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(new URL(url).pathname)));
test('Printed UMES team links match both native app identities',()=>{
 for(const code of ['UMESBOWL','UMESGOLF'])for(const id of ['ZG887P86D5.com.fitwithpulse.athleticmind','ZG887P86D5.com.fitwithpulse.pulsecheck'])
  assert(matches(id,'https://fitwithpulse.ai/PulseCheck/team-invite/'+code));
});
test('Existing app associations and branded AthleticMind route remain',()=>{
 assert(matches('ZG887P86D5.Tremaine.QuickLifts','https://fitwithpulse.ai/workout/example'));
 assert(matches('ZG887P86D5.Tremaine.Macra','https://fitwithpulse.ai/macra/buddy/example'));
 assert(matches('ZG887P86D5.com.fitwithpulse.athleticmind','https://fitwithpulse.ai/AthleticMind/team-invite/example'));
});
test('Invite association does not capture protected dashboard routes',()=>{
 for(const id of ['ZG887P86D5.com.fitwithpulse.athleticmind','ZG887P86D5.com.fitwithpulse.pulsecheck'])assert(!matches(id,'https://fitwithpulse.ai/admin/pulsecheckProvisioning'));
});
