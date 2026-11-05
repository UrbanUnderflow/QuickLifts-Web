const {admin, getFirebaseAdminApp} = require('./config/firebase');
const staffProject = 'theathleticmind-77954';
const editors = new Set(['hello@theathleticmind.ai', 'tre@fitwithpulse.ai']);
const readers = new Set([...editors,'jelanna@auntedna.ai','tracey@auntedna.ai','chris@theathleticmind.ai','kiyun@athleda.org','hanxuan@athleda.org']);
const apple = {pulsecheck:'6747253393', athleticmind:'6825533952'};
const platforms = ['ios','android'];
const failure = (message,status=400) => Object.assign(new Error(message),{status});
const reply = (statusCode,body) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'},body:JSON.stringify(body)});
function listing(brand,platform) {
  return platform==='ios' ? 'https://apps.apple.com/app/id'+apple[brand] : 'https://play.google.com/store/apps/details?id=com.fitwithpulse.'+brand;
}
function buildNumber(v) { return /^\d{1,10}$/.test(v) && Number(v)<=2147483647; }
function versionNumber(v) { return typeof v==='string' && v.split('.').length<=4 && v.split('.').every(buildNumber); }
function compareVersion(a,b) {
  const left=a.split('.').map(Number),right=b.split('.').map(Number);
  for(let i=0;i<4;i++){const diff=(left[i]||0)-(right[i]||0);if(diff)return diff;}
  return 0;
}
function validateLink(brand,platform,storeURL) {
  if(!Object.hasOwn(apple,brand)||!platforms.includes(platform))throw failure('Choose a supported app and platform.');
  let u;try{u=new URL(storeURL);}catch{throw failure('Enter a valid store link.');}
  const expected=platform==='ios'
    ? u.hostname==='apps.apple.com' && !u.search && /^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id(\d+)$/.exec(u.pathname)?.[1]===apple[brand]
    : u.hostname==='play.google.com' && u.pathname==='/store/apps/details' && [...u.searchParams].length===1 && u.searchParams.get('id')==='com.fitwithpulse.'+brand;
  if(!expected||u.protocol!=='https:'||u.port||u.username||u.password||u.hash)throw failure('Use the store listing for this exact app and platform.');
  return u;
}
function parse(input) {
  const {brand,platform,version,build,storeURL,mode,minimumVersion,minimumBuild,title,notes}=input;
  if(!Object.hasOwn(apple,brand)||!platforms.includes(platform))throw failure('Choose a supported app and platform.');
  if(!versionNumber(version)||typeof build!=='string'||!buildNumber(build))throw failure('Enter a numeric version and build.');
  if(!['off','optional','required'].includes(mode))throw failure('Choose a prompt setting.');
  if(mode!=='off' && input.storeReady!==true)throw failure('Confirm this version is available in its store first.');
  if(mode==='required' && (!versionNumber(minimumVersion)||typeof minimumBuild!=='string'||!buildNumber(minimumBuild)||compareVersion(minimumVersion,version)>0||(compareVersion(minimumVersion,version)===0&&Number(minimumBuild)>Number(build))))throw failure('The minimum release cannot exceed the available release.');
  if(typeof title!=='string'||!title.trim()||title.length>160||typeof notes!=='string'||!notes.trim()||notes.length>20000)throw failure('Enter a release title and notes.');
  const u=validateLink(brand,platform,storeURL);
  return {schemaVersion:1,brand,platform,latestVersion:version,latestBuild:build,minimumVersion:mode==='required'?minimumVersion:'0',minimumBuild:mode==='required'?minimumBuild:null,enabled:mode!=='off',storeReady:input.storeReady===true,storeURL:u.href,expiresAt:new Date(Date.now()+6*86400000).toISOString()};
}
async function authorize(event) {
  const token=(event.headers?.authorization||'').match(/^Bearer (.+)$/)?.[1]; if(!token)throw failure('Staff sign-in required.',401);
  const verifier=admin.apps.find(x=>x?.name==='release-staff')||admin.initializeApp({projectId:staffProject},'release-staff');
  const claims=await admin.auth(verifier).verifyIdToken(token).catch(()=>null);
  if(!claims?.email_verified||claims.firebase?.sign_in_provider!=='google.com'||!readers.has(claims.email))throw failure('Staff sign-in required.',403);
  return claims.email;
}
async function snapshot(db,brand,platform) {
  const ref=db.collection('company-config').doc(brand+'-'+platform+'-update-policy');
  const [policy,...collections]=await Promise.all([ref.get(),...['version','versions'].map(k=>db.collection(brand+'-'+k).get())]);
  const history=new Map();
  for(const collection of collections)for(const doc of collection.docs){
    const d=doc.data(), p=d.platform??(Array.isArray(d.platforms)?null:'ios');
    if(p!==platform && !d.platforms?.includes(platform))continue;
    if(!versionNumber(doc.id))continue;
    history.set(doc.id,{version:doc.id,build:String(d.buildNumber??d.build??''),title:d.whatsNew?.title||'',notes:d.whatsNew?.markdown||'',showWhatsNew:d.whatsNew?.isEnabled!==false && Boolean(d.whatsNew),storeURL:d.whatsNew?.actionURL||listing(brand,platform)});
  }
  const current=policy.data()||{};
  return {brand,platform,storeURL:current.storeURL||listing(brand,platform),policy:current,revision:policy.updateTime?.toMillis()??null,history:[...history.values()].sort((a,b)=>compareVersion(b.version,a.version))};
}
exports.handler=async(event)=>{
  try {
    const email=await authorize(event);
    const db=admin.firestore(getFirebaseAdminApp({headers:{'x-pulsecheck-firebase-mode':'prod'}}));
    if(event.httpMethod==='GET'){
      const targets=await Promise.all(Object.keys(apple).flatMap(b=>platforms.map(p=>snapshot(db,b,p))));
      return reply(200,{targets,canEdit:editors.has(email)});
    }
    if(event.httpMethod!=='POST')return reply(405,{error:'Unsupported method.'});
    if(!editors.has(email))throw failure('Release editor access required.',403);
    const input=JSON.parse(event.body||'{}');
    if(input.linkOnly===true){
      const u=validateLink(input.brand,input.platform,input.storeURL);
      const ref=db.collection('company-config').doc(input.brand+'-'+input.platform+'-update-policy');
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if((current.updateTime?.toMillis()??null)!==input.revision)throw failure('Settings changed. Reload before saving.',409);
        const defaults=current.exists?{}:{schemaVersion:1,brand:input.brand,platform:input.platform,enabled:false,storeReady:false,latestVersion:'0',minimumVersion:'0',expiresAt:new Date().toISOString()};
        tx.set(ref,{...defaults,storeURL:u.href},{merge:true});
      });
      return reply(200,{saved:true});
    }
    const policy=parse(input);
    const policyRef=db.collection('company-config').doc(input.brand+'-'+input.platform+'-update-policy');
    const releaseRef=db.collection(input.brand+(input.platform==='ios'?'-version':'-versions')).doc(input.version);
    await db.runTransaction(async tx=>{
      const legacy=db.collection('company-config').doc(input.brand+'-app-update-modal');
      const [current,release,previousLegacy]=await Promise.all([tx.get(policyRef),tx.get(releaseRef),tx.get(legacy)]);
      if((current.updateTime?.toMillis()??null)!==input.revision)throw failure('Settings changed. Reload before saving.',409);
      if(release.exists && (release.get('platform')||'ios')!==input.platform)throw failure('A release for the other platform already occupies this record.',409);
      if(!previousLegacy.exists)tx.set(legacy,{isEnabled:false});
      tx.set(policyRef,policy);
      tx.set(releaseRef,{platform:input.platform,buildNumber:input.build,isCriticalUpdate:false,changeNotes:input.notes.trim().split('\n'),whatsNew:{isEnabled:input.showWhatsNew===true,title:input.title.trim(),markdown:input.notes.trim(),actionLabel:'Open store',actionURL:policy.storeURL}},{merge:true});
    });
    return reply(200,{saved:true});
  }catch(error){return reply(error.status||500,{error:error.status?error.message:'Release settings could not be loaded or saved.'});}
};
exports.parseReleaseSettings=parse;
