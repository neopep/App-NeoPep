const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/location-observe.js');
function response(){
 return {statusCode:0,headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.statusCode=code;return this;},
  json(body){this.body=body;return this;},end(){return this;}};
}
test('localização oficial exige configuração, origem oficial e sessão, e envia apenas região aproximada',async()=>{
 const savedFetch=global.fetch;
 const env={VERCEL_ENV:'production',NEO_PROD_GEO_ENABLED:'1',NEO_PROD_GEO_SERVER_SUPABASE_KEY:'fixture-server',
  NEO_PROD_SUPABASE_PUBLISHABLE_KEY:'fixture-public'};
 const old=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 Object.assign(process.env,env);
 const calls=[];
 global.fetch=async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>calls.length===1?{id:'00000000-0000-4000-8000-000000000001'}:false};
 };
 try{
  const request={method:'POST',headers:{origin:'https://app.neopep.com.br',authorization:'Bearer fixture.jwt.here',
   'x-vercel-ip-country':'BR','x-vercel-ip-country-region':'SP','x-vercel-ip-city':'S%C3%A3o%20Paulo'},body:{latitude:45,longitude:4}};
  assert.equal((await handler({...request,headers:{...request.headers,origin:'https://other.invalid'}},response())).statusCode,404);
  assert.equal((await handler({...request,headers:{...request.headers,authorization:'not-a-token'}},response())).statusCode,401);
  process.env.NEO_PROD_GEO_ENABLED='0';
  assert.deepEqual((await handler(request,response())).body,{configured:false});assert.equal(calls.length,0);
  process.env.NEO_PROD_GEO_ENABLED='1';
  const result=await handler(request,response());
  assert.equal(result.headers['Cache-Control'],'private, no-store');
  assert.deepEqual(result.body,{configured:true,recorded:false});
  assert.match(calls[0].url,/\/auth\/v1\/user$/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer fixture.jwt.here');
  assert.match(calls[1].url,/\/rpc\/neo_geo_observe$/);
  assert.deepEqual(JSON.parse(calls[1].options.body),{p_user:'00000000-0000-4000-8000-000000000001',p_country:'BR',p_region:'SP',p_city:'São Paulo'});
 }finally{
  global.fetch=savedFetch;
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
