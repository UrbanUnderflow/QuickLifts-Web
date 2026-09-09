const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = process.cwd();
const out = '/tmp/cau-phone-preview';
fs.mkdirSync(out+'/public',{recursive:true}); fs.mkdirSync(out+'/functions',{recursive:true});
fs.writeFileSync(out+'/netlify.toml','[build]\n  command="/usr/bin/true"\n  publish="public"\n  functions="functions"\n[functions]\n  node_bundler="esbuild"\n');
fs.writeFileSync(out+'/public/index.html','<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>CAU questionnaire test</title></head><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');
fs.writeFileSync(out+'/public/_redirects','/api/pulsecheck/questionnaire/cau /.netlify/functions/cau 200\n/* /index.html 200\n');
fs.writeFileSync(out+'/public/_headers','/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n');
(async()=>{
 await esbuild.build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './src/pages/PulseCheck/questionnaire/cau'; createRoot(document.getElementById('root')).render(<><div style={{background:'#d9f764',padding:12,textAlign:'center'}}>Browser test: use fictional names and answers only.</div><Page collectionEnabled={false}/></>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:out+'/public/app.js',minify:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'head',setup(build){build.onResolve({filter:/^next\/head$/},()=>({path:'head',namespace:'shim'}));build.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:'export default function Head(){return null}',loader:'js'}));}}]});
 await esbuild.build({stdin:{contents:`import handler from './src/pages/api/pulsecheck/questionnaire/cau'; export async function handlerWrapper(event) { if (event.body && event.body.length > 131072) return {statusCode:413,body:'Request too large'}; let body; try {body=JSON.parse(event.body||'{}')}catch{return {statusCode:400,body:'Invalid JSON'}}; let statusCode=200;const headers={};let result=''; const response={setHeader(k,v){headers[k]=v},status(s){statusCode=s;return this},json(v){result=JSON.stringify(v);headers['Content-Type']='application/json';return this},end(){return this}};await handler({method:event.httpMethod,headers:event.headers,body},response);return {statusCode,headers,body:result}; } export {handlerWrapper as handler};`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',target:'node20',format:'cjs',outfile:out+'/functions/cau.js',external:['firebase-admin']});
 fs.writeFileSync(out+'/package.json',JSON.stringify({private:true,dependencies:{'firebase-admin':require(root+'/node_modules/firebase-admin/package.json').version}}));
 if (!fs.existsSync(out+'/node_modules')) fs.symlinkSync(root+'/node_modules',out+'/node_modules','dir');
 if (process.env.CAU_PREVIEW_INVITE_KEY) {
  const file=out+'/functions/cau.js';
  fs.writeFileSync(file,'process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED="true";process.env.CAU_QUESTIONNAIRE_INVITE_KEY='+JSON.stringify(process.env.CAU_PREVIEW_INVITE_KEY)+';\n'+fs.readFileSync(file,'utf8'));
 }
 console.log('Built isolated phone preview');
})().catch(e=>{console.error(e.message);process.exit(1)});
