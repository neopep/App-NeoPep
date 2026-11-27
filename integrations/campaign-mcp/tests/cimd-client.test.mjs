import {test} from 'node:test';
import assert from 'node:assert/strict';
import {neoCimdClientAllowed as allowed} from '../src/cimd-client.mjs';
const native='https://chatgpt.com/oauth/codex/client.json';
const web='https://chatgpt.com/oauth/client.json';
const clients=new Map([['legacy',['https://chatgpt.com/connector/oauth/old']]]);
const stub=(overrides={})=>async url=>Response.json({client_id:url,redirect_uris:url===native?['http://127.0.0.1/callback','http://localhost/callback']:['https://chatgpt.com/connector_platform_oauth_redirect'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_methods_supported:['none'],application_type:'native',...overrides});
test('CIMD restricts clients, metadata and exact loopback callback',async()=>{
 const cases=[
 ['legacy','https://chatgpt.com/connector/oauth/old',{},true],
 ['legacy','https://evil.example',{},false],
 [native,'http://127.0.0.1:54321/callback',{},true],
 [native,'http://localhost:43210/callback',{},true],
 [native,'http://evil.example:43210/callback',{},false],
 [native,'http://localhost:43210/wrong',{},false],
 [native,'http://localhost/callback',{},false],
 [native,'http://x@localhost:43210/callback',{},false],
 [native,'http://localhost:43210/callback?x=1',{},false],
 [web,'https://chatgpt.com/connector_platform_oauth_redirect',{},true],
 [web,'https://chatgpt.com/other',{},false],
 ['https://evil.example/client.json',null,{},false],
 [native,null,{client_id:'https://evil.example'},false],
 [native,null,{token_endpoint_auth_methods_supported:['private_key_jwt']},false],
 [native,'http://localhost:43210/callback',{redirect_uris:[]},false],
 [native,null,{},true],
 [native,null,{grant_types:['authorization_code']},false],
 [native,'http://127.0.0.1:54321/callback',{application_type:'web'},false]];
 for(const [client,uri,overrides,want] of cases)assert.equal(await allowed(clients,client,uri,stub(overrides)),want,client+' '+uri);
});
