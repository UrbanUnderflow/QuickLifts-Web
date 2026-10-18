const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {revealPartnerKey} = require('../../netlify/functions/lib/partner-api-keys');
const keyId = 'pk_' + 'a'.repeat(32), secret = 'synthetic-secret-only';
const env = {PARTNER_API_KEY_ENCRYPTION_KEYS_JSON: JSON.stringify({v1: Buffer.alloc(32, 7).toString('base64')}), PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION: 'v1'};
function fixture(overrides = {}) {
 const iv = Buffer.alloc(12, 1), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), iv); cipher.setAAD(Buffer.from(keyId));
 const record = {keyId, status:'active', expiresAtMs:2000, encryptedSecret:{version:'v1',iv:iv.toString('base64'),ciphertext:Buffer.concat([cipher.update(secret),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')},...overrides};
 const writes=[];const db={collection:name=>({doc:id=>({name,id})}),runTransaction:async callback=>callback({get:async()=>({exists:true,data:()=>record}),set:(ref,data)=>writes.push({ref,data})})};
 return {db,writes};
}
test('decrypts existing credential and audits access without storing plaintext',async()=>{const {db,writes}=fixture();assert.deepEqual(await revealPartnerKey(db,{keyId,actorEmail:'admin@example.test',env,now:1000}),{keyId,secret});assert.equal(writes[0].data.action,'key_secret_accessed');assert.equal(writes[0].data.actorEmail,'admin@example.test');assert.equal(JSON.stringify(writes).includes(secret),false);});
test('rejects expired, revoked, rotating, mismatched, and malformed credentials',async()=>{for(const overrides of [{status:'revoked'},{status:'rotating'},{revokedAt:'date'},{expiresAtMs:1000},{expiresAtMs:undefined},{keyId:'pk_'+'b'.repeat(32)}]){const {db,writes}=fixture(overrides);await assert.rejects(revealPartnerKey(db,{keyId,actorEmail:'admin@example.test',env,now:1000}),/key_not_active/);assert.equal(writes.length,0);}const {db}=fixture();await assert.rejects(revealPartnerKey(db,{keyId:'bad',actorEmail:'admin@example.test'}),/invalid_key/);});
test('fails closed when decryption or audit fails',async()=>{const {db,writes}=fixture();await assert.rejects(revealPartnerKey(db,{keyId,actorEmail:'admin@example.test',env:{},now:1000}),/key_encryption_unavailable/);assert.equal(writes.length,0);db.runTransaction=async()=>{throw Error('audit unavailable');};await assert.rejects(revealPartnerKey(db,{keyId,actorEmail:'admin@example.test',env,now:1000}),/audit unavailable/);});
