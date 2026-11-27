import {test} from 'node:test';
import assert from 'node:assert/strict';
import {challengeS256,validateCodeBinding} from '../src/pkce.mjs';
test('PKCE S256 confirma o vetor RFC 7636 e recusa revínculo ou reuso',async()=>{
 const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
 const challenge='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
 assert.equal(await challengeS256(verifier),challenge);
 const exchange={verifier,clientId:'test',redirectUri:'https://client.invalid/callback',resource:'https://mcp.invalid/mcp'};
 const binding={...exchange,challenge,method:'S256',expiresAt:200};
 assert.ok(await validateCodeBinding(binding,exchange,100));
 for(const change of [{method:'plain'},{usedAt:99},{expiresAt:100},{clientId:'other'},{redirectUri:'https://other.invalid'},{resource:'https://other.invalid'}])
  assert.equal(await validateCodeBinding({...binding,...change},exchange,100),false);
 assert.equal(await validateCodeBinding(binding,{...exchange,verifier:'bad'},100),false);
});
