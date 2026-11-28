const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs'),members=require('./apply-group-members-windows-028.cjs');
async function verify(source,assert){
 const begin=source.indexOf('export function groupDiagnostics('),end=source.indexOf('// Fresh, read-only',begin);
 const start=source.indexOf('  async listGroupMembers('),finish=source.indexOf('  async listGroups(',start);
 if(begin<0||end<0||start<0||finish<0)throw Error('source anchors');
 const code=source.slice(begin,end).replace('export ','')+'\nlet pendingGroup=null,pendingDiagnostic=null;return {'+source.slice(start,finish)+'};';
 const jid='123@g.us',own='12025550123@s.whatsapp.net';
 function setup(mode){
  const row={id:jid,participants:[{id:own,admin:mode==='nonadmin'?null:'admin'},{id:'12025550124@s.whatsapp.net',name:'Pessoa A'},{id:'123456789@lid',name:'Pessoa B'},{id:'234567890@lid',phoneNumber:'12025550125@s.whatsapp.net'}]};
  let reads=0;
  const state={connected:true};
  const socket={user:{id:own},groupFetchAllParticipating:async()=>mode==='notmember'?{}:{group:row},groupMetadata:async()=>{reads++;if(mode==='disconnect')state.connected=false;return mode==='wronggroup'?{...row,id:'999@g.us'}:row;}};
  const f=new Function('socket','state','creds',code.replaceAll('!connected','!state.connected'));
  return {api:f(socket,state,{me:{id:own}}),reads:()=>reads};
 }
 for(const mode of ['notmember','nonadmin','disconnect','wronggroup']){
  const t=setup(mode);await assert.rejects(()=>t.api.listGroupMembers(jid));if(mode==='notmember')assert.equal(t.reads(),0);
 }
 const t=setup('ok'),result=await t.api.listGroupMembers(jid);assert.equal(result.total,4);assert.equal(result.rows[0].role,'admin');assert.equal(result.rows[1].phone,'12025550124');assert.equal(result.rows[2].phone,'');assert.equal(result.rows[3].phone,'12025550125');assert.ok(result.rows.every(r=>!('id' in r)&&!('lid' in r)));
 await assert.rejects(()=>t.api.listGroupMembers('123@s.whatsapp.net'));
}

async function main(root){
 const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha);input[p]=b.toString('utf8');}
 const out=members.patchMembers(album.patch(input));
 await verify(out['connect/whatsapp-lab/whatsapp-provider.mjs'],assert);
 const win=out['connect/windows/WhatsApp.cs'];assert.ok(win.includes('if(!environment.IsProduction)groupTools.Controls.Add(Action("Consultar participantes"'));assert.ok(win.includes('if(!ready)ClearGroupMembers()'));assert.ok(win.includes('membersRequest!=Guid.Empty'));assert.ok(win.includes('Os dados não serão enviados ao NeoPep nem salvos.'));
 console.log('Group members QA: mocked permission, scope, session and privacy checks passed.');
}
if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');
main(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1});
