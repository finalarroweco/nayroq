import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../lib/service/voice-access.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',compiled)(require,module,module.exports);
const {signVoiceCall,verifyVoiceCall}=module.exports;
const secret='test-only-credential-not-a-real-key';
const token=signVoiceCall('owner-a','rtc_testcall123',secret,1000);
test('call authorization binds the call to its authenticated owner',()=>{
 assert.equal(verifyVoiceCall(token,'owner-a',secret,2000),'rtc_testcall123');
 assert.equal(verifyVoiceCall(token,'owner-b',secret,2000),null);
});
test('expired, tampered and incorrectly signed call proofs are rejected',()=>{
 assert.equal(verifyVoiceCall(token,'owner-a',secret,3601001),null);
 assert.equal(verifyVoiceCall(token,'owner-a','other-key',2000),null);
 const parts=token.split('.');const payload=JSON.parse(Buffer.from(parts[0],'base64url'));payload.callId='rtc_someoneelses_call';
 assert.equal(verifyVoiceCall(Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+parts[1],'owner-a',secret,2000),null);
 assert.equal(verifyVoiceCall('malformed','owner-a',secret,2000),null);
});
test('even a signed proof cannot put an arbitrary URL in the hangup path',()=>{
 assert.equal(verifyVoiceCall(signVoiceCall('owner-a','https://example.invalid/path',secret,1000),'owner-a',secret,2000),null);
});
