import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDraftJobRunner} from '../src/draft-job-runner.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const principal={environment:'test',id:id(1),ownerId:id(2),campaignAdmin:true,scopes:['campaigns:read','campaigns:drafts']},jobId=id(3);
function fixture(n=6){
 const rows=Array.from({length:n},(_,i)=>({ordinal:i,publicationId:id(100+i),requestId:id(200+i),leaseId:id(4),campaignId:id(5),channel:'app',item:{publicationId:id(100+i),requestId:id(200+i),title:'Fixture '+i,blocks:[]},state:'pending'}));
 let state='active',authorized=true,clock=0;const writes=[],recorded=[];
 const deps={enabled:true,authorize:async()=>authorized,now:()=>clock,claim:async()=>{if(state!=='active'||rows.some(r=>r.state==='leased'))return [];const chunk=rows.filter(r=>['pending','retryable'].includes(r.state)).slice(0,6);chunk.forEach(r=>r.state='leased');return chunk;},
 status:async()=>({id:jobId,state,items:rows.map(r=>({ordinal:r.ordinal,publicationId:r.publicationId,state:r.state}))}),
 result:async(p,j,r,l,outcome,revision)=>{assert.equal(j,jobId);const row=rows.find(x=>x.requestId===r&&x.leaseId===l);assert.equal(row.state,'leased');row.state=outcome;recorded.push({r,outcome,revision});return true;},
 writeDraft:async(p,op,input)=>{assert.equal(op,'add_publications');assert.equal(input.items.length,1);writes.push(input.items[0].requestId);return {campaignId:input.campaignId,channel:input.channel,results:[{publicationId:input.items[0].publicationId,status:'draft_saved_or_reused',revision:1}]};}};
 return {rows,writes,recorded,deps,pause:()=>state='paused',cancel:()=>state='cancelled',revoke:()=>authorized=false,tick:()=>clock=90000};
}
test('60 rascunhos em 10 chamadas explícitas, sem duplicatas nem envio',async()=>{
 const f=fixture(60),run=createDraftJobRunner(f.deps);
 for(let i=0;i<10;i++){const r=await run(principal,jobId);assert.equal(r.claimed,6);assert.equal(r.receipts.length,6);}
 assert.equal((await run(principal,jobId)).claimed,0);assert.equal(new Set(f.writes).size,60);assert.ok(f.rows.every(r=>r.state==='saved'));
});
test('desativado, produção, sem escopo e sem autorização não reservam lote',async()=>{
 const f=fixture();let claims=0;const deps={...f.deps,claim:async()=>{claims++;return [];}};
 for(const [enabled,p] of [[false,principal],[true,{...principal,environment:'production'}],[true,{...principal,scopes:['campaigns:read']}]]){
  await assert.rejects(createDraftJobRunner({...deps,enabled})(p,jobId),/FORBIDDEN/);
 }
 f.revoke();await assert.rejects(createDraftJobRunner(deps)(principal,jobId),/FORBIDDEN/);assert.equal(claims,0);
});
test('pausa e cancelamento interrompem novas escritas; recibos sem nova tentativa',async()=>{
 for(const action of ['pause','cancel']){
  const f=fixture(),write=f.deps.writeDraft;
  f.deps.writeDraft=async(...args)=>{const r=await write(...args);f[action]();return r;};
  const r=await createDraftJobRunner(f.deps)(principal,jobId);
  assert.equal(f.writes.length,1);assert.equal(r.receipts[0].state,'saved');
  assert.ok(r.receipts.slice(1).every(x=>x.state===(action==='pause'?'retryable':'blocked')));
 }
});
test('timeout de gravacao e resposta ambigua ficam incertos, sem replay',async()=>{
 const f=fixture(2);let n=0;f.deps.writeDraft=async()=>{if(++n===1)throw Error('timeout');return {results:[]};};
 const run=createDraftJobRunner(f.deps),r=await run(principal,jobId);
 assert.ok(r.receipts.every(x=>x.state==='uncertain'));assert.equal((await run(principal,jobId)).claimed,0);assert.equal(n,2);
});
test('recibo rejeitado impede novas escritas e nao declara salvo',async()=>{
 const f=fixture();f.deps.result=async()=>false;
 const r=await createDraftJobRunner(f.deps)(principal,jobId);
 assert.equal(r.stopped,'receipt_unconfirmed');assert.equal(r.receipts.length,0);assert.equal(f.writes.length,1);
});
test('revogacao e deadline impedem novas escritas',async()=>{
 for(const stop of ['revoke','tick']){
  const f=fixture(),write=f.deps.writeDraft;f.deps.writeDraft=async(...args)=>{const r=await write(...args);f[stop]();return r;};
  const r=await createDraftJobRunner(f.deps)(principal,jobId);assert.equal(r.stopped,'authorization_or_deadline');assert.equal(f.writes.length,1);
 }
});
test('payload divergente do lease impede todas as escritas',async()=>{
 const f=fixture(),claim=f.deps.claim;f.deps.claim=async(...args)=>{const rows=await claim(...args);rows[0].item.requestId=id(999);return rows;};
 await assert.rejects(createDraftJobRunner(f.deps)(principal,jobId),/INVALID_CLAIM/);assert.equal(f.writes.length,0);
});
