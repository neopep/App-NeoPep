// Run against a clean checkout of the published installer source, without modifying it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {patch,baseline,hashes}=require('./apply-album-windows-028.cjs');
async function main(root){
 const input={};
 for(const [p,sha] of Object.entries(hashes)){const b=fs.readFileSync(path.join(root,p));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha,p);input[p]=b.toString('utf8');}
 const out=patch(input),provider=out['connect/whatsapp-lab/whatsapp-provider.mjs'];
 const a=provider.indexOf('export function validNativeAlbum('),b=provider.indexOf('\n}',a)+2,c=provider.indexOf('  async sendAlbum('),d=provider.indexOf('  async sendFile(',c);
 const fn=provider.slice(a,b).replace('export ',''),method=provider.slice(c,d).trim().replace(/,$/,'');
 const image=Buffer.from([255,216,255,255,217]),items=[{image,caption:' A '},{image,caption:'B'}];
 function setup(mode){
  const calls=[],state={connected:true},rejectedGroups=new Set(),listed={id:'123@g.us'};
  if(mode==='blocked')rejectedGroups.add(listed.id);
  const socket={groupFetchAllParticipating:async()=>mode==='not_member'?{}:{group:listed},sendMessage:async(jid,payload)=>{
   calls.push(payload);const i=calls.length;if(mode==='partial'&&i===3)throw Error('fail');if(mode==='disconnect'&&i===2)state.connected=false;
   return {key:{id:mode==='duplicate'&&i===3?'id2':'id'+i}};
  }};
  const get=new Function('Buffer','socket','state','rejectedGroups',fn+'\nlet pendingGroup=null,pendingDiagnostic=null;return {get valid(){return validNativeAlbum},'+method.replaceAll('connected','state.connected')+'};');
  return {provider:get(Buffer,socket,state,rejectedGroups),calls};
 }
 for(const mode of ['ok','partial','disconnect','duplicate','blocked','not_member']){
  const s=setup(mode);
  if(mode==='not_member'){await assert.rejects(()=>s.provider.sendAlbum('123@g.us',items));assert.equal(s.calls.length,0);continue;}
  const r=await s.provider.sendAlbum('123@g.us',items);
  if(mode==='ok'){assert.equal(r.status,'accepted');assert.equal(r.media.length,2);assert.equal(s.calls[0].album.expectedImageCount,2);assert.equal(s.calls[1].caption,' A ');assert.equal(s.calls[2].albumParentKey.id,'id1');}
  else if(mode==='blocked'){assert.equal(r.status,'rejected');assert.equal(s.calls.length,0);}
  else{assert.equal(r.status,'uncertain');assert.equal(r.media.length,1);assert.equal(r.messageId,'id1');}
 }
 const s=setup('ok');assert.equal(s.provider.valid([{image,caption:'A'}]),false);
 assert.equal(s.provider.valid([{image,caption:'A'},{image:Buffer.from([1,2,3,4,5]),caption:'B'}]),false);
 assert.equal(s.provider.valid([{image,caption:'A'.repeat(1001)},{image,caption:'B'}]),false);
 assert.throws(()=>patch({...input,'connect/windows/Connect.cs':'unexpected source'}));
 assert.ok(out['connect/windows/WhatsApp.cs'].includes('AlbumTransportApproved=true'));
 assert.ok(out['connect/windows/WhatsApp.cs'].includes('!environment.IsProduction&&CampaignSessionReady&&canPublish!=null&&canPublish()'));
 assert.ok(out['connect/windows/Connect.cs'].includes('originals_50mb=true,album_v1=window.CampaignAlbumReady'));
 assert.ok(out['connect/whatsapp-lab/windows-bridge.mjs'].includes('enableAlbums=false'));
 console.log('Album candidate mocks passed; exact source '+baseline+'; no real send or compilation.');
}
if(!process.argv[2])throw Error('Provide clean 0.2.28 worktree');
main(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1});
