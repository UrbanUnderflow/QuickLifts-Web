import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalTestingRequest } from '../../src/lib/nora-red-team/localTesting';
test('local access requires explicit development opt-in, loopback and matching origin',()=>{
 const prior={NODE_ENV:process.env.NODE_ENV,NORA_LOCAL_TESTING:process.env.NORA_LOCAL_TESTING};
 const req:any={headers:{host:'localhost:3100',origin:'http://localhost:3100'},socket:{remoteAddress:'127.0.0.1'}};
 try{
 Object.assign(process.env,{NODE_ENV:'development',NORA_LOCAL_TESTING:'true'});assert.equal(isLocalTestingRequest(req),true);
 assert.equal(isLocalTestingRequest({...req,headers:{...req.headers,origin:'https://other.invalid'}}),false);
 assert.equal(isLocalTestingRequest({...req,socket:{remoteAddress:'192.168.1.2'}}),false);
 Object.assign(process.env,{NODE_ENV:'production'});assert.equal(isLocalTestingRequest(req),false);
 Object.assign(process.env,{NODE_ENV:'development',NORA_LOCAL_TESTING:'false'});assert.equal(isLocalTestingRequest(req),false);
 }finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
