const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs'),members=require('./apply-group-members-windows-028.cjs'),messages=require('./apply-group-messages-windows-028.cjs');
async function verify(source,assert){
 const i=source.indexOf('export function groupDiagnostics('),j=source.indexOf('// Fresh, read-only',i),k=source.indexOf(' let messageView=null;'),l=source.indexOf('\n }',source.indexOf('try{view.onStop();}catch{}',k))+3;
 const a=source.indexOf('  stopGroupMessageView(){'),b=source.indexOf('  async listGroupMembers(',a);
 assert.ok(i>=0&&j>i&&k>=0&&l>k&&a>=0&&b>a);
 const code=source.slice(i,j).replace('export ','')+'\nlet pendingGroup=null,pendingDiagnostic=null;'+source.slice(k,l)+'\nreturn {'+source.slice(a,b)+'};';
 const jid='123@g.us',own='12025550123@s.whatsapp.net';
 function setup(mode){
  const row={id:jid,ephemeralDuration:mode==='ephemeral'?60:0,participants:[{id:own,admin:mode==='nonadmin'?null:'admin'}]};
  const events=new Map(),state={connected:true},received=[];let ended=0,timeout;
  const socket={user:{id:own},groupFetchAllParticipating:async()=>mode==='notmember'?{}:{group:row},groupMetadata:async()=>{if(mode==='disconnect')state.connected=false;return row;},ev:{on:(k,v)=>events.set(k,v),off:(k,v)=>{if(events.get(k)===v)events.delete(k)}}};
  const f=new Function('socket','state','creds','schedule','cancel',code.replaceAll('!connected','!state.connected'));
  const api=f(socket,state,{me:{id:own}},fn=>{timeout=fn;return 1},()=>{});
  return {api,received,events,state,end:()=>ended,tick:()=>timeout(),start:()=>api.startGroupMessageView(jid,v=>received.push(v),()=>ended++)};
 }
 for(const mode of ['nonadmin','notmember','ephemeral','disconnect']){const t=setup(mode);await assert.rejects(t.start);assert.equal(t.events.size,0);}
 const t=setup('ok');await t.start();
 const stamp=Math.floor(Date.now()/1000),msg=(id,text,extra={})=>({key:{id,remoteJid:jid},messageTimestamp:stamp,message:{conversation:text},...extra});
 const emit=(type,messages)=>t.events.get('messages.upsert')?.({type,messages});
 emit('append',[msg('history','history')]);
 emit('notify',[msg('old','old',{messageTimestamp:stamp-30}),msg('wrong','wrong',{key:{id:'wrong',remoteJid:'999@g.us'}}),msg('ephemeral','secret',{message:{ephemeralMessage:{message:{conversation:'secret'}}}}),msg('viewonce','secret',{message:{viewOnceMessage:{message:{conversation:'secret'}}}}),msg('one','  Olá  '),msg('one','duplicate'),msg('long','a'.repeat(550))]);
 assert.equal(t.received.length,2);assert.equal(t.received[0].text,'Olá');assert.equal(t.received[1].text.length,500);assert.deepEqual(Object.keys(t.received[0]),['text']);
 t.api.stopGroupMessageView();assert.equal(t.events.size,0);assert.equal(t.end(),1);
 const cap=setup('ok');await cap.start();cap.events.get('messages.upsert')({type:'notify',messages:Array.from({length:55},(_,n)=>msg(String(n),'text'))});assert.equal(cap.received.length,50);assert.equal(cap.events.size,0);
 const timed=setup('ok');await timed.start();timed.tick();assert.equal(timed.events.size,0);
}
async function main(root){
 const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha);input[p]=b.toString('utf8');}
 const out=messages.patchMessages(members.patchMembers(album.patch(input)));await verify(out['connect/whatsapp-lab/whatsapp-provider.mjs'],assert);
 const bridge=out['connect/whatsapp-lab/windows-bridge.mjs'],win=out['connect/windows/WhatsApp.cs'];assert.ok(bridge.includes('enableGroupView=false'));assert.ok(bridge.includes('message.confirmed!==true'));assert.ok(win.includes('if(!ready){ClearGroupMembers();ClearGroupMessages();}'));assert.ok(win.includes('NEO_CONNECT_GROUP_VIEW_V1'));
 console.log('Group messages QA: scope, permissions, exclusions, deduplication, cap and cleanup passed.');
}
if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');main(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1});
