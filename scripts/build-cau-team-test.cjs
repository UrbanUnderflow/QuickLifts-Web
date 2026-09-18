// Builds only the authenticated questionnaire test, leaving production app bundles untouched.
const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
const root=process.cwd(),out='/tmp/cau-team-test-preview';
const env=JSON.parse(fs.readFileSync(process.env.CAU_PUBLIC_ENV_FILE||'/tmp/cau-netlify-env.json','utf8'));
const define={'process.env.NODE_ENV':'"production"','process.env':'{}'};
for(const [key,value] of Object.entries(env))if(key.startsWith('NEXT_PUBLIC_'))define['process.env.'+key]=JSON.stringify(value);
fs.mkdirSync(out+'/public',{recursive:true});fs.mkdirSync(out+'/functions',{recursive:true});
fs.writeFileSync(out+'/netlify.toml','[build]\ncommand="/usr/bin/true"\npublish="public"\nfunctions="functions"\n[functions]\nnode_bundler="esbuild"\n');
fs.writeFileSync(out+'/public/index.html','<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>PulseCheck team questionnaire test</title></head><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');
fs.writeFileSync(out+'/public/_redirects','/api/pulsecheck/questionnaire/cau-team-test /.netlify/functions/cau-team-test 200\n/* /index.html 200\n');
fs.writeFileSync(out+'/public/_headers','/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n');
(async()=>{
 await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Page from './src/pages/PulseCheck/questionnaire/cau';createRoot(document.getElementById('root')).render(<Page collectionEnabled={true} sandboxTest={true}/>);`,resolveDir:root,loader:'tsx'},bundle:true,minify:true,outfile:out+'/public/app.js',define,plugins:[{name:'head',setup(b){b.onResolve({filter:/^next\/head$/},()=>({path:'head',namespace:'shim'}));b.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:'export default function Head(){return null}',loader:'js'}));}}]});
 const oldFunction=out+'/functions/cau-team-test.mjs';if(fs.existsSync(oldFunction))fs.unlinkSync(oldFunction);
 await esbuild.build({stdin:{contents:`import handler from './src/pages/api/pulsecheck/questionnaire/cau-team-test';export async function handlerWrapper(event){if(event.body&&event.body.length>131072)return {statusCode:413,body:'Request too large'};let body;try{body=JSON.parse(event.body||'{}')}catch{return {statusCode:400,body:'Invalid JSON'}}let statusCode=200;const headers={};let output='';const response={setHeader(k,v){headers[k]=v},status(n){statusCode=n;return this},json(v){output=JSON.stringify(v);headers['Content-Type']='application/json';return this},end(){return this}};await handler({method:event.httpMethod,headers:event.headers,body},response);return {statusCode,headers,body:output}}export {handlerWrapper as handler};`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',target:'node20',format:'cjs',outfile:out+'/functions/cau-team-test.js',packages:'external'});
 fs.writeFileSync(out+'/package.json',JSON.stringify({private:true,dependencies:{'firebase-admin':require(root+'/node_modules/firebase-admin/package.json').version,'@google-cloud/firestore':require(root+'/node_modules/@google-cloud/firestore/package.json').version,'google-auth-library':require(root+'/node_modules/google-auth-library/package.json').version}}));
 if(!fs.existsSync(out+'/node_modules'))fs.symlinkSync(root+'/node_modules',out+'/node_modules','dir');
 console.log('Built isolated team test');
})().catch(e=>{console.error(e.message);process.exit(1)});
