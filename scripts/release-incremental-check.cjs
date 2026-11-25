'use strict';
const fs=require('node:fs');
const REQUIRED=['official_baseline','installed_migrations','financial_contract','geo_official','campaign_central','connect_official','authenticated_smoke'];
function assess(manifest){
 const failures=[];
 if(manifest?.target!=='production-incremental')failures.push('Destino incremental inválido.');
 for(const id of REQUIRED){
  const item=manifest?.checks?.[id];
  if(item?.status!=='verified'||typeof item.evidence!=='string'||!item.evidence.trim()){
   failures.push(id+': '+(item?.note||'Evidência pendente.'));
  }
 }
 return failures;
}
if(require.main===module){
 try{
  const failures=assess(JSON.parse(fs.readFileSync('release/incremental-readiness.json','utf8')));
  for(const failure of failures)console.error(failure);
  if(failures.length)process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={assess,REQUIRED};
