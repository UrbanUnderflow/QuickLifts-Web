#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'athlete-test-lab-emulators-'));
for(const f of ['firestore.rules','firestore.indexes.json'])fs.copyFileSync(path.join(root,f),path.join(dir,f));
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'firebase.json'),'utf8'));
config.firestore={rules:'firestore.rules',indexes:'firestore.indexes.json'};
const configPath=path.join(dir,'firebase.json');fs.writeFileSync(configPath,JSON.stringify(config,null,2));
console.log(JSON.stringify({projectId:'demo-pulsecheck-ui',configPath,rulesSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'firestore.rules'))).digest('hex')}));
