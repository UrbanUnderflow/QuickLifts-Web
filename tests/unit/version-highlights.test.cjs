const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
let records=new Map(),patches=[];
const sdk={doc:(_db,...parts)=>({path:parts.join('/')}),serverTimestamp:()=>'new-update-time',runTransaction:async(_db,run)=>{const writes=[];await run({get:async ref=>({exists:()=>records.has(ref.path),data:()=>records.get(ref.path)}),update:(ref,patch)=>writes.push({ref,patch})});for(const {ref,patch} of writes){records.set(ref.path,{...records.get(ref.path),...patch});patches.push({path:ref.path,patch});}}};
const originalLoader=require.extensions['.ts'];require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const config=path.resolve('src/api/firebase/config.ts');require.cache[config]={id:config,filename:config,loaded:true,exports:{db:{}}};
const originalLoad=Module._load;Module._load=function(name,...args){if(name==='firebase/firestore')return sdk;return originalLoad.call(this,name,...args);};
const {savePublishedReleaseHighlights}=require(path.resolve('src/api/firebase/admin/versionHighlights.ts'));Module._load=originalLoad;require.extensions['.ts']=originalLoader;
const content={isEnabled:true,title:'A better start',markdown:'## Highlights\n\nNew baseline.',actionLabel:'',actionURL:''};
test('highlight-only saves preserve existing media, creation time, critical flag, build, notes and unknown metadata',async()=>{
 const before={createdAt:'original-time',updatedAt:'old-time',buildNumber:'18',build:'18',changeNotes:['Published note'],'1':'Published note',isCriticalUpdate:true,media:[{type:'video',url:'https://example.com/clip.mp4'}],video:{url:'https://example.com/clip.mp4'},images:[{url:'https://example.com/image.png'}],customMetadata:{keep:'unchanged'}};
 records=new Map([['pulsecheck-version/2.11',{...before}],['pulsecheck-versions/2.11',{...before,otherAliasField:'preserved'}]]);patches=[];
 await savePublishedReleaseHighlights('pulseCheck','2.11',content);
 assert.equal(patches.length,2);
 for(const {path:key,patch} of patches){assert.deepEqual(Object.keys(patch).sort(),['updatedAt','whatsNew']);const after=records.get(key);for(const [field,value] of Object.entries(before)){if(field!=='updatedAt')assert.deepEqual(after[field],value,field);}assert.deepEqual(after.whatsNew,content);assert.equal(after.updatedAt,'new-update-time');}
 assert.equal(records.get('pulsecheck-versions/2.11').otherAliasField,'preserved');
});
test('highlight edits update existing aliases only and never manufacture an incomplete release',async()=>{
 records=new Map([['athleticmind-version/1.2',{media:['existing'],createdAt:'created',isCriticalUpdate:true}]]);patches=[];
 await savePublishedReleaseHighlights('athleticMind','1.2',content);assert.equal(records.size,1);assert.equal(patches.length,1);assert.equal(records.get('athleticmind-version/1.2').createdAt,'created');
 await assert.rejects(savePublishedReleaseHighlights('athleticMind','9.9',content),/no longer exists/);assert.equal(records.size,1);
});
test('turning off highlights clears unpublished draft content without changing release metadata',async()=>{
 records=new Map([['pulsecheck-version/2.11',{createdAt:'keep',media:['keep'],isCriticalUpdate:true}]]);patches=[];
 await savePublishedReleaseHighlights('pulseCheck','2.11',{...content,isEnabled:false,markdown:'UNPUBLISHED DRAFT'});
 const saved=records.get('pulsecheck-version/2.11');assert.equal(saved.whatsNew.markdown,'');assert.equal(saved.createdAt,'keep');assert.deepEqual(saved.media,['keep']);assert.equal(saved.isCriticalUpdate,true);
});
