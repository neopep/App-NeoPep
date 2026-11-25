'use strict';
const endpoint='https://cpslafpzjtbpmoxxysaa.supabase.co';
const keyHeader=(key,authorization)=>({apikey:key,Authorization:authorization,'Content-Type':'application/json'});
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
 if(req.method!=='POST')return res.status(405).end();
 if(process.env.VERCEL_ENV!=='production'||req.headers.origin!=='https://app.neopep.com.br')return res.status(404).end();
 const service=process.env.NEO_PROD_GEO_SERVER_SUPABASE_KEY;
 if(process.env.NEO_PROD_GEO_ENABLED!=='1'||!service)return res.status(200).json({configured:false});
 const auth=req.headers.authorization;
 if(typeof auth!=='string'||auth.length>8192||!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return res.status(401).end();
 const key=process.env.NEO_PROD_SUPABASE_PUBLISHABLE_KEY;
 if(!key)return res.status(503).json({configured:false});
 try{
  const user=await request('/auth/v1/user',keyHeader(key,auth));
  if(typeof user.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(user.id))return res.status(401).end();
  const country=headerText(req.headers['x-vercel-ip-country'],2);
  if(!country||!/^[A-Z]{2}$/.test(country))return res.status(200).json({configured:true,recorded:false});
  const recorded=await request('/rest/v1/rpc/neo_geo_observe',keyHeader(service,'Bearer '+service),{
   p_user:user.id,p_country:country,p_region:headerText(req.headers['x-vercel-ip-country-region'],100),p_city:headerText(req.headers['x-vercel-ip-city'],120)
  });
  return res.status(200).json({configured:true,recorded:recorded===true});
 }catch{return res.status(503).json({recorded:false})}
};
