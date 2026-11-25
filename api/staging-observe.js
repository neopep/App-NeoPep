'use strict';
const {timingSafeEqual}=require('node:crypto');
const endpoint='https://qnuluspqfazdppciermw.supabase.co';
const keyHeader=(key,authorization)=>({apikey:key,Authorization:authorization,'Content-Type':'application/json'});
function tokenEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||b.length<32)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
async function request(path,headers,payload){
 const response=await fetch(endpoint+path,{headers,method:payload?'POST':'GET',
  signal:AbortSignal.timeout(5000),redirect:'error',...(payload?{body:JSON.stringify(payload)}:{})});
 if(!response.ok)throw Error('upstream');
 return response.json();
}
function headerText(raw,length){
 if(typeof raw!=='string'||raw.length>length*4)return null;
 try{
  const decoded=decodeURIComponent(raw).trim();
  return decoded.length>0&&decoded.length<=length&&!/[\u0000-\u001f\u007f]/.test(decoded)?decoded:null;
 }catch{return null}
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 const branch=process.env.VERCEL_GIT_COMMIT_REF;
 const mode=req.query?.mode,service=process.env.NEO_STAGING_SERVER_SUPABASE_KEY;
 const staging=branch==='staging/permanente';
 const cycleGeo=mode==='geo'&&branch==='homologacao/ciclo-completo-2026-11-24';
 if(!staging&&!cycleGeo)return res.status(404).end();
 const auth=req.headers.authorization;
 if(mode==='snapshot'){
  if(req.method!=='GET')return res.status(405).end();
  const secret=process.env.CRON_SECRET;
  if(!secret||!service)return res.status(503).json({configured:false});
  if(!tokenEqual(auth,'Bearer '+secret)||secret.length<32)return res.status(401).end();
  const headers=keyHeader(service,'Bearer '+service);
  try{
   await request('/rest/v1/rpc/neo_admin_system',headers,{p_action:'scheduled_snapshot'});
   return res.status(200).json({recorded:true});
  }catch{
   try{await request('/rest/v1/rpc/neo_admin_system',headers,{p_action:'scheduled_failure'})}catch{}
   return res.status(503).json({recorded:false});
  }
 }
 if(mode!=='geo'||req.method!=='POST')return res.status(404).end();
 if(process.env.NEO_STAGING_GEO_ENABLED!=='1'||!service)return res.status(200).json({configured:false});
 if(typeof auth!=='string'||auth.length>8192||!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return res.status(401).end();
 const key=process.env.NEO_STAGING_SUPABASE_PUBLISHABLE_KEY;
 if(!key)return res.status(503).json({configured:false});
 try{
  const user=await request('/auth/v1/user',keyHeader(key,auth));
  if(typeof user.id!=='string'||! /^[a-f0-9-]{36}$/.test(user.id))return res.status(401).end();
  const country=headerText(req.headers['x-vercel-ip-country'],2);
  if(!country||!/^[A-Z]{2}$/.test(country))return res.status(200).json({configured:true,recorded:false});
  const recorded=await request('/rest/v1/rpc/neo_geo_observe',keyHeader(service,'Bearer '+service),{
   p_user:user.id,p_country:country,p_region:headerText(req.headers['x-vercel-ip-country-region'],100),p_city:headerText(req.headers['x-vercel-ip-city'],120)
  });
  return res.status(200).json({configured:true,recorded:recorded===true});
 }catch{return res.status(503).json({recorded:false})}
};
