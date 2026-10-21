const esbuild=require('esbuild');
const fs=require('fs');
const http=require('http');
const {chromium}=require('@playwright/test');
const root=process.cwd();
(async()=>{
const mocks={
 'next/head':'export default function Head(){return null}',
 'next/link':'import React from "react";export default function Link(props){return React.createElement("a",props)}',
 'next/router':'export const useRouter=()=>({isReady:true,query:{},pathname:"/admin/groupMeet",replace:async()=>{}})',
 'firebase/auth':'export const signOut=async()=>{}',
 'firebase/storage':'export const getDownloadURL=async()=>"";export const ref=()=>{};export const uploadBytes=async()=>{}',
 'AdminRouteGuard':'export default function Guard({children}){return children}',
 'api/firebase/config':'const user={email:"host@example.test",displayName:"Test Host",getIdToken:async()=>"synthetic"};export const auth={currentUser:user,onIdTokenChanged(cb){cb(user);return ()=>{}}};export const storage={}',
 'GroupMeetBookingSettings':'export default function Settings(){return null}',
};
await esbuild.build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import Page from "./src/pages/admin/groupMeet";createRoot(document.getElementById("root")).render(<Page/>);',resolveDir:root,loader:'tsx'},bundle:true,outfile:'work/group-meet-qa.js',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/.*/},a=>{const k=Object.keys(mocks).find(k=>a.path===k||a.path.endsWith('/'+k));if(k)return{path:k,namespace:'mock'}});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:root}));}}]});
const server=http.createServer((req,res)=>{if(req.url==='/qa.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync('work/group-meet-qa.js'))}if(req.url==='/qa.css'){res.setHeader('Content-Type','text/css');return res.end(fs.readFileSync('work/group-meet-qa.css'))}res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qa.css"></head><body><div id="root"></div><script src="/qa.js"></script></body></html>')}).listen(4398,'127.0.0.1');
const browser=await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const host={token:'test-host',name:'Test Host',email:'host@example.test',participantType:'host',shareUrl:'http://127.0.0.1:4398/group-meet/test-host',emailStatus:'manual_only',respondedAt:null,availabilityCount:0,availabilityEntries:[]};
const detail={id:'test-request',title:'Advisory Board Meeting',targetMonth:'2026-10',deadlineAt:'2026-10-24T21:00:00Z',timezone:'America/New_York',meetingDurationMinutes:60,createdByEmail:'host@example.test',createdAt:'2026-10-19T12:00:00Z',participantCount:1,responseCount:0,status:'draft',invites:[host],analysis:{totalParticipants:1,respondedParticipantCount:0,pendingParticipantCount:1,respondedParticipantNames:[],pendingParticipantNames:['Test Host'],fullMatchCandidates:[],bestCandidates:[],dateSummaries:[]},calendarSetup:{ready:true},finalSelection:null,aiRecommendation:null,calendarInvite:null};
const requests=[];
await page.route('**/api/**',async route=>{const req=route.request();if(!req.url().startsWith('http://127.0.0.1:4398'))return route.abort();const url=new URL(req.url()).pathname;requests.push({url,method:req.method(),body:req.postData()});let result={};
if(url==='/api/admin/group-meet/contacts')result={contacts:[]};
else if(url==='/api/admin/group-meet')result={requests:[detail]};
else if(url==='/api/admin/group-meet/test-request'){if(req.method()==='PATCH'){const body=req.postDataJSON();if(Object.keys(body).join()!=='title')throw Error('Title update changed other fields');detail.title=body.title}result={request:detail}}
else if(url.endsWith('/calendar/google/import'))result={suggestions:[{date:'2026-10-23',startMinutes:540,endMinutes:720}],calendarImport:{connected:true,status:'imported'}};
else if(url==='/api/group-meet/test-host'){if(req.method()==='POST'){host.availabilityEntries=req.postDataJSON().availabilityEntries;host.availabilityCount=host.availabilityEntries.length;host.respondedAt='2026-10-19T13:00:00Z';detail.responseCount=1}result={invite:{...host,responseSubmittedAt:host.respondedAt,peerAvailability:[],calendarImport:{connected:true,status:'connected'},request:detail}}}
else throw Error('Unexpected request '+url);
await route.fulfill({json:result});});
await page.goto('http://127.0.0.1:4398/admin/groupMeet');
await page.getByRole('button',{name:'Requests',exact:true}).click();
await page.getByRole('button',{name:'Sync host calendar',exact:true}).click();
const dialog=page.getByRole('dialog',{name:'Host availability'});await dialog.waitFor();
await page.screenshot({path:'work/group-meet-modal-desktop.png'});
if(!await dialog.getByRole('button',{name:'Finish',exact:true}).isDisabled())throw Error('Finish enabled without saved availability');
await dialog.getByRole('button',{name:'Import availability',exact:true}).click();
await dialog.getByText('Imported and saved 1 Google Calendar time slot.').waitFor();
await dialog.getByRole('button',{name:'Finish',exact:true}).click();
await dialog.waitFor({state:'hidden'});
await page.getByText('Host ready',{exact:true}).waitFor();
if(!await page.getByRole('button',{name:'Send invitations',exact:true}).isEnabled())throw Error('Invites still disabled');
await page.getByRole('button',{name:'Open request',exact:true}).click();
await page.getByRole('textbox',{name:'Request title',exact:true}).fill('Updated Advisory Meeting');
await page.getByRole('button',{name:'Save title',exact:true}).click();
await page.getByText('Title saved.',{exact:true}).waitFor();
await page.screenshot({path:'work/group-meet-draft-title-desktop.png'});
await page.getByRole('button',{name:'Close',exact:true}).click();
await page.getByText('Updated Advisory Meeting',{exact:true}).waitFor();
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'Open request',exact:true}).click();
await page.screenshot({path:'work/group-meet-draft-title-mobile.png'});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Mobile page overflows');
await page.getByRole('button',{name:'Open host availability',exact:true}).last().click();
await dialog.waitFor();await page.screenshot({path:'work/group-meet-modal-mobile.png'});
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({passed:true,requests:requests.map(r=>r.method+' '+r.url),screenshots:4}));
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
