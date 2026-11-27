const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/cloud.js','utf8');
const start=source.indexOf('function validateConnectAIReturn('),end=source.indexOf('\nconst api=',start);
assert.ok(start>=0&&end>start);
const validateConnectAIReturn=vm.runInNewContext(source.slice(start,end)+'\nvalidateConnectAIReturn',{URL});
const issuer='https://connect.neopep.com.br',native='https://chatgpt.com/oauth/codex/client.json',legacy='neopep-legacy',code='a'.repeat(64),state='test-state';
function fixture(client,uri,change={}) {const target=new URL(issuer+'/oauth/authorize');target.search=new URLSearchParams({client_id:client,redirect_uri:uri,state});const ret=new URL(uri);ret.searchParams.set('code',code);ret.searchParams.set('state',state);ret.searchParams.set('iss',issuer);for(const [k,v] of Object.entries(change)){if(v===null)ret.searchParams.delete(k);else ret.searchParams.set(k,v);}return {target,ret};}
const cases=[
 ['Codex loopback',native,'http://127.0.0.1:43210/callback',{},true],
 ['Codex localhost',native,'http://localhost:43210/callback',{},true],
 ['HTTPS antigo',legacy,'https://chatgpt.com/connector/oauth/example',{},true],
 ['HTTPS sem iss antigo',legacy,'https://chatgpt.com/connector/oauth/example',{iss:null},true],
 ['HTTPS com query',legacy,'https://chatgpt.com/connector/oauth/example?x=1',{},true],
 ['loopback cliente não nativo',legacy,'http://127.0.0.1:43210/callback',{},false],
 ['host não local',native,'http://evil.example:43210/callback',{},false],
 ['porta ausente',native,'http://localhost/callback',{},false],
 ['caminho incorreto',native,'http://localhost:43210/other',{},false],
 ['query local',native,'http://localhost:43210/callback?x=1',{},false],
 ['state errado',native,'http://localhost:43210/callback',{state:'wrong'},false],
 ['iss errado',native,'http://localhost:43210/callback',{iss:'https://evil.example'},false],
 ['iss ausente',native,'http://localhost:43210/callback',{iss:null},false],
 ['code ausente',native,'http://localhost:43210/callback',{code:null},false],
 ['code malformado',native,'http://localhost:43210/callback',{code:'bad'},false],
 ['parâmetro inesperado',native,'http://localhost:43210/callback',{extra:'bad'},false],
 ['credencial na URL',native,'http://a@localhost:43210/callback',{},false],
 ['fragmento',native,'http://localhost:43210/callback#x',{},false]
];
for(const [name,client,uri,change,want] of cases)test(name,()=>{const {target,ret}=fixture(client,uri,change);if(want)assert.equal(validateConnectAIReturn(target,ret.href),ret.href);else assert.throws(()=>validateConnectAIReturn(target,ret.href));});
for(const [name,mutate] of [['porta alterada',u=>u.port='43211'],['state duplicado',u=>u.searchParams.append('state',state)],['code duplicado',u=>u.searchParams.append('code',code)],['iss duplicado',u=>u.searchParams.append('iss',issuer)]])test(name,()=>{const {target,ret}=fixture(native,'http://localhost:43210/callback');mutate(ret);assert.throws(()=>validateConnectAIReturn(target,ret.href));});
