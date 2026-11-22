const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {transformSync}=require('esbuild');

const origin='https://qnuluspqfazdppciermw.supabase.co';
const path='0.2.3/NeoPepConnectSetup.exe';
const storageUrl=origin+'/storage/v1/object/sign/neo-connect-releases/'+path+'?token=header.payload.signature';
const source=readFileSync('supabase/functions/connect-update/index.ts','utf8').replace(/^import[^\n]+\n/,'');
const code=transformSync(source,{loader:'ts'}).code;

test('Broker só assina o caminho aprovado para sessão e computador autorizados',async()=>{
  let handler, signatures=0, project=origin, identityError=false, error, approved=true, url=storageUrl;
  const env={SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'};
  runInNewContext(code,{
    Request,Response,URL,TextDecoder,
    Deno:{serve(fn){handler=fn;},env:{get(key){return key==='SUPABASE_URL'?project:env[key];}}},
    createClient(_,key){
      if(key===env.SUPABASE_SERVICE_ROLE_KEY){
        return {storage:{from(bucket){
          assert.equal(bucket,'neo-connect-releases');
          return {async createSignedUrl(object,ttl){
            assert.equal(object,path);assert.equal(ttl,90);signatures++;
            return {data:{signedUrl:url}};
          }};
        }}};
      }
      return {auth:{async getUser(){return {error:identityError};}},async rpc(_,args){
        assert.equal(args.p_version,'0.2.3');
        return {data:approved?{path,version:'0.2.3'}:null,error};
      }};
    }
  });
  const call=(action='download')=>handler(new Request(origin,{
    method:'POST',headers:{Authorization:'Bearer '+ 'a'.repeat(32)},
    body:JSON.stringify({action,version:'0.2.3',device:'11111111-1111-1111-1111-111111111111',secret:'1'.repeat(64)})
  }));
  assert.equal(await (await call('authorize')).json().then(data=>data.url),undefined);
  assert.equal(signatures,0);
  assert.equal((await (await call()).json()).url,storageUrl);
  identityError=true;
  assert.equal((await call()).status,401);
  identityError=false;error={code:'42501'};
  assert.equal((await call()).status,403);
  error=null;approved=false;
  assert.equal(await (await call()).json(),null);
  assert.equal(signatures,1);
  approved=true;url=storageUrl.replace('/neo-connect-releases/','/public/');
  assert.equal((await call()).status,503);
  project='https://example.invalid';
  assert.equal((await call()).status,404);
  assert.equal(signatures,2);
});
