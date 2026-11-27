import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createConnectionAuthorizer} from '../src/authorization.mjs';

test('verifica tokens assinados e revoga cada conexão separadamente',async()=>{
 const issuer='https://issuer.example.invalid',resource='https://test.example.invalid/mcp';
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
 const {publicKey,privateKey}=await generateKeyPair('ES256');
 let admin=true;
 const record={ownerId:owner,clientId:'client',resource,environment:'test',expiresAt:Date.now()+60000,scopes:['campaigns:read']};
 const connections=new Map([[one,{...record}],[two,{...record}]]);
 const authorize=createConnectionAuthorizer({key:publicKey,issuer,resource,environment:'test',
  findConnection:async id=>connections.get(id),isCampaignAdmin:async()=>admin});
 const token=(id,audience=resource)=>new SignJWT({connection_id:id,client_id:'client',scope:'campaigns:read campaigns:write'})
  .setProtectedHeader({alg:'ES256'}).setIssuedAt().setExpirationTime('1m').setSubject(owner).setIssuer(issuer).setAudience(audience).sign(privateKey);
 const first=await token(one),second=await token(two);
 assert.deepEqual((await authorize(first)).scopes,['campaigns:read']);
 connections.get(one).revokedAt=Date.now();
 assert.equal(await authorize(first),null);
 assert.ok(await authorize(second));
 assert.equal(await authorize(await token(two,'https://prod.example.invalid/mcp')),null);
 assert.equal(await authorize(second+'invalid'),null);
 admin=false;
 assert.equal((await authorize(second)).campaignAdmin,false);
 connections.get(two).expiresAt=0;
 assert.equal(await authorize(second),null);
});
